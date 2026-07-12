/**
 * Tracks the AbortController for each in-flight job so a future
 * cancel endpoint (or job expiry sweep) can stop an in-progress
 * VTracer process or Gemini call.
 *
 * Pinned to globalThis for the same reason as lib/pipeline/store.ts —
 * see the comment there.
 */
declare global {
  // eslint-disable-next-line no-var
  var __curviaAbortControllers: Map<string, AbortController> | undefined;
}

const controllers = globalThis.__curviaAbortControllers ?? (globalThis.__curviaAbortControllers = new Map());

export function registerController(jobId: string): AbortController {
  const controller = new AbortController();
  controllers.set(jobId, controller);
  return controller;
}

export function abortJob(jobId: string): boolean {
  const controller = controllers.get(jobId);
  if (!controller) return false;
  controller.abort();
  controllers.delete(jobId);
  return true;
}

export function releaseController(jobId: string): void {
  controllers.delete(jobId);
}
