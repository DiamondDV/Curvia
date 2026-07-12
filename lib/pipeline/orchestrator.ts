import { store } from './store';
import type { PipelineContext } from './context';
import { logger } from './logger';
import { normalize } from '@/lib/stages/normalize';
import { posterize } from '@/lib/stages/posterize';
import { trace } from '@/lib/stages/trace';
import { repair } from '@/lib/stages/repair';
import { optimizeSVG } from '@/lib/stages/optimize';
import { validateSVG } from '@/lib/svg/validator';
import { StageError, CancelledError } from '@/lib/utils/errors';
import type { JobStatus } from '@/types/pipeline';

export async function runPipeline(
  rawBuffer: Buffer,
  mimeType: string,
  ctx: PipelineContext,
): Promise<void> {
  const { jobId, colorCount, gemini, signal } = ctx;

  const progress = (stage: JobStatus, subProgress: number, subStatus: string) => {
    store.update(jobId, stage, { status: 'running', subProgress, subStatus });
    logger.info(subStatus, { jobId, stage, subProgress });
  };

  try {
    if (signal.aborted) throw new CancelledError();

    // ── Stage 1: Normalize ────────────────────────────────────────
    progress('normalizing', 0, 'Decoding image…');
    const normalized = await normalize({ rawBuffer, mimeType });
    store.setAnalysis(jobId, normalized.analysis);
    store.update(jobId, 'normalizing', { status: 'completed', subProgress: 100, subStatus: 'Done' });

    // ── Stage 2: Posterize ────────────────────────────────────────
    progress('posterizing', 0, 'Analyzing colors…');
    const posterized = await posterize({ pngBuffer: normalized.pngBuffer, colorCount });
    store.setPalette(jobId, posterized.palette);
    store.update(jobId, 'posterizing', {
      status: 'completed',
      subProgress: 100,
      subStatus: `Reduced to ${posterized.actualColorCount} colors`,
    });

    // ── Stage 3: Trace ────────────────────────────────────────────
    progress('tracing', 0, 'Starting VTracer…');
    const traced = await trace(
      { flatPngBuffer: posterized.flatPngBuffer, palette: posterized.palette },
      signal,
    );
    store.setSvgRaw(jobId, traced.svgRaw);
    store.update(jobId, 'tracing', {
      status: 'completed',
      subProgress: 100,
      subStatus: `Traced ${traced.pathCount} paths`,
    });

    // Buffers no longer needed past this point — release for GC
    store.clearBuffer(jobId, 'original');
    store.clearBuffer(jobId, 'posterized');

    // ── Stage 4: Repair ───────────────────────────────────────────
    progress('repairing', 0, 'Sending to Gemini…');
    const repaired = await repair(
      {
        svgRaw: traced.svgRaw,
        originalPngBuffer: normalized.pngBuffer,
        palette: posterized.palette,
        analysis: normalized.analysis,
      },
      gemini,
      signal,
    );

    progress('repairing', 90, 'Validating Gemini output…');
    const validation = validateSVG(repaired.svgRepaired);
    if (!validation.valid) {
      throw new StageError('repairing', `Invalid SVG from Gemini: ${validation.errors.join(', ')}`);
    }
    store.update(jobId, 'repairing', { status: 'completed', subProgress: 100, subStatus: 'Done' });

    // ── Stage 5: Optimize ─────────────────────────────────────────
    progress('optimizing', 0, 'Running SVGO…');
    const optimized = optimizeSVG({ svgRepaired: repaired.svgRepaired });
    store.update(jobId, 'optimizing', {
      status: 'completed',
      subProgress: 100,
      subStatus: `Reduced by ${optimized.reductionPercent}%`,
    });

    // ── Complete ──────────────────────────────────────────────────
    store.complete(jobId, optimized.svgOptimized, optimized.reductionPercent);
    logger.info('Pipeline completed', { jobId, pathCount: traced.pathCount });
  } catch (err) {
    if (err instanceof CancelledError) {
      store.cancel(jobId);
      logger.warn('Pipeline cancelled', { jobId });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      store.fail(jobId, message);
      logger.error('Pipeline failed', { jobId, error: message });
    }
  }
}
