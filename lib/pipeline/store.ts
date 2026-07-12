import type { JobStatus, PipelineJob, StageResult } from '@/types/pipeline';
import type { ImageAnalysis } from '@/types/stages';
import { createJob, assertTransition, isTerminal } from './job';
import { JobNotFoundError, JobExpiredError } from '@/lib/utils/errors';

/**
 * In-memory job store. Buffers are released between stages and only the
 * final SVG string is retained after completion — see plan.md's
 * "Memory Management (The 24h Buffer Problem, Fixed)" section.
 */
class JobStore {
  private jobs = new Map<string, PipelineJob>();
  /** cache key (hashJobInput) -> jobId, for reusing completed results */
  private cacheIndex = new Map<string, string>();

  create(): PipelineJob {
    const job = createJob();
    this.jobs.set(job.id, job);
    return job;
  }

  get(jobId: string): PipelineJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new JobNotFoundError(jobId);
    if (Date.now() > job.expiresAt) throw new JobExpiredError(jobId);
    return job;
  }

  /** Returns the cached completed job for this input hash, if still valid. */
  getCached(cacheKey: string): PipelineJob | undefined {
    const jobId = this.cacheIndex.get(cacheKey);
    if (!jobId) return undefined;
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'completed' || Date.now() > job.expiresAt) {
      this.cacheIndex.delete(cacheKey);
      return undefined;
    }
    return job;
  }

  registerCacheKey(cacheKey: string, jobId: string): void {
    this.cacheIndex.set(cacheKey, jobId);
  }

  /** Moves the job to `stage`, validating the transition, and patches its StageResult. */
  update(jobId: string, stage: JobStatus, patch: Partial<StageResult>): void {
    const job = this.jobs.get(jobId);
    if (!job) throw new JobNotFoundError(jobId);

    if (job.status !== stage) {
      assertTransition(job.status, stage);
      job.status = stage;
    }

    const current = job.stages[stage];
    job.stages[stage] = {
      ...current,
      ...patch,
      startedAt: current.startedAt ?? (patch.status === 'running' ? Date.now() : current.startedAt),
      completedAt:
        patch.status === 'completed' || patch.status === 'failed' ? Date.now() : current.completedAt,
    };
    job.updatedAt = Date.now();
  }

  setAnalysis(jobId: string, analysis: ImageAnalysis): void {
    const job = this.jobs.get(jobId);
    if (!job) throw new JobNotFoundError(jobId);
    job.analysis = analysis;
    job.updatedAt = Date.now();
  }

  setPalette(jobId: string, palette: string[]): void {
    const job = this.jobs.get(jobId);
    if (!job) throw new JobNotFoundError(jobId);
    job.palette = palette;
    job.updatedAt = Date.now();
  }

  setBuffer(jobId: string, key: 'original' | 'posterized', buffer: Buffer): void {
    const job = this.jobs.get(jobId);
    if (!job) throw new JobNotFoundError(jobId);
    job.artifacts[key] = buffer;
    job.updatedAt = Date.now();
  }

  setSvgRaw(jobId: string, svgRaw: string): void {
    const job = this.jobs.get(jobId);
    if (!job) throw new JobNotFoundError(jobId);
    job.artifacts.svgRaw = svgRaw;
    job.updatedAt = Date.now();
  }

  // Called by orchestrator between stages
  clearBuffer(jobId: string, key: 'original' | 'posterized'): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    delete job.artifacts[key];
    // GC can now collect these buffers
  }

  complete(jobId: string, svgOptimized: string, reductionPercent: number): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    assertTransition(job.status, 'completed');

    // Retain ONLY the final SVG string — all image Buffers are released
    job.artifacts = { svgOptimized };
    job.status = 'completed';
    job.optimizeReductionPercent = reductionPercent;
    job.stages.completed = {
      status: 'completed',
      subStatus: 'Done',
      subProgress: 100,
      completedAt: Date.now(),
    };
    job.expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour, not 24
    job.updatedAt = Date.now();
  }

  fail(jobId: string, message: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'failed';
    job.error = message;
    job.artifacts = {};
    job.updatedAt = Date.now();
  }

  cancel(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'cancelled';
    job.artifacts = {};
    job.updatedAt = Date.now();
  }

  /** Sweeps expired jobs. Call periodically (see lib/pipeline/worker.ts). */
  sweepExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, job] of this.jobs) {
      if (now > job.expiresAt && isTerminal(job.status)) {
        this.jobs.delete(id);
        removed++;
      }
    }
    return removed;
  }
}

// Singleton — the pipeline runs in a single long-lived Node process
// (Docker container on Railway/Fly.io), not serverless functions.
//
// Pinned to `globalThis` rather than a plain module-level `export const`:
// in Next.js dev mode, individual API routes can be compiled into separate
// module instances (e.g. right after editing a file that route transitively
// imports), which would otherwise give POST /api/process and
// GET /api/process/[jobId]/status two different JobStore instances and
// cause spurious "Job not found" errors mid-pipeline. globalThis survives
// that per-route recompilation. In production this is a no-op — there's
// only ever one instance either way.
declare global {
  // eslint-disable-next-line no-var
  var __curviaJobStore: JobStore | undefined;
}

export const store = globalThis.__curviaJobStore ?? (globalThis.__curviaJobStore = new JobStore());
