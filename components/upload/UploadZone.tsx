'use client';

import { useCallback, useRef, useState } from 'react';

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  error?: string | null;
}

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
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-colors',
        dragActive ? 'border-indigo-400 bg-indigo-950/20' : 'border-zinc-700 hover:border-zinc-500',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />
      <p className="text-zinc-300 text-sm">
        Drag and drop an image, or <span className="text-indigo-400 underline">browse</span>
      </p>
      <p className="text-zinc-500 text-xs">PNG, JPEG, WEBP, GIF — up to 10MB</p>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
