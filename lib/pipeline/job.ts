import { randomUUID } from 'crypto';
import {
  PIPELINE_VERSION,
  VALID_TRANSITIONS,
  createInitialStages,
  type JobStatus,
  type PipelineJob,
} from '@/types/pipeline';
import { limits } from '@/lib/config/limits';

/** Constructs a brand-new job in the `queued` state. */
export function createJob(): PipelineJob {
  const now = Date.now();
  return {
    id: randomUUID(),
    pipelineVersion: PIPELINE_VERSION,
    status: 'queued',
    stages: createInitialStages(),
    artifacts: {},
    createdAt: now,
    updatedAt: now,
    expiresAt: now + limits.JOB_TTL_MS,
    cached: false,
  };
}

/** Throws-free transition check — callers decide how to handle `false`. */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(from: JobStatus, to: JobStatus) {
    super(`Invalid job transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

/** Throws if the transition isn't allowed per VALID_TRANSITIONS. */
export function assertTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function isTerminal(status: JobStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
