import { CapacityError } from '@/lib/utils/errors';
import { limits } from '@/lib/config/limits';
import { store } from './store';

const MAX_CONCURRENT = limits.MAX_CONCURRENT_JOBS;

const queue: Array<() => void> = [];
let active = 0;

/**
 * Fire-and-forget task runner with a concurrency cap. The POST handler
 * calls this and returns immediately (<10ms); the task runs in the
 * background, updating the job store as it progresses.
 *
 * Unlike a queue that silently backs up forever, we reject outright at
 * capacity (`CapacityError`, HTTP 429) — plan.md is explicit that this
 * server holds a long-lived process, not serverless, so callers should
 * retry rather than pile up unbounded background work.
 */
export function enqueue(jobId: string, task: () => Promise<void>): void {
  if (active >= MAX_CONCURRENT) {
    throw new CapacityError();
  }

  const run = async () => {
    active++;
    try {
      await task();
    } catch (err) {
      store.fail(jobId, err instanceof Error ? err.message : String(err));
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  };

  // Fire and forget — the POST handler returns immediately.
  run();
}

export function activeCount(): number {
  return active;
}

export function capacityRemaining(): number {
  return Math.max(0, MAX_CONCURRENT - active);
}
