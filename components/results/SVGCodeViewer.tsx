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
    <div className="relative rounded-xl border border-zinc-800 bg-zinc-950">
      <button
        onClick={handleCopy}
        type="button"
        className="absolute top-2 right-2 rounded-md bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:text-white"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="max-h-96 overflow-auto p-4 text-[12px] leading-relaxed text-zinc-300">
        <code>{svg}</code>
      </pre>
    </div>
  );
}
