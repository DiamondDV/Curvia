import Quantize from 'quantize';

export type RGB = [number, number, number];

/**
 * Thin wrapper around the `quantize` package (median-cut, pure JS —
 * no native deps). Returns a palette of up to `colorCount` RGB triples.
 */
export function buildPalette(pixels: RGB[], colorCount: number): RGB[] {
  if (pixels.length === 0) return [[255, 255, 255]];
  const colorMap = Quantize(pixels, colorCount);
  if (!colorMap) return [[255, 255, 255]];
  return colorMap.palette() as RGB[];
}

/** Nearest palette color by squared Euclidean distance in RGB space. */
export function nearestColor(color: RGB, palette: RGB[]): RGB {
  let nearest = palette[0]!;
  let minDist = Infinity;
  for (const candidate of palette) {
    const dist =
      (color[0] - candidate[0]) ** 2 +
      (color[1] - candidate[1]) ** 2 +
      (color[2] - candidate[2]) ** 2;
    if (dist < minDist) {
      minDist = dist;
      nearest = candidate;
    }
  }
  return nearest;
}

export function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
