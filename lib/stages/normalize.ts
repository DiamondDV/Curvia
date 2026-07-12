import sharp from 'sharp';
import type { NormalizeInput, NormalizeOutput } from '@/types/stages';
import { FileSizeError, FileTypeError } from '@/lib/utils/errors';
import { limits } from '@/lib/config/limits';

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// Pure function. No side effects. No network calls.
export async function normalize(input: NormalizeInput): Promise<NormalizeOutput> {
  const { rawBuffer, mimeType } = input;

  // Validate
  if (!SUPPORTED_TYPES.includes(mimeType)) {
    throw new FileTypeError(`Unsupported type: ${mimeType}`);
  }
  if (rawBuffer.byteLength > limits.MAX_FILE_SIZE_BYTES) {
    throw new FileSizeError(`File too large: ${rawBuffer.byteLength} bytes`);
  }

  const image = sharp(rawBuffer);
  const metadata = await image.metadata();

  // Resize: cap at MAX_DIMENSION on longest side, preserve aspect ratio
  const resized = image.resize({
    width: limits.MAX_DIMENSION,
    height: limits.MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  });

  // Always output PNG — VTracer needs PNG
  const pngBuffer = await resized.png({ compressionLevel: 6 }).toBuffer();

  const outMeta = await sharp(pngBuffer).metadata();

  const format: NormalizeOutput['analysis']['format'] =
    metadata.format === 'jpeg'
      ? 'jpg'
      : metadata.format === 'png' ||
          metadata.format === 'webp' ||
          metadata.format === 'gif' ||
          metadata.format === 'svg'
        ? metadata.format
        : 'png';

  return {
    pngBuffer,
    analysis: {
      originalWidth: metadata.width ?? 0,
      originalHeight: metadata.height ?? 0,
      normalizedWidth: outMeta.width ?? 0,
      normalizedHeight: outMeta.height ?? 0,
      hasTransparency: metadata.hasAlpha ?? false,
      estimatedColorCount: 0, // filled by posterize stage
      format,
      fileSizeBytes: rawBuffer.byteLength,
    },
  };
}
