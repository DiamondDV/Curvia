import sharp from 'sharp';
import type { PosterizeInput, PosterizeOutput } from '@/types/stages';
import { buildPalette, nearestColor, toHex, type RGB } from '@/lib/image/quantize';

/**
 * This is the stage that actually fixes the VTracer output problem.
 * By reducing the image to 4-8 flat colors *before* tracing, VTracer
 * produces a small number of clean paths instead of thousands of
 * fragmented ones. See plan.md's "core insight" section.
 */
export async function posterize(input: PosterizeInput): Promise<PosterizeOutput> {
  const { pngBuffer, colorCount } = input;

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

  const palette = buildPalette(pixels, colorCount);

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

  // Nearest-color mapping is done pixel-by-pixel and independently, so
  // anti-aliased edges (gradual color blends in the source image) quantize
  // into "salt-and-pepper" noise — adjacent pixels flip-flopping between
  // two palette colors along a diagonal edge instead of a clean boundary.
  // VTracer then traces every one of those single-pixel flecks as its own
  // tiny path, which shows up as small scratch/speckle marks in the final
  // SVG. A median filter replaces each pixel with the modal color in its
  // neighborhood, erasing that isolated noise while leaving real edges and
  // shapes intact — cleaner than blurring before quantization, which would
  // soften real edges too.
  const flatPngBuffer = await sharp(outputData, { raw: { width, height, channels } })
    .median(3)
    .png()
    .toBuffer();

  return {
    flatPngBuffer,
    actualColorCount: palette.length,
    palette: palette.map(toHex),
  };
}
