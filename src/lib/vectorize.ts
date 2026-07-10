import ImageTracerModule from "imagetracerjs";

export type VectorizeSettings = {
  colors: number;
  detail: number;
  smoothing: number;
  removeBackground: boolean;
};

export type VectorizeResult = {
  svg: string;
  paths: number;
  groups: number;
  width: number;
  height: number;
  palette: string[];
  duration: number;
};

type PaletteColor = { r: number; g: number; b: number; a: number };

type QuantizeOptions = {
  pal?: PaletteColor[];
  colorsampling: number;
  numberofcolors: number;
  mincolorratio: number;
  colorquantcycles: number;
  blurradius: number;
  blurdelta: number;
};

type ImageTracerApi = {
  imagedataToSVG: (image: ImageData, options: Record<string, unknown>) => string;
  colorquantization: (image: ImageData, options: QuantizeOptions) => { array: number[][]; palette: PaletteColor[] };
};

const ImageTracer = ImageTracerModule as ImageTracerApi;
const waitForPaint = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function loadImageData(blob: Blob) {
  return createImageBitmap(blob).then((bitmap) => {
    const maximum = 1024;
    const scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser could not create an image canvas.");

    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return context.getImageData(0, 0, width, height);
  });
}

function removeBackgroundImage(image: ImageData) {
  const width = image.width;
  const height = image.height;
  const totalPixels = width * height;

  const samples = [
    0,
    width - 1,
    (height - 1) * width,
    totalPixels - 1,
    Math.floor(width / 2),
    (height - 1) * width + Math.floor(width / 2),
    Math.floor(height / 2) * width,
    Math.floor(height / 2) * width + width - 1,
  ];

  const rgbCounts = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (const p of samples) {
    const offset = p * 4;
    if (image.data[offset + 3] < 10) continue;
    const r = image.data[offset];
    const g = image.data[offset + 1];
    const b = image.data[offset + 2];
    const key = `${Math.round(r / 16)},${Math.round(g / 16)},${Math.round(b / 16)}`;
    const current = rgbCounts.get(key) || { r: 0, g: 0, b: 0, count: 0 };
    current.r += r;
    current.g += g;
    current.b += b;
    current.count += 1;
    rgbCounts.set(key, current);
  }

  let dominant: { r: number; g: number; b: number; count: number } | null = null;
  for (const entry of rgbCounts.values()) {
    if (!dominant || entry.count > dominant.count) dominant = entry;
  }

  if (!dominant || dominant.count < 3) return;

  const bgR = Math.round(dominant.r / dominant.count);
  const bgG = Math.round(dominant.g / dominant.count);
  const bgB = Math.round(dominant.b / dominant.count);

  for (let p = 0; p < totalPixels; p += 1) {
    const offset = p * 4;
    const dr = image.data[offset] - bgR;
    const dg = image.data[offset + 1] - bgG;
    const db = image.data[offset + 2] - bgB;
    if (dr * dr + dg * dg + db * db < 650) {
      image.data[offset + 3] = 0;
    }
  }
}

// Every anti-aliased edge in a raster source is a thin band of blended pixels
// (between two real colors, or between a color and transparency). When color
// quantization runs, those blended pixels snap to whichever side they happen
// to be slightly closer to, and the result is a 1-pixel-wide zigzag along
// every diagonal edge. A 3x3 neighborhood vote is not enough to fix this: on
// a 45-degree edge a 3x3 window sees a 5-vs-4 split, which is essentially a
// coin flip per pixel, and the zigzag survives. A 5x5 window always contains
// a clear majority on one side of the edge, so diagonals become clean. We run
// the pass twice to absorb any 2-pixel-wide bands and any isolated speckles.
function despeckleIndices(
  source: number[][],
  width: number,
  height: number,
  paletteSize: number,
  passes: number,
  radius: number,
) {
  let current = source;
  const windowSide = radius * 2 + 1;

  for (let pass = 0; pass < passes; pass += 1) {
    const next: number[][] = current.map((row) => row.slice());
    const counts = new Int32Array(paletteSize);

    for (let y = radius; y <= height - radius + 1; y += 1) {
      for (let x = radius; x <= width - radius + 1; x += 1) {
        counts.fill(0);
        for (let dy = -radius; dy <= radius; dy += 1) {
          const row = current[y + dy];
          for (let dx = -radius; dx <= radius; dx += 1) {
            const value = row[x + dx];
            if (value >= 0 && value < paletteSize) counts[value] += 1;
          }
        }

        // Require a clear majority (more than half the window) to flip.
        // This preserves genuine thin strokes while killing AA bands.
        const threshold = Math.floor((windowSide * windowSide) / 2) + 1;
        let bestIndex = -1;
        let bestCount = 0;
        for (let candidate = 0; candidate < paletteSize; candidate += 1) {
          if (counts[candidate] > bestCount) {
            bestCount = counts[candidate];
            bestIndex = candidate;
          }
        }

        if (bestIndex >= 0 && bestCount >= threshold) {
          next[y][x] = bestIndex;
        }
      }
    }

    current = next;
  }

  return current;
}

