'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NEUTRAL_PLACEMENT,
  ghostStyle,
  panFromDrag,
  type Placement,
} from '@/lib/social-export/image-placement';
import {
  IMAGE_SCALE_MAX,
  IMAGE_SCALE_MIN,
  clamp,
  type ImageSlotState,
} from '@/lib/social-export/field-rules-image';
import type { DisplayRect } from '@/lib/social-export/geometry';
import type { ImageFrameDTO, ImageInputDTO } from '@/lib/social-export/api-types';

interface ImagePlacementGhostProps {
  input: ImageInputDTO;
  /** The slot's designed frame (canvas px) — the clipping window. */
  frame: ImageFrameDTO;
  /** The same frame in display px, so the box lands over the rendered preview. */
  rect: DisplayRect;
  /** canvas-px → display-px factor. */
  scale: number;
  state: ImageSlotState;
  label: string;
  /** The preview on screen; a new one means the server caught up with the placement. */
  previewUrl?: string | null;
  onChange: (partial: Partial<ImageSlotState>) => void;
  /** Open this slot's editing panel (a click that wasn't a drag). */
  onSelect: () => void;
}

const WHEEL_STEP = 0.05;
const PINCH_STEP = 0.01;
/** Arrow-key nudge, as a fraction of the frame. */
const NUDGE = 0.01;
/** Pointer travel (px) below which a drag counts as a click. */
const CLICK_SLOP = 3;

/**
 * The picture the user drags. The exported PNG is rendered by WBoost and takes
 * seconds to come back, so the placement is edited on a local stand-in: a
 * clipped copy of the chosen picture drawn over the preview with the SAME math
 * the server uses ({@see lib/social-export/image-placement}). When the fresh
 * render lands it replaces the stand-in pixel-for-pixel.
 *
 * The stand-in stays transparent until the user starts placing — until then the
 * server render underneath is the truth and there is nothing to stand in for —
 * but the box itself is always present, because it IS the grab handle.
 *
 * Only the gestures the designer allowed do anything: drag/arrows need
 * `allowMove`, wheel needs `allowResize`. Rotation has no direct gesture and is
 * driven by the slot panel's slider.
 */
export default function ImagePlacementGhost({
  input,
  frame,
  rect,
  scale,
  state,
  label,
  previewUrl = null,
  onChange,
  onSelect,
}: ImagePlacementGhostProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);
  const url = state.image?.url ?? null;

  // Which preview the user is placing against. The stand-in is shown while that
  // is the preview on screen; the moment a FRESH render arrives it already has
  // this placement baked in, so the stand-in steps aside for the real pixels.
  // Derived rather than reset in an effect — every gesture re-stamps it, so a
  // render landing mid-drag cannot blink the picture out from under the pointer.
  const [placingAgainst, setPlacingAgainst] = useState<string | null | undefined>(undefined);
  const placing = placingAgainst !== undefined && placingAgainst === previewUrl;
  const startPlacing = useCallback(() => setPlacingAgainst(previewUrl), [previewUrl]);

  // Measure the picture: the contain-fit needs its intrinsic size, and it is the
  // same number the server reads out of the file. Kept WITH the url it belongs
  // to, so a slow measurement of a replaced picture is simply ignored.
  const [measured, setMeasured] = useState<{ url: string; width: number; height: number } | null>(
    null
  );
  const natural = measured && measured.url === url ? measured : null;

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onload = () => {
      if (!cancelled) {
        setMeasured({ url, width: probe.naturalWidth || 1, height: probe.naturalHeight || 1 });
      }
    };
    probe.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  const placement: Placement = {
    scale: state.scale ?? NEUTRAL_PLACEMENT.scale,
    offsetXRatio: state.offsetXRatio ?? NEUTRAL_PLACEMENT.offsetXRatio,
    offsetYRatio: state.offsetYRatio ?? NEUTRAL_PLACEMENT.offsetYRatio,
    rotation: state.rotation ?? NEUTRAL_PLACEMENT.rotation,
  };

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      // Even without move rights the box is clickable (it opens the panel) —
      // it just never pans.
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: placement.offsetXRatio,
        baseY: placement.offsetYRatio,
        moved: false,
      };
      boxRef.current?.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [placement.offsetXRatio, placement.offsetYRatio]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId || !input.allowMove) return;

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;

      if (!drag.moved && Math.abs(deltaX) < CLICK_SLOP && Math.abs(deltaY) < CLICK_SLOP) {
        return; // still within click slop — don't start panning on a stray pixel
      }

      drag.moved = true;
      startPlacing();

      const pan = panFromDrag(frame, scale, deltaX, deltaY);
      onChange({
        offsetXRatio: drag.baseX + pan.offsetXRatio,
        offsetYRatio: drag.baseY + pan.offsetYRatio,
      });
    },
    [frame, scale, input.allowMove, onChange, startPlacing]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      boxRef.current?.releasePointerCapture?.(event.pointerId);

      // A press that never moved is a click: open the slot's panel.
      if (drag && !drag.moved) onSelect();
    },
    [onSelect]
  );

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!input.allowResize) return;

      event.preventDefault();
      startPlacing();

      // A trackpad pinch arrives as ctrl+wheel, with much finer deltas.
      const step = event.ctrlKey ? PINCH_STEP : WHEEL_STEP;
      const direction = event.deltaY < 0 ? 1 : -1;

      onChange({
        scale: clamp(placement.scale + direction * step, IMAGE_SCALE_MIN, IMAGE_SCALE_MAX),
      });
    },
    [input.allowResize, onChange, placement.scale, startPlacing]
  );

  // Wheel must be a non-passive native listener: React's onWheel is passive, so
  // preventDefault() there cannot stop the page from scrolling.
  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-NUDGE, 0],
        ArrowRight: [NUDGE, 0],
        ArrowUp: [0, -NUDGE],
        ArrowDown: [0, NUDGE],
      };
      const delta = deltas[event.key];

      if (delta && input.allowMove) {
        event.preventDefault();
        startPlacing();
        onChange({
          offsetXRatio: placement.offsetXRatio + delta[0],
          offsetYRatio: placement.offsetYRatio + delta[1],
        });
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    },
    [input.allowMove, onChange, onSelect, placement.offsetXRatio, placement.offsetYRatio, startPlacing]
  );

  if (!url || !natural) return null;

  const adjustable = input.allowMove || input.allowResize || input.allowRotate;
  const cursor = input.allowMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';

  return (
    <div
      ref={boxRef}
      role="application"
      tabIndex={0}
      aria-label={`${label} — umístění obrázku${input.allowMove ? ' (táhněte myší, šipky posunou)' : ''}${input.allowResize ? ', kolečkem přiblížíte' : ''}`}
      title={adjustable ? 'Táhněte obrázkem, kolečkem přiblížíte' : label}
      className={`pointer-events-auto absolute overflow-hidden rounded-sm outline-none ring-accent focus-visible:ring-2 ${cursor} ${
        placing ? 'bg-white ring-2' : ''
      }`}
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        draggable={false}
        className={`pointer-events-none absolute max-w-none select-none ${placing ? 'opacity-100' : 'opacity-0'}`}
        style={ghostStyle(frame, natural, placement, scale)}
      />
    </div>
  );
}
