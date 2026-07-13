/** Client-side display formatting helpers — no business logic, just text. */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Counts the color-group <g> wrappers the code-based structurer
 *  (lib/stages/repair.ts, item 11) emits — this is what the UI calls
 *  "layers" since that's the closest real structural analog in the SVG. */
export function countLayers(svg: string): number {
  const matches = svg.match(/<g\b/g);
  return matches ? matches.length : 0;
}
