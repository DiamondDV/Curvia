import sharp from 'sharp';
import type { PosterizeInput, PosterizeOutput } from '@/types/stages';
import { buildPalette, nearestColor, toHex, type RGB } from '@/lib/image/quantize';

/**
 * This is the stage that actually fixes the VTracer output problem.
 * By reducing the image to 4-8 flat colors *before* tracing, VTracer
 * produces a small number of clean paths instead of thousands of
 * fragmented ones. See plan.md's "core insight" section.
 *
 * FIX (Jan 2026): Added adaptive color count detection based on image
 * complexity. If the source image contains significant gradients or color
 * variation (detected via entropy analysis), we increase the color count
 * beyond the user's request to preserve important detail. This compensates
 * for prompt enhancement that requests flat-color output but may receive
 * slightly complex images from Pollinations.
 */
export async function posterize(input: PosterizeInput): Promise<PosterizeOutput> {
  let { pngBuffer, colorCount } = input;

  // Extract raw pixels via Sharp
  const { data, info } = await sharp(pngBuffer).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Build pixel array for quantizer, skipping transparent pixels
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += channels) {
    const a = channels === 4 ? data[i + 3]! : 255;
    if (a < 128) continue;
    pixels.push([data[i]!, data[i + 1]!, data[i + 2]!]);
  }

  // Detect image complexity (gradient/color variation)
  // This helps us decide if we need more colors to preserve quality
  const complexity = detectImageComplexity(pixels);

  // Adaptive color count: if the image is complex (has lots of gradients
  // or color variation), increase color count to preserve detail.
  // This is especially important when Pollinations returns a slightly complex
  // image despite our prompt enhancement requesting flat colors.
  const adaptiveColorCount = Math.min(12, Math.max(colorCount, complexity.recommendedColors));
  const wasAdapted = adaptiveColorCount > colorCount;

  const palette = buildPalette(pixels, adaptiveColorCount);

  // Remap every pixel to nearest palette color
  const outputData = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += channels) {
    const a = channels === 4 ? data[i + 3]! : 255;

    if (a < 128) {
      // Transparent → white
      outputData[i] = 255;
      outputData[i + 1] = 255;
      outputData[i + 2] = 255;
      if (channels === 4) outputData[i + 3] = 255;
      continue;
    }

    const nearest = nearestColor([data[i]!, data[i + 1]!, data[i + 2]!], palette);
    outputData[i] = nearest[0];
    outputData[i + 1] = nearest[1];
    outputData[i + 2] = nearest[2];
    if (channels === 4) outputData[i + 3] = 255;
  }

  // No image-level smoothing filter. Rely on VTracer's --filter_speckle
  // to handle noise. This preserves crispness and color fidelity.
  const flatPngBuffer = await sharp(outputData, { raw: { width, height, channels } })
    .png()
    .toBuffer();

  return {
    flatPngBuffer,
    actualColorCount: palette.length,
    palette: palette.map(toHex),
  };
}

/**
 * Detect image complexity to determine if we need more colors.
 * Returns metrics and a recommendation for color count.
 *
 * Complexity detection:
 * - Color entropy: measure of color diversity
 * - Gradient presence: detects smooth transitions between colors
 * - Unique colors: how many distinct colors are present
 *
 * High complexity → recommend more colors to preserve detail
 */
function detectImageComplexity(pixels: RGB[]): { recommendedColors: number; entropy: number } {
  if (pixels.length === 0) return { recommendedColors: 4, entropy: 0 };

  // Calculate color entropy as a proxy for complexity
  const colorMap = new Map<string, number>();
  for (const [r, g, b] of pixels) {
    const key = `${r},${g},${b}`;
    colorMap.set(key, (colorMap.get(key) ?? 0) + 1);
  }

  const uniqueColors = colorMap.size;
  let entropy = 0;
  for (const count of colorMap.values()) {
    const prob = count / pixels.length;
    entropy -= prob * Math.log2(prob);
  }

  // Heuristic: if we have high unique colors and high entropy,
  // it means the image has lots of gradients/complexity
  // Recommend more colors (up to 12) to preserve detail.
  // - Low entropy (< 2) + few unique colors → flat image, stick with 4-6
  // - Medium entropy (2-4) + moderate colors → some complexity, use 6-8
  // - High entropy (> 4) + many colors → very complex, use 8-12
  let recommendedColors = 4;
  if (uniqueColors > 50 || entropy > 4) {
    recommendedColors = 12;
  } else if (uniqueColors > 30 || entropy > 3) {
    recommendedColors = 10;
  } else if (uniqueColors > 20 || entropy > 2) {
    recommendedColors = 8;
  } else if (uniqueColors > 10) {
    recommendedColors = 6;
  }

  return { recommendedColors, entropy };
}
