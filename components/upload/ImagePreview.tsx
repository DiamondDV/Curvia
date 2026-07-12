'use client';

interface ImagePreviewProps {
  previewUrl: string;
  fileName: string;
  onClear: () => void;
}

export function ImagePreview({ previewUrl, fileName, onClear }: ImagePreviewProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-800 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={fileName}
        className="h-20 w-20 rounded-lg object-contain bg-zinc-900"
      />
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm text-zinc-200">{fileName}</p>
      </div>
      <button
        onClick={onClear}
        className="text-xs text-zinc-500 hover:text-zinc-300 underline"
        type="button"
      >
        Replace
      </button>
    </div>
  );
}
