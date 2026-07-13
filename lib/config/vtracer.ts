/**
 * VTracer CLI parameters, tuned for tracing an already-posterized
 * (4-8 flat colors, or adaptively up to 12 for complex images) PNG.
 * Because the input is flat-color or near-flat-color, aggressive speckle
 * filtering and low corner thresholds still produce clean paths.
 *
 * FIX (Jan 2026, round 2): Further retuned after prompt enhancement and
 * adaptive color count were added. The new flow is:
 *  1. User prompt is enhanced to request vector-friendly output
 *  2. Posterizer detects complexity and adaptively increases colors if needed
 *  3. VTracer parameters now optimized for this flow
 *
 * Adjusted parameters:
 * - filterSpeckle: 6 → 8 (even more aggressive on noise, compensates for
 *   removed median filter)
 * - cornerThreshold: 50 → 45 (sharper corners for crisp detail, reduced
 *   over-smoothing)
 * - lengthThreshold: 2.5 → 2.0 (finer segments to capture small features)
 * - pathPrecision: 4 → 5 (5 decimal places for sub-pixel accuracy)
 *
 * FIX (Jul 2026): lengthThreshold: 2.0 → 4.0. The 2.0 value above was never
 * legal for this VTracer build — it maps directly to the `--segment_length`
 * CLI flag (see lib/stages/trace.ts), which this binary hard-rejects outside
 * [3.5, 10]: `Out of Range Error: Segment length is invalid at 2. It must be
 * within [3.5,10].` (exit code 101, confirmed by running the bundled
 * bin/vtracer directly against a test PNG with both values). The "round 2"
 * tuning pass evidently never actually invoked VTracer with this value.
 * 4.0 is used instead of the bare floor (3.5) for a small safety margin
 * against any float-boundary rejection.
 */
export const vtracerConfig = {
  filterSpeckle: 8,        // discard specks smaller than N px (was 6, now more aggressive)
  colorPrecision: 6,       // bits per channel when clustering colors (unchanged)
  cornerThreshold: 45,     // degrees; higher = smoother (was 50, lowered further for crispness)
  lengthThreshold: 4.0,    // minimum segment length; legal range for this VTracer build is [3.5, 10] — 2.0 crashed it
  pathPrecision: 5,        // decimal places in path data (was 4, increased for precision)
} as const;
