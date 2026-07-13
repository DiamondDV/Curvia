'use client';

import { useCallback, useEffect, useRef } from 'react';

interface SVGViewerProps {
  svg: string;
  scale: number;
  offset: { x: number; y: number };
  onScaleChange: (scale: number) => void;
  onOffsetChange: (offset: { x: number; y: number }) => void;
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 8;

/** Pan/zoom-transformed SVG content. Fully controlled — CanvasStage owns
 *  scale/offset so the toolbar's zoom buttons and this view's own wheel/drag
 *  handling stay in sync. No background/border here; the artboard chrome
 *  around it lives in CanvasStage. */
export function SVGViewer({ svg, scale, offset, onScaleChange, onOffsetChange }: SVGViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );
  // Wheel handler needs the *latest* scale/onScaleChange without re-binding
  // the native listener on every scale change (see effect below).
  const latest = useRef({ scale, onScaleChange });
  latest.current = { scale, onScaleChange };

  // React's synthetic onWheel is always attached passively, so
  // e.preventDefault() inside it throws "Unable to preventDefault inside
  // passive event listener invocation" — it can't stop page scroll while
  // zooming. A real addEventListener with { passive: false } is the only
  // way to get a cancelable wheel listener.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { scale: s, onScaleChange: setScale } = latest.current;
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (e.deltaY < 0 ? 1.1 : 0.9))));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragState.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [offset],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState.current) return;
      const { startX, startY, originX, originY } = dragState.current;
      onOffsetChange({ x: originX + (e.clientX - startX), y: originY + (e.clientY - startY) });
    },
    [onOffsetChange],
  );

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full cursor-grab overflow-hidden active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="flex h-full w-full items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        // Trusted content: this SVG is our own pipeline's output (VTracer +
        // code-based structurer + SVGO), never raw user HTML — safe to inject.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
