'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react';
import { ImageIcon } from 'lucide-react';
import type { ImageFrameDTO } from '@/lib/social-export/api-types';
import {
  clamp,
  IMAGE_SCALE_MAX,
  IMAGE_SCALE_MIN,
} from '@/lib/social-export/field-rules-image';

interface FrameEditorProps {
  frame: ImageFrameDTO | null;
  /** Chosen image url (object-contain + transform applied), or null. */
  imageUrl: string | null;
  /** Stand-in shown (dimmed) when no image is chosen. */
  standInUrl: string | null;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  allowMove: boolean;
  allowResize: boolean;
  onChange: (partial: Partial<{ scale: number; offsetX: number; offsetY: number; rotation: number }>) => void;
}

/** Light checkerboard so transparent PNGs read clearly behind the picture. */
const CHECKERBOARD = {
  backgroundColor: '#fbfbfb',
  backgroundImage:
    'linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
} as const;

/**
 * Live, interactive preview of one image slot's frame. The picture is placed
 * object-contain + centered (matching the server), then panned/zoomed/rotated
 * via a CSS transform. Pan uses percentage translate so it needs no measurement
 * to render; drag converts pointer delta to canvas px using the frame's display
 * scale. This is a positioning AID — the right-hand server render is authoritative.
 */
export default function FrameEditor({
  frame,
  imageUrl,
  standInUrl,
  scale,
  offsetX,
  offsetY,
  rotation,
  allowMove,
  allowResize,
  onChange,
}: FrameEditorProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    displayScale: number;
  } | null>(null);

  const frameW = frame?.width && frame.width > 0 ? frame.width : 1;
  const frameH = frame?.height && frame.height > 0 ? frame.height : 1;
  const canDrag = allowMove && !!imageUrl;

  // translate via % of the element's own (displayed-frame) size → equals
  // offset(px) * displayScale, with no JS measurement needed to render.
  const transform = imageUrl
    ? `translate(${(offsetX / frameW) * 100}%, ${(offsetY / frameH) * 100}%) rotate(${rotation}deg) scale(${scale})`
    : undefined;

  // Wheel-to-zoom needs a non-passive listener to preventDefault page scroll.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !allowResize || !imageUrl) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      onChange({ scale: clamp(scale * factor, IMAGE_SCALE_MIN, IMAGE_SCALE_MAX) });
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [allowResize, imageUrl, scale, onChange]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!canDrag) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: offsetX,
      baseY: offsetY,
      displayScale: rect.width / frameW,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dxCanvas = (e.clientX - d.startX) / d.displayScale;
    const dyCanvas = (e.clientY - d.startY) / d.displayScale;
    onChange({ offsetX: d.baseX + dxCanvas, offsetY: d.baseY + dyCanvas });
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`relative w-full overflow-hidden rounded-xl border border-border ${
        canDrag ? 'cursor-grab touch-none select-none active:cursor-grabbing' : ''
      }`}
      style={{ aspectRatio: `${frameW}/${frameH}`, ...CHECKERBOARD }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Náhled obrázku ve slotu"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          style={{ transform, transformOrigin: 'center center', willChange: 'transform' }}
        />
      ) : standInUrl ? (
        <>
          <img
            src={standInUrl}
            alt="Výchozí obrázek"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-60"
          />
          <span className="absolute left-2 top-2 rounded-full border border-border bg-white/90 px-2 py-0.5 text-[11px] font-medium text-text-muted">
            výchozí
          </span>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-text-muted">
          <ImageIcon className="h-8 w-8" strokeWidth={1.2} />
          <span className="text-xs">Žádný obrázek</span>
        </div>
      )}

      {canDrag && (
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-medium text-white">
          Tažením posuňte
        </span>
      )}
    </div>
  );
}
