'use client';

import { useCallback, useRef, useState } from 'react';
import { UploadCloudIcon, PlusIcon } from '@/components/icons';

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  error?: string | null;
}

/** Compact "Reference image" drop target — optional, sits under the
 *  Describe field. Matches the Vector Studio design's reference-image
 *  card, not a full-page dropzone. */
export function UploadZone({ onFileSelected, error }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
          dragActive ? 'border-zinc-400 bg-zinc-100' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleChange}
        />
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-500 shadow-sm">
          <UploadCloudIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-800">Drop image here</p>
          <p className="text-xs text-zinc-500">PNG, JPG, or WebP up to 15MB</p>
        </div>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400">
          <PlusIcon />
        </span>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
