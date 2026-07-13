import type { RepairInput, RepairOutput } from '@/types/stages';
import type { GeminiClient } from '@/lib/ai/gemini';
import { StageError } from '@/lib/utils/errors';
import { logger } from '@/lib/pipeline/logger';
import { parseXml, type XmlNode, type XmlElement, type XmlText } from '@rgrove/parse-xml';

// ─── Code-based SVG Structurer ────────────────────────────────────────────
//
// Previously this stage called Gemini to re-emit the entire SVG with minor
// structural additions. That was architecturally wrong: an LLM is a poor
// tool for verbatim XML restructuring — high latency, high token cost, and
// truncation failures on any SVG larger than ~80KB because every path
// coordinate had to be re-emitted as output tokens just to add <g> wrappers.
//
// This replaces that with a deterministic code transform using the same
// @rgrove/parse-xml parser already used in lib/svg/validator.ts:
//
//  1. Parse → typed AST
//  2. Remove zero-area / empty paths
//  3. Remove exact-duplicate paths (identical d= strings)
//  4. Remove background-flood paths (fills palette[0], covers >80% viewBox)
//  5. Group <path> elements by fill color → <g id="color-N"> + <title>
//  6. Assign sequential path-N IDs
//  7. Rebuild well-formed SVG string with xmlns + viewBox preserved exactly
//
// No LLM call. No token budget. Runs in <5ms on any SVG size.
// GeminiClient is kept in the signature so the orchestrator doesn't need
// to change, but it is never called here.

