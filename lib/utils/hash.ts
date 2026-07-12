import { createHash } from 'crypto';

/**
 * Produces a stable cache key for a given input buffer + processing options.
 * Used so identical (image, colorCount) pairs can reuse a completed job's
 * result instead of re-running the whole pipeline.
 */
export function hashJobInput(rawBuffer: Buffer, colorCount: number): string {
  const hash = createHash('sha256');
  hash.update(rawBuffer);
  hash.update(String(colorCount));
  return hash.digest('hex');
}
