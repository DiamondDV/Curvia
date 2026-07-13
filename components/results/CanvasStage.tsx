'use client';

import { useEffect, useRef, useState } from 'react';
import type { ResultResponse } from '@/types/api';
import type { JobStatus } from '@/types/pipeline';
import { SVGViewer, MIN_SCALE, MAX_SCALE } from './SVGViewer';
import { SVGCodeViewer } from './SVGCodeViewer';
import { ProgressStepper } from '@/components/pipeline/ProgressStepper';
import { CodeIcon, DownloadIcon, ImageIcon, MinusIcon, PlusIcon } from '@/components/icons';

interface CanvasStageProps {
  previewUrl: string | null;
  sourceLabel: string;
  result: ResultResponse | null;
  /** True only while the actual conversion pipeline is running (shows the
   *  staged ProgressStepper). */
  isRunning: boolean;
  pipelineStatus: JobStatus | 'idle';
  subStatus: string;
  subProgress: number;
  /** Set while an upstream AI step (generate/edit) is running, before the
   *  pipeline itself has a job to report stage progress on. Renders a
   *  plain spinner instead of ProgressStepper since there's no stage data
   *  yet. */
  busyLabel?: string | null;
}

function downloadSvg(svg: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'curvia-output.svg';
  a.click();
  URL.revokeObjectURL(url);
}

/** The right-hand workspace: tab toolbar (Vector/Raster, source SVG, zoom,
 *  download) over a checkerboard artboard. Folds in what used to be
 *  ResultsPanel's job (preview/code tabs, download, stats) since the new
 *  layout renders them inline with the canvas, not below a form. */
export function CanvasStage({
  previewUrl,
  sourceLabel,
  result,
  isRunning,
  pipelineStatus,
  subStatus,
  subProgress,
  busyLabel,
}: CanvasStageProps) {
  const [tab, setTab] = useState<'vector' | 'raster'>('raster');
  const [showCode, setShowCode] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const prevResultRef = useRef<ResultResponse | null>(null);

  // Auto-jump to the Vector tab the moment a result first lands, without
  // fighting the user if they've since switched back to Raster on purpose.
  useEffect(() => {
    if (result && !prevResultRef.current) {
      setTab('vector');
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
    prevResultRef.current = result;
  }, [result]);

  const dims = result?.analysis
    ? `${result.analysis.normalizedWidth} x ${result.analysis.normalizedHeight}`
    : null;

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, Math.round((s + 0.1) * 100) / 100));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, Math.round((s - 0.1) * 100) / 100));

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-full border border-zinc-200 bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => result && setTab('vector')}
              disabled={!result}
              className={[
                'rounded-full px-3 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:text-zinc-300',
                tab === 'vector' && result ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-800',
              ].join(' ')}
            >
              Vector
            </button>
            <button
              type="button"
              onClick={() => previewUrl && setTab('raster')}
              disabled={!previewUrl}
              className={[
                'rounded-full px-3 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:text-zinc-300',
                tab === 'raster' && previewUrl ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-800',
              ].join(' ')}
            >
              Raster
            </button>
          </div>
          <p className="text-sm text-zinc-500">
            {dims ? (
              <>
                {dims} <span className="mx-1 text-zinc-300">•</span> {sourceLabel}
              </>
            ) : (
              sourceLabel
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            disabled={!result}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300"
          >
            <CodeIcon />
            {showCode ? 'Hide SVG source' : 'Show SVG source'}
          </button>

          <div className="flex items-center gap-1 rounded-full border border-zinc-200 px-1 py-1 text-sm text-zinc-600">
            <button
              type="button"
              onClick={zoomOut}
              disabled={tab !== 'vector' || !result}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-zinc-100 disabled:opacity-30"
              aria-label="Zoom out"
            >
              <MinusIcon />
            </button>
            <span className="w-10 text-center text-xs tabular-nums">
              {tab === 'vector' && result ? `${Math.round(scale * 100)}%` : '—'}
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={tab !== 'vector' || !result}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-zinc-100 disabled:opacity-30"
              aria-label="Zoom in"
            >
              <PlusIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={() => result && downloadSvg(result.svg)}
            disabled={!result}
            className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <DownloadIcon />
            Download SVG
          </button>
        </div>
      </div>

      <div className="checkerboard relative flex flex-1 items-center justify-center overflow-hidden p-10">
        {(isRunning || busyLabel) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
            {isRunning ? (
              <ProgressStepper status={pipelineStatus} subStatus={subStatus} subProgress={subProgress} />
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-lg">
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
                {busyLabel}
              </div>
            )}
          </div>
        )}

        {showCode && result ? (
          <div className="h-full max-h-[640px] w-full max-w-3xl">
            <SVGCodeViewer svg={result.svg} />
          </div>
        ) : tab === 'vector' && result ? (
          <div className="aspect-square h-full max-h-[640px] w-full max-w-[640px] overflow-hidden rounded-lg border border-zinc-100 bg-white shadow-xl">
            <SVGViewer
              svg={result.svg}
              scale={scale}
              offset={offset}
              onScaleChange={setScale}
              onOffsetChange={setOffset}
            />
          </div>
        ) : tab === 'raster' && previewUrl ? (
          <div className="flex aspect-square h-full max-h-[640px] w-full max-w-[640px] items-center justify-center overflow-hidden rounded-lg border border-zinc-100 bg-white p-6 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={sourceLabel} className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-zinc-300">
            <ImageIcon size={40} />
            <p className="text-sm text-zinc-400">Nothing to preview yet</p>
            <p className="max-w-xs text-center text-xs text-zinc-400">
              Describe an asset or drop a reference image, then generate to see it here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
