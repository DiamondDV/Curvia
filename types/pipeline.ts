import type { ImageAnalysis } from './stages';

export const PIPELINE_VERSION = '1.0.0' as const;

// ─── Job Status ────────────────────────────────────────────────────────────

export type JobStatus =
  | 'queued'
  | 'normalizing'
  | 'posterizing'
  | 'tracing'
  | 'repairing'
  | 'optimizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ['normalizing', 'cancelled'],
  normalizing: ['posterizing', 'failed', 'cancelled'],
  posterizing: ['tracing', 'failed', 'cancelled'],
  tracing: ['repairing', 'failed', 'cancelled'],
  repairing: ['optimizing', 'failed', 'cancelled'],
  optimizing: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

// ─── Stage Result ──────────────────────────────────────────────────────────

export interface StageResult {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  subStatus: string;
  subProgress: number; // 0–100, real values only, no fake timers
  error?: string;
}

export function createInitialStages(): Record<JobStatus, StageResult> {
  const pending: StageResult = { status: 'pending', subStatus: '', subProgress: 0 };
  return {
    queued: { ...pending },
    normalizing: { ...pending },
    posterizing: { ...pending },
    tracing: { ...pending },
    repairing: { ...pending },
    optimizing: { ...pending },
    completed: { ...pending },
    failed: { ...pending },
    cancelled: { ...pending },
  };
}

// ─── Artifacts ─────────────────────────────────────────────────────────────
// Buffers are stored ONLY for the duration of the job.
// After completion, only svgOptimized is retained (prevents the 24h Buffer
// memory bomb described in plan.md).

export interface JobArtifacts {
  original?: Buffer; // cleared after tracing stage
  posterized?: Buffer; // cleared after tracing stage
  svgRaw?: string; // cleared after optimizing stage
  svgOptimized?: string; // retained — this is the result
}

// ─── Pipeline Job ──────────────────────────────────────────────────────────

export interface PipelineJob {
  id: string;
  pipelineVersion: typeof PIPELINE_VERSION;
  status: JobStatus;
  stages: Record<JobStatus, StageResult>;
  artifacts: JobArtifacts;
  analysis?: ImageAnalysis;
  palette?: string[];
  /** SVGO's size reduction from the optimize stage. Kept on the job record
   *  itself (not just in-memory in the orchestrator) since svgRaw/svgRepaired
   *  are discarded after optimizing and result/route.ts needs this number. */
  optimizeReductionPercent?: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number; // createdAt + 1 hour (not 24h)
  error?: string;
  cached: boolean;
}
