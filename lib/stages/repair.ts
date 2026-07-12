import type { ImageAnalysis, RepairInput, RepairOutput } from '@/types/stages';
import type { GeminiClient } from '@/lib/ai/gemini';
import { REPAIR_PROMPT } from '@/lib/config/prompts';
import { StageError } from '@/lib/utils/errors';
import { limits } from '@/lib/config/limits';
import { logger } from '@/lib/pipeline/logger';

// This is the stage that replaces OpenCV + GPT-Image from the previous plan.
// Gemini reads the raw SVG text and the original image, then produces a
// cleaned SVG with proper semantic structure.
export async function repair(
  input: RepairInput,
  gemini: GeminiClient,
  signal: AbortSignal,
): Promise<RepairOutput> {
  const { svgRaw, originalPngBuffer, palette, analysis } = input;

  // Edge case from plan.md: an unusually complex raw SVG could approach
  // Gemini's practical context budget. Skip repair rather than risk a
  // truncated or failed response — SVGO still runs afterward.
  if (Buffer.byteLength(svgRaw, 'utf8') > limits.MAX_REPAIR_INPUT_BYTES) {
    return {
      svgRepaired: svgRaw,
      changesSummary: 'Skipped: raw SVG exceeded repair size threshold',
    };
  }

  // Gemini 2.5 Flash has a 1M token context window.
  // Raw SVG from a posterized image is typically 20-200KB.
  // Fits easily. No chunking needed.
  const prompt = buildPrompt(svgRaw, palette, analysis);

  const response = await gemini.generateContent(
    {
      contents: [
        {
          role: 'user',
          parts: [
            // Original image for visual reference
            {
              inlineData: {
                mimeType: 'image/png',
                data: originalPngBuffer.toString('base64'),
              },
            },
            // The raw SVG to repair
            { text: prompt },
          ],
        },
      ],
    },
    signal,
  );

  const candidate = response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const responseText = candidate?.content?.parts?.[0]?.text;

  if (response.promptFeedback?.blockReason) {
    throw new StageError(
      'repairing',
      `Gemini blocked the request: ${response.promptFeedback.blockReason}`,
    );
  }

  if (!responseText) {
    throw new StageError(
      'repairing',
      `Gemini returned empty response (finishReason: ${finishReason ?? 'unknown'})`,
    );
  }

  if (finishReason === 'MAX_TOKENS') {
    logger.warn('Gemini response truncated at MAX_TOKENS', {
      responseLength: responseText.length,
      preview: responseText.slice(-300),
    });
    throw new StageError(
      'repairing',
      'Gemini response was truncated (hit MAX_TOKENS) before finishing the SVG. ' +
        'Try again, or reduce color count to shrink the raw SVG.',
    );
  }

  // Extract SVG from response (Gemini may wrap it in markdown)
  const svgRepaired = ensureNamespacesDeclared(extractSVG(responseText));
  const changesSummary = extractSummary(responseText);

  return { svgRepaired, changesSummary };
}

function buildPrompt(svgRaw: string, palette: string[], analysis: ImageAnalysis): string {
  return `${REPAIR_PROMPT}

PALETTE (${palette.length} colors): ${palette.join(', ')}
DIMENSIONS: ${analysis.normalizedWidth}×${analysis.normalizedHeight}
HAS TRANSPARENCY: ${analysis.hasTransparency}

RAW SVG TO REPAIR:
\`\`\`svg
${svgRaw}
\`\`\`

Return ONLY the repaired SVG, then on a new line write:
CHANGES: <one-line summary of what you changed>`;
}

function extractSVG(text: string): string {
  // Try fenced code block first
  const fenced = text.match(/```(?:svg|xml)?\n([\s\S]+?)\n```/);
  if (fenced) return fenced[1]!.trim();

  // Try raw SVG element
  const raw = text.match(/<svg[\s\S]+<\/svg>/);
  if (raw) return raw[0].trim();

  // Nothing matched — log a preview so this is diagnosable instead of a
  // bare "could not extract" with no clue what Gemini actually sent back.
  logger.error('Could not extract SVG from Gemini response', {
    responseLength: text.length,
    preview: text.slice(0, 500),
  });

  throw new StageError('repairing', 'Could not extract SVG from Gemini response');
}

// Known prefix -> namespace URI for attribute prefixes the repair prompt
// asks Gemini to use. The prompt instructs it to also declare these on
// the root <svg>, but LLM output isn't 100% reliable — this is a safety
// net so a forgotten xmlns:inkscape doesn't fail strict XML parsing in
// validateSVG() (mirrors trace.ts's ensureViewBox() pattern).
const KNOWN_NAMESPACES: Record<string, string> = {
  inkscape: 'http://www.inkscape.org/namespaces/inkscape',
  sodipodi: 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd',
};

function ensureNamespacesDeclared(svg: string): string {
  const rootMatch = svg.match(/<svg\b[^>]*>/);
  if (!rootMatch) return svg;
  const rootTag = rootMatch[0];

  const missing = Object.entries(KNOWN_NAMESPACES).filter(
    ([prefix]) =>
      new RegExp(`\\b${prefix}:`).test(svg) &&
      !new RegExp(`\\bxmlns:${prefix}\\s*=`).test(rootTag),
  );

  if (missing.length === 0) return svg;

  const declarations = missing.map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`).join(' ');
  const patchedRootTag = rootTag.replace(/^<svg\b/, `<svg ${declarations}`);

  return svg.replace(rootTag, patchedRootTag);
}

function extractSummary(text: string): string {
  const match = text.match(/CHANGES:\s*(.+)/);
  return match?.[1]?.trim() ?? 'No summary provided';
}
