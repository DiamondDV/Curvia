/**
 * VTracer CLI parameters, tuned for tracing an already-posterized
 * (4-8 flat colors) PNG. Because the input is flat, aggressive speckle
 * filtering and a coarse corner threshold still produce clean paths —
 * the posterize stage is what makes these defaults viable.
 */
export const vtracerConfig = {
  filterSpeckle: 4, // discard specks smaller than N px
  colorPrecision: 6, // bits per channel when clustering colors
  cornerThreshold: 60, // degrees; higher = smoother corners
  lengthThreshold: 4.0, // minimum segment length
  pathPrecision: 3, // decimal places in path data
} as const;
