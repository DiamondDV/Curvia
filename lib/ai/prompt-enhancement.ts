/**
 * Prompt enhancement for vector-friendly image generation.
 *
 * The issue: when users provide a natural-language prompt (e.g., "a dog"),
 * Pollinations' Flux model generates high-quality, photorealistic, gradient-heavy
 * images with fine detail — exactly what you DON'T want for SVG vectorization.
 *
 * Vectorization works best on images with:
 * - Flat colors (no gradients)
 * - Clear, distinct color regions
 * - Bold, clean outlines
 * - Simple geometric shapes
 * - Limited color palette (4-8 colors naturally)
 * - High contrast
 *
 * This function transforms user prompts to request these properties,
 * steering Flux toward illustration/cartoon/poster art style instead
 * of photorealism.
 */

export function enhancePromptForVectorization(userPrompt: string): string {
  // Strip any existing style keywords the user may have added
  // (we'll replace with our own vector-friendly ones)
  let cleaned = userPrompt
    .replace(/\b(photorealistic|ultra detailed|4k|8k|hd|high quality|cinematic)\b/gi, '')
    .replace(/\b(with shadows|with gradients|with depth|complex|intricate)\b/gi, '')
    .trim();

  // Remove trailing punctuation for cleaner concatenation
  if (cleaned.endsWith(',') || cleaned.endsWith('.')) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  // Core instruction set for vectorization-friendly output
  const vectorInstructions = [
    'vector art style',
    'flat colors',
    'bold outlines',
    'no gradients',
    'simple shapes',
    'cartoon',
    'illustration',
    'limited color palette',
    'high contrast',
    'clear regions',
  ];

  // Build enhanced prompt
  // Format: "[original subject], [style descriptors]. Instruction: [key requirements]"
  const enhanced = [
    `${cleaned},`,
    `${vectorInstructions.slice(0, 5).join(', ')},`,
    `${vectorInstructions.slice(5).join(', ')}.`,
    'No photorealism, no gradients, no complex details.',
    'Optimize for vector tracing: flat colors, bold lines, simple geometry.',
  ].join(' ');

  return enhanced;
}

/**
 * Alternative, more aggressive version if the default doesn't work well.
 * Forces very strict style constraints.
 */
export function enhancePromptForVectorizationStrict(userPrompt: string): string {
  let cleaned = userPrompt
    .replace(/\b(photorealistic|ultra detailed|4k|8k|hd|high quality|cinematic|realistic|detailed|complex|intricate)\b/gi, '')
    .trim();

  if (cleaned.endsWith(',') || cleaned.endsWith('.')) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  // Very strict: essentially a poster/sticker aesthetic
  return [
    `${cleaned}.`,
    'Style: minimalist vector poster, flat design, sticker art.',
    'Colors: use exactly 4-8 distinct, bold, saturated colors.',
    'No gradients, no shadows, no anti-aliasing blur.',
    'Sharp edges, clear outlines, geometric shapes only.',
    'High contrast. Suitable for immediate SVG tracing.',
  ].join(' ');
}
