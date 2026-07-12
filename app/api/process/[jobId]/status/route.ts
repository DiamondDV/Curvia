import { store } from '@/lib/pipeline/store';
import { CurviaError } from '@/lib/utils/errors';
import type { JobStatus } from '@/types/pipeline';
import type { StatusResponse } from '@/types/api';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  try {
    const { jobId } = await params;
    const job = store.get(jobId);

    const completedStages = (Object.keys(job.stages) as JobStatus[]).filter(
      (stage) => job.stages[stage].status === 'completed',
    );

    const response: StatusResponse = {
      status: job.status,
      currentStage: job.status,
      subStatus: job.stages[job.status]?.subStatus ?? '',
      subProgress: job.stages[job.status]?.subProgress ?? 0,
      completedStages,
      error: job.error,
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
