'use client';

import { useState } from 'react';
import { UploadZone } from '@/components/upload/UploadZone';
import { ImagePreview } from '@/components/upload/ImagePreview';
import { ProgressStepper } from '@/components/pipeline/ProgressStepper';
import { ResultsPanel } from '@/components/results/ResultsPanel';
import { useFileUpload } from '@/hooks/useFileUpload';
import { usePipeline } from '@/hooks/usePipeline';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { limits } from '@/lib/config/limits';

type Mode = 'upload' | 'describe';

export default function HomePage() {
  const upload = useFileUpload();
  const pipeline = usePipeline();
  const { value: geminiKey, set: setGeminiKey } = useLocalStorage<string>('curvia:geminiKey', '');
  const [colorCount, setColorCount] = useState<number>(limits.DEFAULT_COLOR_COUNT);

  const [mode, setMode] = useState<Mode>('upload');

  // Text -> image ("Describe") state.
  const [describePrompt, setDescribePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Image + text -> edited image ("Describe changes", optional AI edit
  // step on an already-uploaded image) state.
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isRunning =
    pipeline.status !== 'idle' && pipeline.status !== 'completed' && pipeline.status !== 'failed';
  const isBusy = isRunning || isGenerating || isEditing;

  const handleProcess = async () => {
    if (!upload.file) return;

    // If the user described changes to make, run the Pollinations
    // image-to-image edit first, swap the edited result into the upload
    // slot, then auto-run the full pipeline on the edited image.
    if (editPrompt.trim()) {
      setEditError(null);
      setIsEditing(true);
      try {
        const form = new FormData();
        form.append('image', upload.file);
        form.append('prompt', editPrompt);

        const res = await fetch('/api/edit', { method: 'POST', body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed: ${res.status}`);
        }

        const blob = await res.blob();
        const editedFile = new File([blob], 'edited.png', { type: 'image/png' });
        upload.setFile(editedFile);
        await pipeline.start(editedFile, colorCount, geminiKey || undefined);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsEditing(false);
      }
      return;
    }

    pipeline.start(upload.file, colorCount, geminiKey || undefined);
  };

  const handleGenerate = async () => {
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
      upload.setFile(generatedFile);
      // Auto-run full conversion immediately, using the current color count.
      await pipeline.start(generatedFile, colorCount, geminiKey || undefined);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartOver = () => {
    upload.reset();
    pipeline.reset();
    setDescribePrompt('');
    setEditPrompt('');
    setGenerateError(null);
    setEditError(null);
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-100">Curvia</h1>
        <p className="text-sm text-zinc-400">
          Upload a raster image — or describe one and Curvia will generate it — then
          posterizes, traces, and repairs the SVG's structure so you get clean, editable
          output, not a pile of fragmented paths.
        </p>
      </header>

      {!pipeline.result && (
        <section className="flex flex-col gap-4">
          <div className="flex gap-1 rounded-lg border border-zinc-800 p-1">
            <button
              type="button"
              onClick={() => setMode('upload')}
              disabled={isBusy}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === 'upload' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'
              }`}
            >
              Upload image
            </button>
            <button
              type="button"
              onClick={() => setMode('describe')}
              disabled={isBusy}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === 'describe' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'
              }`}
            >
              Describe image
            </button>
          </div>

          {mode === 'upload' && (
            <>
              {upload.previewUrl ? (
                <ImagePreview
                  previewUrl={upload.previewUrl}
                  fileName={upload.file?.name ?? ''}
                  onClear={upload.reset}
                />
              ) : (
                <UploadZone onFileSelected={upload.setFile} error={upload.error} />
              )}

              {upload.previewUrl && (
                <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
                  Describe changes (optional — AI-edits the image before conversion)
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    disabled={isBusy}
                    placeholder="e.g. remove the background, make the lines bolder"
                    rows={2}
                    className="resize-none rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
                  />
                </label>
              )}
              {editError && <p className="text-sm text-red-400">{editError}</p>}
            </>
          )}

          {mode === 'describe' && (
            <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
              Describe the image you want
              <textarea
                value={describePrompt}
                onChange={(e) => setDescribePrompt(e.target.value)}
                disabled={isBusy}
                placeholder="e.g. a minimalist mountain logo, flat colors, no gradients"
                rows={3}
                className="resize-none rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              />
            </label>
          )}
          {generateError && <p className="text-sm text-red-400">{generateError}</p>}

          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 p-4">
            <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
              Colors
              <select
                value={colorCount}
                onChange={(e) => setColorCount(Number(e.target.value))}
                disabled={isBusy}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              >
                {limits.ALLOWED_COLOR_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n} colors
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
              Gemini API key (optional — falls back to server default if set)
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                disabled={isBusy}
                placeholder="AIza…"
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          {mode === 'upload' ? (
            <button
              type="button"
              onClick={handleProcess}
              disabled={!upload.file || isBusy}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
            >
              {isEditing ? 'Applying AI edit…' : isRunning ? 'Processing…' : 'Convert to SVG'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!describePrompt.trim() || isBusy}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
            >
              {isGenerating ? 'Generating image…' : isRunning ? 'Processing…' : 'Generate & Convert'}
            </button>
          )}

          {isRunning && (
            <ProgressStepper
              status={pipeline.status}
              subStatus={pipeline.subStatus}
              subProgress={pipeline.subProgress}
            />
          )}

          {pipeline.error && <p className="text-sm text-red-400">{pipeline.error}</p>}
        </section>
      )}

      {pipeline.result && (
        <section className="flex flex-col gap-4">
          <ResultsPanel result={pipeline.result} />
          <button
            type="button"
            onClick={handleStartOver}
            className="self-start rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Convert another image
          </button>
        </section>
      )}
    </main>
  );
}
