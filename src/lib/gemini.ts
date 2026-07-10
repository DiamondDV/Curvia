// Gemini via the backend proxy — no key in the browser.
import { geminiGenerate } from "./api";

const SYSTEM_PROMPT = `You are a prompt engineer that rewrites user prompts so the resulting AI-generated image is perfectly suited for SVG vectorization.

SVG CANNOT represent:
- Gradients (linear or radial) — only solid flat fills
- Soft shadows, drop shadows, ambient occlusion
- Gaussian blur, glow effects, bokeh
- Semi-transparent overlays or glass effects
- Photorealistic textures (wood grain, fabric, marble, skin pores)
- Noise, film grain, stippling, halftone dots
- Complex lighting (specular highlights, caustics, rim lighting)
- Depth of field or atmospheric perspective
- Anti-aliased feathered edges between colors
- Continuous tone photography
- Volumetric effects (smoke, fog, clouds with soft edges)

SVG WORKS WELL with:
- Bold solid flat color fills with hard clean edges
- Strong high-contrast outlines and borders
- Geometric shapes with crisp curves and straight lines
- Limited cohesive color palette (ideally 4-8 solid colors)
- Completely flat 2D compositions, no 3D depth
- Pure solid white or single-color backgrounds
- Clear silhouettes with unambiguous boundaries
- Poster-style or icon-style minimalist illustration
- Each color region as one large uniform area, not patchy

RULES for your rewrite:
1. Keep the user's subject and intent exactly — do not change what they want to draw
2. Wrap it in style instructions that force flat vector-friendly output
3. Explicitly ban gradients, soft shading, texture, photorealism, noise, grain
4. Request solid uniform color fills across each region — no dark/light patches within a single color area
5. Request a pure solid white background with nothing behind the subject
6. Request clean bold outlines separating every color region
7. Keep the enhanced prompt under 280 words
8. Output ONLY the enhanced prompt text, nothing else — no quotes, no labels, no explanation`;

export async function enhancePrompt(userPrompt: string): Promise<string> {
  const data = await geminiGenerate({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [{ text: `Rewrite this prompt for SVG-friendly image generation:\n\n${userPrompt}` }],
      },
    ],
    generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
  });

  const text = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== "string") throw new Error("Gemini returned no enhanced prompt.");
  return text.trim();
}

// Classify whether the user's prompt indicates they want the background removed.
// Returns true if Gemini (or our heuristic) detects background-removal intent.
export async function detectRemoveBackground(userPrompt: string): Promise<boolean> {
  const lower = userPrompt.toLowerCase();
  const keywords = [
    "remove background", "no background", "transparent background",
    "without background", "clear background", "cut out background",
    "background removed", "transparent", "cutout", "cut out",
    "isolated", "no bg", "transparent bg",
  ];
  if (keywords.some((kw) => lower.includes(kw))) return true;

  // Ask Gemini for anything that local keyword matching might miss
  try {
    const data = await geminiGenerate({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Does the following user prompt intend to remove or make the background transparent in the final image? Answer with only "yes" or "no".\n\nPrompt: "${userPrompt}"`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 4 },
    });
    const answer = ((data as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim().toLowerCase();
    return answer.startsWith("yes");
  } catch {
    return false;
  }
}
