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
  JOB_TTL_MS: 60 * 60 * 1000, // 1 hour

  /** No longer used for Gemini repair (which has been replaced by the
   *  code-based SVG structurer in lib/stages/repair.ts). Kept here as
   *  a named constant in case a future LLM stage needs a size guard.
   *  At 500KB it's effectively a no-op bypass.
   */
  MAX_REPAIR_INPUT_BYTES: 500 * 1024,
} as const;