export async function repair(
  input: RepairInput,
  _gemini: GeminiClient,
  _signal: AbortSignal,
): Promise<RepairOutput> {
  const { svgRaw, palette } = input;

  try {
    const result = structureSVG(svgRaw, palette);
    logger.info('SVG structured', {
      inputPaths: result.stats.inputPaths,
      outputPaths: result.stats.outputPaths,
      removed: result.stats.removed,
      groups: result.stats.groups,
    });
    return {
      svgRepaired: result.svg,
      changesSummary: result.summary,
    };
  } catch (err) {
    // If our parser chokes on malformed input, pass the raw SVG through
    // unchanged — SVGO will still run and may be able to handle it.
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('SVG structuring failed — passing raw SVG through', { error: msg });
    return {
      svgRepaired: svgRaw,
      changesSummary: `Structuring skipped (parse error): ${msg}`,
    };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

interface StructureResult {
  svg: string;
  summary: string;
  stats: {
    inputPaths: number;
    outputPaths: number;
    removed: number;
    groups: number;
  };
}

interface PathInfo {
  d: string;
  fill: string;
  attrs: Record<string, string>; // all attributes except id, d, fill
}

// ─── Main transform ───────────────────────────────────────────────────────

function structureSVG(svgRaw: string, palette: string[]): StructureResult {
  // Parse
  let doc;
  try {
    doc = parseXml(svgRaw);
  } catch (e) {
    throw new StageError('repairing', `XML parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const root = doc.children.find(
    (n): n is XmlElement => n.type === 'element' && (n as XmlElement).name === 'svg',
  );
  if (!root) throw new StageError('repairing', 'No <svg> root element found');

  // Preserve root attributes exactly (viewBox, xmlns, width, height, etc.)
  const rootAttrs: Record<string, string> = { ...(root.attributes ?? {}) };
  // Ensure xmlns is present
  if (!rootAttrs['xmlns']) rootAttrs['xmlns'] = 'http://www.w3.org/2000/svg';

  // Parse viewBox for background-flood detection
  const viewBox = rootAttrs['viewBox'];
  const vb = viewBox ? parseViewBox(viewBox) : null;

  // Collect all <path> elements from anywhere in the tree (VTracer emits
  // a flat list; nesting level doesn't matter here)
  const allPaths = collectPaths(root);
  const inputPaths = allPaths.length;

  // ── Step 1: remove zero-area / empty paths ────────────────────────────
  const nonEmpty = allPaths.filter((p) => !isEmptyPath(p.d));

  // ── Step 2: remove exact duplicates (same d= string) ─────────────────
  const seen = new Set<string>();
  const deduplicated = nonEmpty.filter((p) => {
    if (seen.has(p.d)) return false;
    seen.add(p.d);
    return true;
  });

  // ── Step 3: remove background-flood paths ────────────────────────────
  // A path whose fill matches the first palette color (the background) and
  // whose bounding box covers >80% of the viewBox area is almost certainly
  // a solid background rectangle — removing it produces a cleaner SVG.
  const bgColor = palette[0] ? normalizeHex(palette[0]) : null;
  const filtered = deduplicated.filter((p) => {
    if (!bgColor || !vb) return true;
    if (normalizeHex(p.fill) !== bgColor) return true;
    // Cheap bounding-box estimate from path bounds
    const bounds = estimatePathBounds(p.d, vb);
    if (!bounds) return true;
    const pathArea = bounds.w * bounds.h;
    const vbArea = vb.w * vb.h;
    return vbArea === 0 || pathArea / vbArea <= 0.80;
  });

  const removed = inputPaths - filtered.length;

  // ── Step 4: group by fill ─────────────────────────────────────────────
  const groups = new Map<string, PathInfo[]>();
  for (const p of filtered) {
    const key = normalizeHex(p.fill) || 'no-fill';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  // ── Step 5: build output SVG ──────────────────────────────────────────
  let pathIndex = 0;
  let groupIndex = 0;
  const groupBlocks: string[] = [];

  for (const [fillKey, paths] of groups) {
    groupIndex++;
    const pathEls = paths.map((p) => {
      pathIndex++;
      const id = `path-${pathIndex}`;
      const extraAttrs = Object.entries(p.attrs)
        .map(([k, v]) => `${k}="${escapeXml(v)}"`)
        .join(' ');
      const extraStr = extraAttrs ? ` ${extraAttrs}` : '';
      return `    <path id="${id}" fill="${escapeXml(p.fill)}" d="${escapeXml(p.d)}"${extraStr}/>`;
    });

    const label = fillKey === 'no-fill' ? 'unfilled' : fillKey;
    const block = [
      `  <g id="color-${groupIndex}">`,
      `    <title>${escapeXml(label)}</title>`,
      ...pathEls,
      `  </g>`,
    ].join('\n');
    groupBlocks.push(block);
  }

  const rootAttrStr = Object.entries(rootAttrs)
    .map(([k, v]) => `${k}="${escapeXml(v)}"`)
    .join(' ');

  const svgOut = [
    `<svg ${rootAttrStr}>`,
    ...groupBlocks,
    `</svg>`,
  ].join('\n');

  const summary =
    `Structured: ${inputPaths} paths in → ${pathIndex} paths out ` +
    `(${removed} removed, ${groupIndex} color groups)`;

  return {
    svg: svgOut,
    summary,
    stats: { inputPaths, outputPaths: pathIndex, removed, groups: groupIndex },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function isElement(node: XmlNode): node is XmlElement {
  return node.type === 'element';
}

/** Recursively collect all <path> elements, extracting their key attributes. */
function collectPaths(node: XmlElement): PathInfo[] {
  const results: PathInfo[] = [];

  function walk(n: XmlNode): void {
    if (!isElement(n)) return;
    if (n.name === 'path') {
      const attrs = { ...(n.attributes ?? {}) };
      const d = attrs['d'] ?? '';
      const fill = attrs['fill'] ?? 'black';
      // Everything except d and fill goes into extra attrs (e.g. opacity)
      delete attrs['d'];
      delete attrs['fill'];
      delete attrs['id']; // IDs will be reassigned
      results.push({ d, fill, attrs });
    }
    n.children.forEach(walk);
  }

  walk(node);
  return results;
}

/** A path is empty/zero-area if its d string is blank, a bare M command, or M0 0. */
function isEmptyPath(d: string): boolean {
  const trimmed = d.trim();
  if (!trimmed) return true;
  // Only a moveto with no drawing commands
  if (/^[Mm]\s*[\d.,\s-]+$/.test(trimmed)) return true;
  // Degenerate M0 0 or M 0,0
  if (/^[Mm]\s*0[,\s]+0\s*$/.test(trimmed)) return true;
  return false;
}

interface ViewBox { x: number; y: number; w: number; h: number }

function parseViewBox(vb: string): ViewBox | null {
  const parts = vb.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return { x: parts[0]!, y: parts[1]!, w: parts[2]!, h: parts[3]! };
}

/** Very cheap bounding-box estimate: scan M/L/C/Q/A coordinate pairs for min/max. */
function estimatePathBounds(d: string, vb: ViewBox): { w: number; h: number } | null {
  // Extract all numbers from the d string
  const nums = (d.match(/-?[\d.]+(?:e[+-]?\d+)?/gi) ?? []).map(Number).filter((n) => !isNaN(n));
  if (nums.length < 2) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  // Treat pairs as x,y coordinate candidates (rough approximation)
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i]!;
    const y = nums[i + 1]!;
    // Clamp to reasonable range relative to viewBox to skip arc flags etc.
    if (x < vb.x - vb.w || x > vb.x + vb.w * 2) continue;
    if (y < vb.y - vb.h || y > vb.y + vb.h * 2) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (!isFinite(minX)) return null;
  return { w: maxX - minX, h: maxY - minY };
}

/** Normalize hex to lowercase 6-digit form for comparison. */
function normalizeHex(color: string): string {
  if (!color) return '';
  const c = color.trim().toLowerCase();
  // Expand shorthand #abc → #aabbcc
  if (/^#[0-9a-f]{3}$/.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  return c;
}

/** Escape the five XML special characters for attribute values and text. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
