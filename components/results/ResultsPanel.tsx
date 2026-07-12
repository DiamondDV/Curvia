'use client';

import { useState } from 'react';
import type { ResultResponse } from '@/types/api';
import { SVGViewer } from './SVGViewer';
import { SVGCodeViewer } from './SVGCodeViewer';

interface ResultsPanelProps {
  result: ResultResponse;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');

  const handleDownload = () => {
    const blob = new Blob([result.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'curvia-output.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={[
              'rounded-md px-3 py-1.5 text-sm',
              tab === 'preview' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
            ].join(' ')}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setTab('code')}
            className={[
              'rounded-md px-3 py-1.5 text-sm',
              tab === 'code' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
            ].join(' ')}
          >
            Code
          </button>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700"
        >
          Download SVG
        </button>
      </div>

      {tab === 'preview' ? <SVGViewer svg={result.svg} /> : <SVGCodeViewer svg={result.svg} />}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
        <span>{result.metrics.pathCount} paths</span>
        <span>{(result.metrics.svgSizeBytes / 1024).toFixed(1)} KB</span>
        <span>{result.metrics.svgSizeReductionPercent}% smaller after optimize</span>
        <span>{(result.metrics.totalDurationMs / 1000).toFixed(1)}s total</span>
        <span>{result.palette.length} colors</span>
      </div>

      <div className="flex gap-1.5">
        {result.palette.map((hex) => (
          <span
            key={hex}
            title={hex}
            className="h-5 w-5 rounded-full border border-zinc-700"
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  );
}
