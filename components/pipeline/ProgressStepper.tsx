'use client';

import type { JobStatus } from '@/types/pipeline';

const STAGES: { key: JobStatus; label: string }[] = [
  { key: 'normalizing', label: 'Normalize' },
  { key: 'posterizing', label: 'Posterize' },
  { key: 'tracing', label: 'Trace' },
  { key: 'repairing', label: 'Structure' },
  { key: 'optimizing', label: 'Optimize' },
];

interface ProgressStepperProps {
  status: JobStatus | 'idle';
  subStatus: string;
  subProgress: number;
}

/** Rendered as a floating card over the canvas while a job is running —
 *  see CanvasStage. */
export function ProgressStepper({ status, subStatus, subProgress }: ProgressStepperProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === status);

  return (
    <div className="w-72 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg">
      <div className="mb-2 flex justify-between gap-1">
        {STAGES.map((stage, i) => {
          const done = currentIndex > i || status === 'completed';
          const active = i === currentIndex;
          return (
            <div key={stage.key} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={[
                  'h-1.5 w-full rounded-full transition-colors',
                  done ? 'bg-zinc-900' : active ? 'bg-zinc-400' : 'bg-zinc-200',
                ].join(' ')}
              />
              <span className={['text-[10px]', active ? 'text-zinc-800' : 'text-zinc-400'].join(' ')}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      {status !== 'idle' && status !== 'completed' && (
        <p className="text-center text-xs text-zinc-500">
          {subStatus} {subProgress > 0 ? `(${subProgress}%)` : ''}
        </p>
      )}
    </div>
  );
}
