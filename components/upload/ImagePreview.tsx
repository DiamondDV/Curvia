'use client';

import { XIcon } from '@/components/icons';

interface ImagePreviewProps {
  previewUrl: string;
  fileName: string;
  onClear: () => void;
}

/** Same footprint as UploadZone's empty state, so swapping between the
 *  two doesn't reflow the sidebar. */
export function ImagePreview({ previewUrl, fileName, onClear }: ImagePreviewProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={fileName}
        className="h-9 w-9 shrink-0 rounded-lg border border-zinc-200 bg-white object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800">{fileName}</p>
        <p className="text-xs text-zinc-500">Reference image attached</p>
      </div>
      <button
        onClick={onClear}
        type="button"
        aria-label="Remove reference image"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
      >
        <XIcon />
      </button>
    </div>
  );
}
