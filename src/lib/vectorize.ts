// Fast, fully client-side vectorization using imagetracerjs.
//
// KEY FIX — white gaps/cuts between color regions: ImageTracerJS traces
// each color as its own independent, non-overlapping shape. Anti-aliased
// boundary pixels between two colors often get assigned to neither shape,
// leaving a razor-thin sliver where the page background shows through. This
// is the classic "white cracks" artifact in multi-color raster tracing.
// The fix is to give every traced shape a stroke that exactly matches its
// own fill color — the stroke expands each shape by half a pixel in every
// direction, physically sealing the seam against its neighbor without
// changing the visible color anywhere.
//
// KEY FIX — colors not matching the source: more color buckets
// (numberofcolors) with a low mincolorratio keeps subtle shading bands
// distinct instead of collapsing them into a handful of flat blocks.
//
// KEY FIX — jagged curves: low ltres/qtres forces tight curve fitting, and
// normalizing every source image to a consistent, reasonably large working
// resolution (upscaling small sources, downscaling huge ones) gives the
// tracer enough sample points to fit smooth curves instead of blocky ones.
import ImageTracerModule from "imagetracerjs";

export type VectorizeSettings = {
  removeBackground: boolean;
};

export type VectorizeResult = {
  svg: string;
  paths: number;
  groups: number;
  width: number;
  height: number;
  palette: string[];
  detectedColors: number;
  duration: number;
};

type ImageTracerApi = {
  imageToSVG: (url: string, callback: (svg: string) => void, options: Record<string, unknown>) => void;
  imagedataToSVG: (image: ImageData, options: Record<string, unknown>) => string;
};

const ImageTracer = ImageTracerModule as ImageTracerApi;
const waitForPaint = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// Tuned for high color fidelity (enough buckets to capture soft shading
// bands) and smooth curves.
//
// ltres/qtres control how tightly the fitted line/curve must hug the raw
// pixel boundary. Very low values (like the 0.35 used previously) force the
// fitter to follow every single-pixel staircase step exactly, which is what
// produces the jagged zig-zag look on corners and diagonal edges once you
// zoom in. Raising them lets the fitter skip over that pixel-level noise and
// draw one smooth curve/line through the general shape of the edge instead.
const TRACE_OPTIONS: Record<string, number | boolean> = {
  numberofcolors: 24,
  mincolorratio: 0.006,
  colorquantcycles: 5,
  pathomit: 6,
  blurradius: 2,
  blurdelta: 18,
  ltres: 1.2,
  qtres: 1.2,
  rightangleenhance: false,
  strokewidth: 0,
};

// Normalize every source to a consistent working resolution: downscale huge
// images for speed, but also UPSCALE small ones. More pixels along an edge
// means more sample points for the curve fitter, which is what actually
// produces smooth curves instead of blocky, low-resolution ones.
const TARGET_LONG_SIDE = 1100;

function loadImageData(blob: Blob): Promise<ImageData> {
  return createImageBitmap(blob).then((bitmap) => {
    const scale = TARGET_LONG_SIDE / Math.max(bitmap.width, bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // No manual filter here — ImageTracer's own blurradius/blurdelta handles
    // all smoothing. Drawing the source as-is keeps colors true to the
    // original instead of muddying them with a second, uncoordinated blur.
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return ctx.getImageData(0, 0, width, height);
  });
}

// Conservative background removal: cut the dominant corner color to
// transparent. Kept fairly strict so it never eats legitimate light colors
// (like soft shadows or pale highlights) that happen to be near-white.
function removeBackgroundInPlace(image: ImageData) {
  const w = image.width;
  const h = image.height;
  const total = w * h;
  const samples = [0, w - 1, (h - 1) * w, total - 1];

  const freq = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (const p of samples) {
    const o = p * 4;
    if (image.data[o + 3] < 20) continue;
    const key = `${image.data[o] >> 3},${image.data[o + 1] >> 3},${image.data[o + 2] >> 3}`;
    const current = freq.get(key) || { r: image.data[o], g: image.data[o + 1], b: image.data[o + 2], count: 0 };
    current.count += 1;
    freq.set(key, current);
  }

  let bg = { r: 255, g: 255, b: 255 };
  let best = 0;
  for (const value of freq.values()) {
    if (value.count > best) {
      best = value.count;
      bg = value;
    }
  }

  for (let i = 0; i < total; i += 1) {
    const o = i * 4;
    const dr = image.data[o] - bg.r;
    const dg = image.data[o + 1] - bg.g;
    const db = image.data[o + 2] - bg.b;
    if (dr * dr + dg * dg + db * db < 220 && image.data[o + 3] > 15) {
      image.data[o + 3] = 0;
    }
  }
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function normalizeHex(fill: string) {
  const nums = fill.match(/\d+(?:\.\d+)?/g);
  if (nums && nums.length >= 3) {
    return `#${nums
      .slice(0, 3)
      .map((n) => Math.round(Number(n)).toString(16).padStart(2, "0"))
      .join("")}`.toUpperCase();
  }
  if (fill.startsWith("#")) return fill.toUpperCase();
  return "#000000";
}

function colorName(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[0-9A-F]{6}$/.test(value)) return "Color";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max - min < 20) {
    if (lightness > 232) return "White";
    if (lightness > 168) return "Light";
    if (lightness < 52) return "Ink";
    return "Gray";
  }
  const hue = max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  const degrees = hue * 60;
  if (degrees < 22 || degrees >= 338) return "Red";
  if (degrees < 52) return "Orange";
  if (degrees < 78) return "Yellow";
  if (degrees < 172) return "Green";
  if (degrees < 208) return "Cyan";
  if (degrees < 262) return "Blue";
  if (degrees < 298) return "Purple";
  return "Magenta";
}

