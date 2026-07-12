import { store } from '@/lib/pipeline/store';
import { enqueue } from '@/lib/pipeline/worker';
import { registerController, releaseController } from '@/lib/pipeline/abort-registry';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { GeminiClient } from '@/lib/ai/gemini';
import { hashJobInput } from '@/lib/utils/hash';
import { limits } from '@/lib/config/limits';
import { CurviaError, FileTypeError } from '@/lib/utils/errors';
import type { ProcessResponse } from '@/types/api';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();

    const image = formData.get('image');
    if (!(image instanceof File)) {
      throw new FileTypeError('Missing or invalid "image" field');
    }

    const geminiKeyField = formData.get('geminiKey');
    const geminiKey =
      typeof geminiKeyField === 'string' && geminiKeyField.length > 0
        ? geminiKeyField
        : process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return Response.json(
        { error: 'No Gemini API key provided (env or request field)' },
        { status: 400 },
      );
    }

    const colorCountField = formData.get('colorCount');
    const colorCount = colorCountField ? Number(colorCountField) : limits.DEFAULT_COLOR_COUNT;
    if (!limits.ALLOWED_COLOR_COUNTS.includes(colorCount as 4 | 6 | 8)) {
      return Response.json(
        { error: `colorCount must be one of ${limits.ALLOWED_COLOR_COUNTS.join(', ')}` },
        { status: 400 },
      );
    }

    const rawBuffer = Buffer.from(await image.arrayBuffer());
    const cacheKey = hashJobInput(rawBuffer, colorCount);

    // Reuse a completed identical job instead of re-running the pipeline
    const cached = store.getCached(cacheKey);
    if (cached) {
      const response: ProcessResponse = { jobId: cached.id, cached: true };
      return Response.json(response);
    }

    const job = store.create(); // synchronous, instant
    store.registerCacheKey(cacheKey, job.id);

    const controller = registerController(job.id);
    const gemini = new GeminiClient(geminiKey);

    // Non-blocking, fires in background — POST returns in <10ms
    enqueue(job.id, async () => {
      try {
        await runPipeline(rawBuffer, image.type, {
          jobId: job.id,
          colorCount,
          gemini,
          signal: controller.signal,
        });
      } finally {
        releaseController(job.id);
      }
    });

    const response: ProcessResponse = { jobId: job.id, cached: false };
    return Response.json(response);
  } catch (err) {
    if (err instanceof CurviaError) {
      return Response.json({ error: err.message, code: err.code }, { status: err.httpStatus });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
