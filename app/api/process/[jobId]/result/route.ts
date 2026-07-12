import { store } from '@/lib/pipeline/store';
import { CurviaError } from '@/lib/utils/errors';
import type { JobStatus } from '@/types/pipeline';
import type { ResultResponse } from '@/types/api';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  try {
    const { jobId } = await params;
    const job = store.get(jobId);

    if (job.status !== 'completed' || !job.artifacts.svgOptimized) {
      return Response.json(
        { error: `Job is ${job.status}, not completed`, code: 'JOB_NOT_FOUND' },
        { status: 409 },
      );
    }

    const svg = job.artifacts.svgOptimized;
    const svgSizeBytes = Buffer.byteLength(svg, 'utf8');
    const pathCount = (svg.match(/<path/g) ?? []).length;

    const stageDurations: Partial<Record<JobStatus, number>> = {};
    for (const key of Object.keys(job.stages) as JobStatus[]) {
      const stage = job.stages[key];
      if (stage.startedAt && stage.completedAt) {
        stageDurations[key] = stage.completedAt - stage.startedAt;
      }
    }

    const response: ResultResponse = {
      svg,
      analysis: job.analysis!,
      palette: job.palette ?? [],
      metrics: {
        totalDurationMs: job.updatedAt - job.createdAt,
        stageDurations,
        pathCount,
        svgSizeBytes,
        svgSizeReductionPercent: job.optimizeReductionPercent ?? 0,
      },
      cached: job.cached,
    };

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
