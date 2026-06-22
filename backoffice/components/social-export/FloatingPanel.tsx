'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { DisplayRect } from '@/lib/social-export/geometry';

interface FloatingPanelProps {
  /** The active box's rect in display px, relative to the stage (the offset parent). */
  anchorRect: DisplayRect;
  /** The stage's current size in display px, used to keep the panel in view. */
  stageWidth: number;
  stageHeight: number;
  onClose: () => void;
  children: ReactNode;
}

const PANEL_WIDTH = 300;
const GAP = 12;
const MARGIN = 8;

/**
 * A panel absolutely positioned inside the preview stage, anchored beside the
 * active placeholder box. It flips above/below and clamps horizontally to stay
 * within the stage; it measures its own height to decide the flip. Closes on
 * Escape and on an outside pointer-down.
 *
 * Positioning is written directly to the element's style (an "external system"
 * update from the layout effect) instead of React state, so re-anchoring after a
 * measure never triggers a cascading render.
 */
export default function FloatingPanel({
  anchorRect,
  stageWidth,
  stageHeight,
  onClose,
  children,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const panelH = panel.offsetHeight;
    const panelW = panel.offsetWidth || PANEL_WIDTH;

    // Horizontal: align to the box's left edge, clamp within the stage.
    const maxLeft = Math.max(MARGIN, stageWidth - panelW - MARGIN);
    const left = Math.min(Math.max(MARGIN, anchorRect.left), maxLeft);

    // Vertical: prefer below the box; flip above when it would overflow the stage
    // and there is more room above.
    const belowTop = anchorRect.top + anchorRect.height + GAP;
    const aboveTop = anchorRect.top - GAP - panelH;
    const spaceBelow = stageHeight - belowTop;
    const spaceAbove = anchorRect.top;

    let top = panelH + GAP <= spaceBelow || spaceBelow >= spaceAbove ? belowTop : aboveTop;
    // Final vertical clamp so the panel never spills out of the stage.
    top = Math.min(Math.max(MARGIN, top), Math.max(MARGIN, stageHeight - panelH - MARGIN));

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }, [anchorRect.left, anchorRect.top, anchorRect.height, stageWidth, stageHeight]);

  // Reposition after the panel renders (so offsetHeight is known) and whenever
  // the anchor/stage changes.
  useLayoutEffect(() => {
    reposition();
  }, [reposition]);

  // Reposition if the panel's own content height changes (e.g. an image preview
  // loads, or a slot is hidden/shown).
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => reposition());
    ro.observe(panel);
    return () => ro.disconnect();
  }, [reposition]);

  // Escape closes; outside pointer-down closes (but not clicks inside the panel,
  // nor inside a portaled modal/menu opened from within it).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      // Ignore clicks inside any portaled overlay (modal/dropdown) opened from
      // the panel — those live outside the panel DOM subtree.
      if (target instanceof Element && target.closest('[role="dialog"],[role="menu"]')) return;
      onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      className="pointer-events-auto absolute z-30 rounded-xl border border-border bg-white p-3 shadow-2xl"
      // Start off-screen until the layout effect positions it (avoids a flash at 0,0).
      style={{ left: '-9999px', top: '0px', width: `${PANEL_WIDTH}px` }}
    >
      {children}
    </div>
  );
}