// Expand each path's d string into a path-data token list so we can find
// the true bounding box of the traced region (not just the path's
// coordinate string extent, which would miss rounding / arc segments).
function pathBoundingBox(d: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const nums: number[] = [];
  const re = /-?\d*\.?\d+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) nums.push(parseFloat(match[0]));
  if (nums.length < 2) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  return { minX, minY, maxX, maxY };
}

// Group ImageTracerJS's flat list of colored <path> elements into named,
// editable color-layer <g> groups.
//
// KEY FIX — one path per color region (no more visible blobs when zoomed):
// ImageTracerJS emits many separate <path> elements per color (one for the
// outer boundary, one per hole, one per disconnected fragment, etc). Each
// one used to get its own stroke, and those strokes' round caps stacked up
// at every endpoint creating pill/blob artifacts. We now concatenate all
// same-color d strings into ONE unified <path> per color, exactly like
// Illustrator / other pro vectorizers do.
//
// KEY FIX — invisible seam sealing (no more caps/joins showing):
// The seam-sealing stroke now uses paint-order="stroke fill" with butt
// caps and miter joins. This draws the fill ON TOP of the stroke, so the
// stroke only shows in the sub-pixel gap between adjacent colors. There
// are no visible caps, no visible joins, no blobs — just clean edges that
// happen to overlap invisibly with their neighbors.
function structureSvg(rawSvg: string, removeBackground: boolean) {
  const doc = new DOMParser().parseFromString(rawSvg, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("The tracer produced invalid SVG data.");

  const root = doc.documentElement;
  const viewBox = root.getAttribute("viewBox")?.split(/\s+/).map(Number);
  const width = viewBox?.[2] || Number(root.getAttribute("width")) || 1024;
  const height = viewBox?.[3] || Number(root.getAttribute("height")) || 1024;

  // Sub-pixel stroke width. paint-order draws the fill on top, so this
  // stroke only shows where fills would otherwise leave a gap — it just
  // has to be wide enough to bridge the sub-pixel crack (~0.5-1px).
  const strokeWidth = Math.max(0.6, Math.round((Math.min(width, height) / 1400) * 100) / 100);

  const paths = Array.from(doc.querySelectorAll("path"));
  const layers = new Map<string, string[]>();

  for (const path of paths) {
    const d = path.getAttribute("d") || "";
    if (!d) continue;
    const hex = normalizeHex(path.getAttribute("fill") || "#000000");
    const opacity = parseFloat(path.getAttribute("opacity") || "1");
    // Drop near-transparent traced paths when background removal is on.
    if (removeBackground && opacity < 0.15) continue;
    const list = layers.get(hex) || [];
    list.push(d);
    layers.set(hex, list);
  }

  const palette: string[] = [];
  const layerMarkup: string[] = [];
  let layerNumber = 1;

  // Tolerance for treating a bounding-box edge as "touching" the viewBox.
  // 1.5px is well above any sub-pixel roundoff from path coordinates.
  const edgeTolerance = 1.5;

  layers.forEach((pathList, hex) => {
    palette.push(hex);
    const label = `${colorName(hex)} ${hex}`;
    const layerId = `color-layer-${String(layerNumber).padStart(2, "0")}`;

    // Merge every same-color subpath into a single d string. Each original
    // subpath already starts with M and ends with Z, so simple concatenation
    // yields a valid compound path — one shape from the browser's POV.
    const mergedD = pathList.map((d) => d.trim()).join(" ").trim();

    // KEY FIX — close half-cut shapes: if the traced region is cut by the
    // edge of the source image (e.g. a half-circle at the bottom), the
    // SVG should still look like a complete shape, not a sliced one. We
    // detect this by checking whether the merged path's bounding box touches
    // one or more viewBox edges, then prepend a background rectangle
    // covering the missing part of the viewBox in that same color. The
    // traced shape itself is drawn on top, so the rectangle acts only as a
    // fill-behind that completes the cut.
    const bbox = pathBoundingBox(mergedD);
    let backgroundRect = "";
    if (bbox) {
      const touchesLeft = bbox.minX <= edgeTolerance;
      const touchesTop = bbox.minY <= edgeTolerance;
      const touchesRight = bbox.maxX >= width - edgeTolerance;
      const touchesBottom = bbox.maxY >= height - edgeTolerance;

      if (touchesLeft || touchesTop || touchesRight || touchesBottom) {
        // The "missing" area is the full viewBox minus the bounding box
        // region. Drawing that area as a solid rectangle in the same color
        // means the cut-off shape stays its cut-off shape (on top), but the
        // surrounding canvas is now filled in too — completing the cut
        // shape, e.g. a half-circle at the bottom becomes a full circle
        // sitting on a colored background.
        const rectX = touchesLeft ? 0 : bbox.minX;
        const rectY = touchesTop ? 0 : bbox.minY;
        const rectW = touchesLeft ? width : (touchesRight ? width - bbox.minX : bbox.maxX - bbox.minX);
        const rectH = touchesTop ? height : (touchesBottom ? height - bbox.minY : bbox.maxY - bbox.minY);
        backgroundRect =
          `    <path id="${layerId}-fill" data-element-name="${escapeAttribute(label)} background fill" d="M${rectX} ${rectY}h${rectW}v${rectH}h${-rectW}Z">\n` +
          `      <title>${label} background fill</title>\n` +
          `    </path>\n`;
      }
    }

    const pathId = `${layerId}-path`;
    const title = `${label} shape`;
    const inner =
      `    <path id="${pathId}" data-element-name="${escapeAttribute(title)}" d="${escapeAttribute(mergedD)}">\n` +
      `      <title>${title}</title>\n` +
      `    </path>\n` +
      backgroundRect;

    // stroke-linejoin="round" instead of "miter": on a zig-zag or sharp
    // corner, a miter join projects a sharp spike outward that can peek out
    // past the fill and exaggerate the jagged look. A round join keeps every
    // corner smooth while still being sub-pixel thin and invisible under the
    // fill (paint-order draws the fill on top).
    layerMarkup.push(
      `  <g id="${layerId}" data-layer-name="${escapeAttribute(label)} shape" fill="${hex}" stroke="${hex}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill" fill-rule="nonzero">\n    <title>${label} shape</title>\n${inner}  </g>`,
    );
    layerNumber += 1;
  });

  const totalPaths = layerMarkup.length;

  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="geometricPrecision" role="img" aria-labelledby="vector-title vector-description" data-generator="Curvia ImageTracer">`,
    `  <title id="vector-title">Editable vector artwork</title>`,
    `  <desc id="vector-description">Traced with imagetracerjs, one unified path per color, seam-sealed with paint-order stroke.</desc>`,
    `  <metadata>Every color layer contains one merged path with a stable editor label.</metadata>`,
    ...layerMarkup,
    `</svg>`,
  ].join("\n");

  return { svg, paths: totalPaths, groups: layerMarkup.length, palette, width, height };
}

export async function vectorizeImage(
  blob: Blob,
  settings: VectorizeSettings,
  onProgress?: (progress: number, label: string) => void,
): Promise<VectorizeResult> {
  const started = performance.now();

  onProgress?.(25, "Loading image");
  const image = await loadImageData(blob);
  await waitForPaint();

  if (settings.removeBackground) {
    onProgress?.(40, "Removing background");
    removeBackgroundInPlace(image);
    await waitForPaint();
  }

  onProgress?.(58, "Vectorizing with ImageTracer (24 colors)");
  await waitForPaint();

  // Let ImageTracerJS do all color reduction + smoothing via the config.
  const rawSvg = ImageTracer.imagedataToSVG(image, {
    ...TRACE_OPTIONS,
    viewbox: true,
    scale: 1,
    roundcoords: 2,
    linefilter: true,
    colorsampling: 2,
  });

  onProgress?.(88, "Sealing seams and structuring editable SVG");
  await waitForPaint();
  const structured = structureSvg(rawSvg, settings.removeBackground);

  onProgress?.(100, "Vector ready");

  return {
    svg: structured.svg,
    paths: structured.paths,
    groups: structured.groups,
    width: structured.width,
    height: structured.height,
    palette: structured.palette,
    detectedColors: structured.palette.length,
    duration: performance.now() - started,
  };
}
