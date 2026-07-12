import { useCallback, useRef, useState } from 'react';
import type { ProcessResponse, StatusResponse, ResultResponse } from '@/types/api';
import type { JobStatus } from '@/types/pipeline';

const POLL_MIN_MS = 500;
const POLL_MAX_MS = 4000;

interface PipelineState {
  jobId: string | null;
  status: JobStatus | 'idle';
  subStatus: string;
  subProgress: number;
  result: ResultResponse | null;
  error: string | null;
}

const initialState: PipelineState = {
  jobId: null,
  status: 'idle',
  subStatus: '',
  subProgress: 0,
  result: null,
  error: null,
};

/** Drives POST /api/process then polls GET .../status with exponential
 *  backoff (capped) until the job is terminal, then fetches .../result. */
export function usePipeline() {
  const [state, setState] = useState<PipelineState>(initialState);
  const stopRef = useRef(false);

  const start = useCallback(async (file: File, colorCount: number, geminiKey?: string) => {
    stopRef.current = false;
    setState({ ...initialState, status: 'queued' });

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('colorCount', String(colorCount));
      if (geminiKey) formData.append('geminiKey', geminiKey);

      const res = await fetch('/api/process', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }

      const { jobId }: ProcessResponse = await res.json();
      setState((prev) => ({ ...prev, jobId }));
      await poll(jobId);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const poll = useCallback(async (jobId: string) => {
    let delay = POLL_MIN_MS;

    while (!stopRef.current) {
      const res = await fetch(`/api/process/${jobId}/status`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState((prev) => ({ ...prev, status: 'failed', error: body.error ?? 'Status check failed' }));
        return;
      }

      const status: StatusResponse = await res.json();
      setState((prev) => ({
        ...prev,
        status: status.status,
        subStatus: status.subStatus,
        subProgress: status.subProgress,
        error: status.error ?? null,
      }));

      if (status.status === 'completed') {
        const resultRes = await fetch(`/api/process/${jobId}/result`);
        if (resultRes.ok) {
          const result: ResultResponse = await resultRes.json();
          setState((prev) => ({ ...prev, result }));
        }
        return;
      }

      if (status.status === 'failed' || status.status === 'cancelled') return;

      await sleep(delay);
      delay = Math.min(delay * 1.5, POLL_MAX_MS);
    }
  }, []);

  const cancel = useCallback(() => {
    stopRef.current = true;
  }, []);

  const reset = useCallback(() => {
    stopRef.current = true;
    setState(initialState);
  }, []);

  return { ...state, start, cancel, reset };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
