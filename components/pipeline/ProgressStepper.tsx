'use client';

import type { JobStatus } from '@/types/pipeline';

const STAGES: { key: JobStatus; label: string }[] = [
  { key: 'normalizing', label: 'Normalize' },
  { key: 'posterizing', label: 'Posterize' },
  { key: 'tracing', label: 'Trace' },
  { key: 'repairing', label: 'Repair' },
  { key: 'optimizing', label: 'Optimize' },
];

interface ProgressStepperProps {
  status: JobStatus | 'idle';
  subStatus: string;
  subProgress: number;
}

export function ProgressStepper({ status, subStatus, subProgress }: ProgressStepperProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === status);

  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        {STAGES.map((stage, i) => {
          const done = currentIndex > i || status === 'completed';
          const active = i === currentIndex;
          return (
            <div key={stage.key} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={[
                  'h-2 w-full rounded-full transition-colors',
                  done ? 'bg-indigo-500' : active ? 'bg-indigo-500/50' : 'bg-zinc-800',
                ].join(' ')}
              />
              <span
                className={['text-[11px]', active ? 'text-indigo-300' : 'text-zinc-500'].join(' ')}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      {status !== 'idle' && status !== 'completed' && (
        <p className="text-xs text-zinc-400 mt-1">
          {subStatus} {subProgress > 0 ? `(${subProgress}%)` : ''}
        </p>
      )}
    </div>
  );
}
