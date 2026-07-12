export const limits = {
  /** Reject uploads larger than this (bytes). */
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB

  /** Cap the longest side at this many pixels during normalize. */
  MAX_DIMENSION: 2048,

  /** Allowed posterize color counts (exposed in the UI). */
  ALLOWED_COLOR_COUNTS: [4, 6, 8] as const,
  DEFAULT_COLOR_COUNT: 6,

  /** In-process worker queue cap (see lib/pipeline/worker.ts). */
  MAX_CONCURRENT_JOBS: Number(process.env.MAX_CONCURRENT_JOBS ?? 20),

  /** Job result retention window. */
  JOB_TTL_MS: 60 * 60 * 1000, // 1 hour, not 24h

  /** If VTracer's raw SVG exceeds this, skip the Gemini repair stage.
   *  This is NOT about Gemini's input context (1M tokens, effectively
   *  unlimited for our SVGs) — it's about the OUTPUT budget.
   *  lib/ai/gemini.ts caps maxOutputTokens at 65536, and Gemini has to
   *  write the entire repaired SVG back out as output tokens. SVG path
   *  data (long runs of numeric coordinates) tokenizes at roughly
   *  1 token per 2-3 chars, worse than normal prose (~4 chars/token).
   *  At 65536 output tokens that's a practical ceiling around
   *  150-200KB of repaired SVG text. Previously this was set to 500KB
   *  based on the input-context budget, which meant complex/high-color
   *  traces (e.g. 8-color posterize on a busy image) could sail past
   *  the skip check and then hit MAX_TOKENS mid-response instead of
   *  gracefully skipping repair. 150KB leaves headroom since the
   *  repaired output can run slightly longer than the raw input
   *  (added inkscape:label / namespace attributes, etc).
   */
  MAX_REPAIR_INPUT_BYTES: 150 * 1024,
} as const;
