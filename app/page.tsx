'use client';

import { useState } from 'react';
import { UploadZone } from '@/components/upload/UploadZone';
import { ImagePreview } from '@/components/upload/ImagePreview';
import { CanvasStage } from '@/components/results/CanvasStage';
import { Toggle } from '@/components/ui/Toggle';
import { Collapsible } from '@/components/ui/Collapsible';
import { SparklesIcon, SlidersIcon, KeyIcon, ZapIcon } from '@/components/icons';
import { useFileUpload } from '@/hooks/useFileUpload';
import { usePipeline } from '@/hooks/usePipeline';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { limits } from '@/lib/config/limits';
import { formatBytes, countLayers } from '@/lib/utils/format';

type LastAction = 'generate' | 'edit' | null;
type Step = 'source' | 'vectorize' | 'export';

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-zinc-900">
      <path
        d="M19 6c-3.5-2-9-2-11.5 1.5S5 15 8.5 17.5 17 19 19 16"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StepItem({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      <span className={active || done ? 'text-zinc-900' : 'text-zinc-400'}>{label}</span>
    </span>
  );
}

export default function HomePage() {
  const upload = useFileUpload();
  const pipeline = usePipeline();
  const { value: geminiKey, set: setGeminiKey } = useLocalStorage<string>('curvia:geminiKey', '');
  const [colorCount, setColorCount] = useState<number>(limits.DEFAULT_COLOR_COUNT);
  const [describePrompt, setDescribePrompt] = useState('');
  const [lastAction, setLastAction] = useState<LastAction>(null);

  // UI-only for now — no backend stage wires these up yet, see
  // ACTIVE_CONTEXT.md. Rendered disabled so that's honest rather than
  // silently a no-op.
  const [removeBackground, setRemoveBackground] = useState(false);
  const [blackAndWhite, setBlackAndWhite] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isRunning =
    pipeline.status !== 'idle' && pipeline.status !== 'completed' && pipeline.status !== 'failed';
  const isBusy = isRunning || isGenerating || isEditing;

  const handleFileSelected = (file: File) => {
    setLastAction(null);
    upload.setFile(file);
  };

  const handleFileClear = () => {
    setLastAction(null);
    upload.reset();
  };

  const handlePrimaryAction = async () => {
    if (upload.file) {
      if (describePrompt.trim()) {
        setEditError(null);
        setIsEditing(true);
        try {
          const form = new FormData();
          form.append('image', upload.file);
          form.append('prompt', describePrompt);

          const res = await fetch('/api/edit', { method: 'POST', body: form });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `Request failed: ${res.status}`);
          }

          const blob = await res.blob();
          const editedFile = new File([blob], 'edited.png', { type: 'image/png' });
          setLastAction('edit');
          upload.setFile(editedFile);
          // Clear the prompt now that it's been consumed as an edit
          // instruction — leaving it here would make the *next* click
          // re-run this same edit against the already-edited image
          // (and mislabel "Active pipeline" as edit mode in the meantime).
          setDescribePrompt('');
          await pipeline.start(editedFile, colorCount, geminiKey || undefined);
        } catch (err) {
          setEditError(err instanceof Error ? err.message : String(err));
        } finally {
          setIsEditing(false);
        }
        return;
      }

      await pipeline.start(upload.file, colorCount, geminiKey || undefined);
      return;
    }

    if (!describePrompt.trim()) return;

    setGenerateError(null);
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: describePrompt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }

      const blob = await res.blob();
      const generatedFile = new File([blob], 'generated.png', { type: 'image/png' });
      setLastAction('generate');
      upload.setFile(generatedFile);
      // Same reasoning as the edit branch above: clear the prompt once
      // it's been consumed, so a second click vectorizes directly instead
      // of silently sending the freshly-generated image through an
      // unrequested edit pass, and "Active pipeline" reflects reality.
      setDescribePrompt('');
      await pipeline.start(generatedFile, colorCount, geminiKey || undefined);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartOver = () => {
    handleFileClear();
    pipeline.reset();
    setDescribePrompt('');
    setGenerateError(null);
    setEditError(null);
  };

  const canRun = !!upload.file || describePrompt.trim().length > 0;

  const activePipeline = upload.file
    ? describePrompt.trim()
      ? { name: 'GPT Image', mode: 'image-to-image edit' }
      : { name: 'VTracer', mode: 'direct vectorize' }
    : describePrompt.trim()
      ? { name: 'Flux', mode: 'text-to-image' }
      : null;

  const primaryButtonLabel = isEditing
    ? 'Applying AI edit…'
    : isGenerating
      ? 'Generating image…'
      : isRunning
        ? 'Processing…'
        : 'Generate & vectorize';

  const busyLabel = isEditing ? 'Applying AI edit…' : isGenerating ? 'Generating image…' : null;

  const sourceLabel =
    lastAction === 'edit'
      ? 'Edited'
      : lastAction === 'generate'
        ? 'Generated'
        : upload.file
          ? 'Uploaded'
          : 'No source yet';

  const step: Step = pipeline.result ? 'export' : isBusy ? 'vectorize' : 'source';
  const formError = generateError || editError || pipeline.error;

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <div className="flex w-40 items-center gap-2">
          <LogoMark />
          <span className="text-base font-bold tracking-wide text-zinc-900">CURVIA</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5 text-xs font-medium">
          <StepItem label="SOURCE" active={step === 'source'} done={step !== 'source'} />
          <span className="text-zinc-300">—</span>
          <StepItem label="VECTORIZE" active={step === 'vectorize'} done={step === 'export'} />
          <span className="text-zinc-300">—</span>
          <StepItem label="EXPORT" active={step === 'export'} done={false} />
        </div>
        <div className="w-40" />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Vector Studio</p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900">Create an SVG</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Generate from a description or trace an image into clean, editable vector paths.
          </p>

          <div className="mt-6 border-t border-zinc-200 pt-6">
            <div className="flex items-center justify-between">
              <label htmlFor="describe" className="text-xs font-semibold text-zinc-700">
                Describe the asset
              </label>
              <span className="text-xs text-zinc-400">{describePrompt.length}/500</span>
            </div>
            <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200 focus-within:border-zinc-400">
              <textarea
                id="describe"
                value={describePrompt}
                onChange={(e) => setDescribePrompt(e.target.value.slice(0, 500))}
                disabled={isBusy}
                maxLength={500}
                rows={4}
                placeholder="A wise barn owl perched on a branch, minimalist flat vector style…"
                className="w-full resize-none border-0 p-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none disabled:bg-zinc-50"
              />
              <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-3 py-2">
                <SparklesIcon className="shrink-0 text-zinc-400" />
                <p className="text-xs text-zinc-500">
                  Describe the subject and style you want to turn into vector paths.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <span>Reference image</span>
              <span className="h-px flex-1 bg-zinc-200" />
            </div>
            {upload.previewUrl ? (
              <ImagePreview
                previewUrl={upload.previewUrl}
                fileName={upload.file?.name ?? ''}
                onClear={handleFileClear}
              />
            ) : (
              <UploadZone onFileSelected={handleFileSelected} error={upload.error} />
            )}
          </div>

          <div className="mt-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Active pipeline
            </p>
            <div className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm">
                <ZapIcon />
              </span>
              <p className="text-sm">
                {activePipeline ? (
                  <>
                    <span className="font-semibold text-zinc-900">{activePipeline.name}</span>
                    <span className="text-zinc-500"> / {activePipeline.mode}</span>
                  </>
                ) : (
                  <span className="text-zinc-400">Add a description or reference image</span>
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-800">Remove background</p>
                  <p className="text-xs text-zinc-500">Transparent output</p>
                </div>
                <Toggle
                  checked={removeBackground}
                  onChange={setRemoveBackground}
                  disabled
                  label="Remove background (not yet wired to a pipeline stage)"
                />
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-800">Black &amp; white</p>
                  <p className="text-xs text-zinc-500">Monochrome ink output</p>
                </div>
                <Toggle
                  checked={blackAndWhite}
                  onChange={setBlackAndWhite}
                  disabled
                  label="Black and white (not yet wired to a pipeline stage)"
                />
              </div>
            </div>
          </div>

          <div className="mt-2">
            <Collapsible icon={<SlidersIcon />} label="Trace controls">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
                Colors
                <select
                  value={colorCount}
                  onChange={(e) => setColorCount(Number(e.target.value))}
                  disabled={isBusy}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800"
                >
                  {limits.ALLOWED_COLOR_COUNTS.map((n) => (
                    <option key={n} value={n}>
                      {n} colors
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-zinc-400">
                Speckle filtering, corner threshold, and path precision are fixed for this build —
                not yet exposed here.
              </p>
            </Collapsible>

            <Collapsible icon={<KeyIcon />} label="Use your own API keys">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
                Gemini API key
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  disabled={isBusy}
                  placeholder="AIza…"
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800"
                />
              </label>
              <p className="text-xs text-zinc-400">
                Currently unused — the repair stage was switched to a deterministic code
                transform, so nothing in this pipeline calls Gemini anymore.
              </p>
            </Collapsible>
          </div>

          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={!canRun || isBusy}
            className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-zinc-900 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SparklesIcon />
            {primaryButtonLabel}
          </button>

          {formError && <p className="mt-2 text-xs text-red-500">{formError}</p>}

          <p className="mt-3 text-center text-xs text-zinc-400">
            {pipeline.result
              ? `${pipeline.result.metrics.pathCount} paths / ${countLayers(pipeline.result.svg)} layers / ${formatBytes(pipeline.result.metrics.svgSizeBytes)}`
              : 'No SVG generated yet'}
          </p>

          {pipeline.result && (
            <button
              type="button"
              onClick={handleStartOver}
              className="mt-3 self-center text-xs text-zinc-400 underline hover:text-zinc-600"
            >
              Start over
            </button>
          )}
        </aside>

        <main className="flex flex-1 overflow-hidden">
          <CanvasStage
            previewUrl={upload.previewUrl}
            sourceLabel={sourceLabel}
            result={pipeline.result}
            isRunning={isRunning}
            pipelineStatus={pipeline.status}
            subStatus={pipeline.subStatus}
            subProgress={pipeline.subProgress}
            busyLabel={busyLabel}
          />
        </main>
      </div>
    </div>
  );
}
