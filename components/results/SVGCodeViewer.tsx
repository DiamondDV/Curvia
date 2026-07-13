'use client';

import { useState } from 'react';

interface SVGCodeViewerProps {
  svg: string;
}

export function SVGCodeViewer({ svg }: SVGCodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(svg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <button
        onClick={handleCopy}
        type="button"
        className="absolute right-3 top-3 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 shadow-sm hover:text-zinc-900"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="h-full overflow-auto p-4 text-[12px] leading-relaxed text-zinc-700">
        <code>{svg}</code>
      </pre>
    </div>
  );
}
