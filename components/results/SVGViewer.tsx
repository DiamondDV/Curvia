'use client';

import { useCallback, useRef, useState } from 'react';

interface SVGViewerProps {
  svg: string;
}

/** Simple zoom/pan viewer: wheel to zoom, drag to pan, double-click to reset. */
export function SVGViewer({ svg }: SVGViewerProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setScale((prev) => Math.min(8, Math.max(0.25, prev * (e.deltaY < 0 ? 1.1 : 0.9))));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: offset.x,
        originY: offset.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [offset],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const { startX, startY, originX, originY } = dragState.current;
    setOffset({ x: originX + (e.clientX - startX), y: originY + (e.clientY - startY) });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div
      className="relative h-96 w-full overflow-hidden rounded-xl border border-zinc-800 bg-[radial-gradient(circle,_#27272a_1px,_transparent_1px)] bg-[length:16px_16px] cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={reset}
    >
      <div
        className="absolute left-1/2 top-1/2 h-0 w-0"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
        // Trusted content: this SVG is our own pipeline's output (VTracer +
        // Gemini repair + SVGO), never raw user HTML — safe to inject.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <button
        onClick={reset}
        type="button"
        className="absolute bottom-2 right-2 rounded-md bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-300 hover:text-white"
      >
        Reset view
      </button>
    </div>
  );
}