function buildImageFromIndices(indices: number[][], palette: PaletteColor[], width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const colorIndex = indices[y + 1][x + 1];
      const color = palette[colorIndex] || { r: 255, g: 255, b: 255, a: 255 };
      const offset = (y * width + x) * 4;
      data[offset] = color.r;
      data[offset + 1] = color.g;
      data[offset + 2] = color.b;
      data[offset + 3] = color.a;
    }
  }
  return new ImageData(data, width, height);
}

function rgbToHex(fill: string) {
  const channels = fill.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) return fill.toUpperCase();
  return `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function hexToName(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[0-9A-F]{6}$/.test(value)) return "Color";
  const [r, g, b] = [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)].map((part) => parseInt(part, 16));
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max - min < 20) {
    if (lightness > 235) return "White";
    if (lightness > 175) return "Light neutral";
    if (lightness < 45) return "Ink";
    return "Neutral";
  }

  const hue =
    max === r
      ? ((g - b) / (max - min) + 6) % 6
      : max === g
        ? (b - r) / (max - min) + 2
        : (r - g) / (max - min) + 4;
  const degrees = hue * 60;
  if (degrees < 18 || degrees >= 345) return "Red";
  if (degrees < 48) return "Orange";
  if (degrees < 72) return "Yellow";
  if (degrees < 165) return "Green";
  if (degrees < 200) return "Cyan";
  if (degrees < 255) return "Blue";
  if (degrees < 290) return "Violet";
  return "Magenta";
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function structureSvg(rawSvg: string, width: number, height: number, removeBackground: boolean) {
  const documentNode = new DOMParser().parseFromString(rawSvg, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) throw new Error("The local tracer produced invalid SVG data.");
  const paths = Array.from(documentNode.querySelectorAll("path"));
  const layers = new Map<string, Array<{ d: string; opacity: string }>>();

  for (const path of paths) {
    const fill = rgbToHex(path.getAttribute("fill") || "#000000");
    const entries = layers.get(fill) || [];
    const opacity = parseFloat(path.getAttribute("opacity") || "1");
    if (removeBackground && opacity < 0.25) continue;
    entries.push({
      d: path.getAttribute("d") || "",
      opacity: path.getAttribute("opacity") || "1",
    });
    layers.set(fill, entries);
  }

  let totalPaths = 0;
  const layerMarkup = Array.from(layers.entries()).map(([fill, entries], layerIndex) => {
    const label = `${hexToName(fill)} ${fill}`;
    const pathMarkup = entries
      .filter((entry) => entry.d)
      .map((entry, pathIndex) => {
        totalPaths += 1;
        const id = `layer-${String(layerIndex + 1).padStart(2, "0")}-path-${String(pathIndex + 1).padStart(3, "0")}`;
        const title = `${label}, region ${pathIndex + 1}`;
        const opacity = entry.opacity !== "1" ? ` opacity="${escapeAttribute(entry.opacity)}"` : "";
        return `    <path id="${id}" data-element-name="${escapeAttribute(title)}" d="${escapeAttribute(entry.d)}"${opacity}>\n      <title>${title}</title>\n    </path>`;
      })
      .join("\n");
    return `  <g id="color-layer-${String(layerIndex + 1).padStart(2, "0")}" data-layer-name="${escapeAttribute(label)} shapes" fill="${fill}" fill-rule="nonzero">\n    <title>${label} shapes</title>\n${pathMarkup}\n  </g>`;
  });

  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="vector-title vector-description" data-generator="Curvia Local Trace">`,
    `  <title id="vector-title">Editable vector artwork</title>`,
    `  <desc id="vector-description">Locally traced artwork with named color groups and individually addressable paths.</desc>`,
    `  <metadata>Generated locally with Curvia color tracing. Every color layer and path includes a stable editor label.</metadata>`,
    ...layerMarkup,
    `</svg>`,
  ].join("\n");

  return {
    svg,
    paths: totalPaths,
    groups: layerMarkup.length,
    palette: Array.from(layers.keys()),
  };
}

