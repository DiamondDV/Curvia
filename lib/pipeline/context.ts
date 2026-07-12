import type { GeminiClient } from '@/lib/ai/gemini';

/**
 * Bundles everything a pipeline run needs that isn't stage-specific data:
 * identity, cancellation, and the AI client. Passed once into the
 * orchestrator rather than threaded through every stage call individually.
 */
export interface PipelineContext {
  jobId: string;
  colorCount: number;
  gemini: GeminiClient;
  signal: AbortSignal;
}
