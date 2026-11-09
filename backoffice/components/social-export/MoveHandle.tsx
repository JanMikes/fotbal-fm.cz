'use client';

import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Move, MoveHorizontal, MoveVertical } from 'lucide-react';
import { clampToRange, round2 } from '@/lib/social-export/element-move';
import type { ElementOffset, MovableElementDTO } from '@/lib/social-export/api-types';

interface MoveHandleProps {
  element: MovableElementDTO;
  /** Accessible label fragment (the element's name). */
  label: string;
  /** canvas px → display px. */
  scale: number;
  /** The committed offset (canvas px). */
  offset: ElementOffset;
  /** Live offset while dragging (null = the drag ended / was cancelled). */
  onPreview: (offset: ElementOffset | null) => void;
  /** A finished drag / nudge. */
  onCommit: (offset: ElementOffset) => void;
  /** A click without a drag: open the exact "Poloha" panel. */
  onOpen: () => void;
  /** Whether the element's "Poloha" panel is open. */
  active?: boolean;
}

/** A press that moves less than this (screen px) is a click. */
const CLICK_SLOP = 3;
/** Within this many screen px of the designed spot the drag snaps home. */
const HOME_MAGNET = 6;

/**
 * The ✥ / ↕ / ↔ tool of a movable element (WBoost "Uživatel může posunout",
 * M3/M4 port, kept simpler): drag it to move the element along its allowed
 * axes — clamped to the element's `range`, magnetic to its designed spot —
 * the box follows live and the real render comes after release. A click
 * opens the exact "Poloha" panel; the arrow keys nudge by 1 px (Shift = 10)
 * while the tool has focus.
 */
export default function MoveHandle({ element, label, scale, offset, onPreview, onCommit, onOpen, active = false }: MoveHandleProps) {
  const drag = useRef<{ x: number; y: number; moved: boolean; current: ElementOffset } | null>(null);
  const Icon = element.vertical && element.horizontal ? Move : element.vertical ? MoveVertical : MoveHorizontal;
  const title = element.vertical && element.horizontal ? 'Posunout' : element.vertical ? 'Posunout nahoru / dolů' : 'Posunout doleva / doprava';

  const candidate = (clientX: number, clientY: number): ElementOffset => {
    const start = drag.current!;
    const dx = element.horizontal ? (clientX - start.x) / scale : 0;
    const dy = element.vertical ? (clientY - start.y) / scale : 0;
    let next = clampToRange(element.range, offset.x + dx, offset.y + dy);
    // Magnetic home: the designed position is easy to get back to.
    if (Math.hypot(next.x * scale, next.y * scale) <= HOME_MAGNET) next = { x: 0, y: 0 };
    return next;
  };

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, moved: false, current: offset };
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start) return;
    if (!start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= CLICK_SLOP) return;
    start.moved = true;
    start.current = candidate(event.clientX, event.clientY);
    onPreview(start.current);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!start) return;
    if (!start.moved) {
      onOpen();
      return;
    }
    onPreview(null);
    if (start.current.x !== offset.x || start.current.y !== offset.y) onCommit(start.current);
  }

  function handlePointerCancel() {
    if (!drag.current) return;
    drag.current = null;
    onPreview(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft' && element.horizontal) dx = -step;
    else if (event.key === 'ArrowRight' && element.horizontal) dx = step;
    else if (event.key === 'ArrowUp' && element.vertical) dy = -step;
    else if (event.key === 'ArrowDown' && element.vertical) dy = step;
    else return;
    event.preventDefault();
    const next = clampToRange(element.range, round2(offset.x + dx), round2(offset.y + dy));
    if (next.x !== offset.x || next.y !== offset.y) onCommit(next);
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      aria-label={`${title}: ${label}`}
      title={`${title} — táhněte, klikněte pro přesnou polohu (šipky posunou o 1 px, se Shiftem o 10 px)`}
      aria-pressed={active}
      className={`pointer-events-auto flex h-[30px] w-[30px] touch-none cursor-grab items-center justify-center rounded-full shadow-md ring-1 ring-black/30 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring-focus active:cursor-grabbing ${
        active ? 'bg-accent text-white' : 'bg-white text-accent hover:bg-accent hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