export async function vectorizeImage(
  blob: Blob,
  settings: VectorizeSettings,
  onProgress?: (progress: number, label: string) => void,
): Promise<VectorizeResult> {
  const started = performance.now();
  onProgress?.(28, "Reading source pixels");
  const image = await loadImageData(blob);
  await waitForPaint();

  if (settings.removeBackground) {
    onProgress?.(36, "Removing background layers");
    removeBackgroundImage(image);
    await waitForPaint();
  }

  const smoothing = settings.smoothing;
  const detail = settings.detail;

  onProgress?.(46, "Quantizing clean color layers");
  await waitForPaint();
  const quantized = ImageTracer.colorquantization(image, {
    colorsampling: 2,
    numberofcolors: settings.colors,
    // A slightly higher ratio prunes colors that appear only in AA bands,
    // so the palette contains only real solid colors.
    mincolorratio: 0.003,
    colorquantcycles: 4,
    blurradius: 0,
    blurdelta: 20,
  });

  onProgress?.(62, "Cleaning anti-aliased edges");
  await waitForPaint();
  // Radius 2 = 5x5 window, 2 passes. This removes 1-2px AA bands on every edge
  // including diagonals, while keeping real thin strokes because the majority
  // threshold requires more than half the window to agree.
  const despeckleRadius = smoothing >= 4 ? 2 : smoothing >= 2 ? 2 : 1;
  const despecklePasses = smoothing >= 4 ? 3 : 2;
  const cleanedIndices = despeckleIndices(
    quantized.array,
    image.width,
    image.height,
    quantized.palette.length,
    despecklePasses,
    despeckleRadius,
  );
  const cleanedImage = buildImageFromIndices(cleanedIndices, quantized.palette, image.width, image.height);
  await waitForPaint();

  onProgress?.(80, "Tracing crisp vector paths");
  await waitForPaint();
  // qtres = quadratic spline fit tolerance. Lower = tighter, smoother curves.
  // ltres = line tolerance. Lower = smoother straight segments.
  // With a clean pre-quantized source, very low values produce buttery edges
  // without exploding path counts.
  const rawSvg = ImageTracer.imagedataToSVG(cleanedImage, {
    ltres: 0.05 + Math.max(0, 6 - detail) * 0.05,
    qtres: 0.05 + Math.max(0, 6 - smoothing) * 0.05,
    pathomit: Math.max(6, 14 - detail * 2),
    rightangleenhance: false,
    pal: quantized.palette,
    colorsampling: 0,
    numberofcolors: quantized.palette.length,
    mincolorratio: 0,
    colorquantcycles: 1,
    layering: 0,
    strokewidth: 0,
    linefilter: true,
    scale: 1,
    roundcoords: 2,
    viewbox: true,
    desc: false,
    blurradius: 0,
    blurdelta: 0,
  });

  onProgress?.(93, "Labelling editable paths");
  await waitForPaint();
  const structured = structureSvg(rawSvg, image.width, image.height, settings.removeBackground);
  onProgress?.(100, "Vector ready");

  return {
    ...structured,
    width: image.width,
    height: image.height,
    duration: performance.now() - started,
  };
}
