'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronDown } from 'lucide-react';
import { MatchChip } from '@/lib/social-export/prefill';

interface FieldInsertMenuProps {
  /** Available match-data values. */
  chips: MatchChip[];
  /** Called with the chosen value (the parent decides how to apply it). */
  onSelect: (value: string) => void;
  disabled?: boolean;
}

const MENU_WIDTH = 256;
const MARGIN = 8;
const GAP = 4;
const MAX_MENU_HEIGHT = 288;

interface MenuPos {
  top: number;
  left: number;
  maxHeight: number;
  /** Whether the menu is anchored below (default) or flipped above the trigger. */
  placement: 'below' | 'above';
}

/**
 * Per-field "vložit" (insert) dropdown: lists match-data values (Domácí, Skóre,
 * Datum, …) and inserts the chosen one into THIS field.
 *
 * The menu is **portaled to <body>** with fixed positioning anchored to the
 * trigger button. That is deliberate: this menu is rendered inside the preview's
 * FloatingPanel, whose `overflow-y-auto` + max-height would otherwise CLIP an
 * absolutely-positioned dropdown (and tuck it behind the panel scrollbar).
 * A fixed, body-portaled menu escapes every overflow ancestor. It keeps
 * `role="menu"` so FloatingPanel's outside-pointerdown handler (which exempts
 * `[role="menu"]`) does not treat a menu click as "click outside" and close the panel.
 */
export default function FieldInsertMenu({ chips, onSelect, disabled }: FieldInsertMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    // Right-align the menu to the trigger, clamped within the viewport.
    const left = Math.min(
      Math.max(MARGIN, r.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - MARGIN
    );
    const spaceBelow = window.innerHeight - r.bottom - MARGIN;
    const spaceAbove = r.top - MARGIN;
    // Prefer below; flip above only when below is cramped and above has more room.
    const placeBelow = spaceBelow >= 200 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(
      120,
      Math.min(MAX_MENU_HEIGHT, (placeBelow ? spaceBelow : spaceAbove) - GAP)
    );
    setPos({
      top: placeBelow ? r.bottom + GAP : r.top - GAP,
      left: Math.max(MARGIN, left),
      maxHeight,
      placement: placeBelow ? 'below' : 'above',
    });
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Position the menu before paint when it opens, and keep it glued to the
  // trigger on scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open, updatePos]);

  // Move focus into the menu when it opens (keyboard-first), after it mounts.
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onScrollOrResize() {
      updatePos();
    }
    function onDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close(true);
    }

    // capture so we catch scrolls in any ancestor (the FloatingPanel scrolls).
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, updatePos, close]);

  // Roving keyboard navigation within the menu (WAI-ARIA menu contract).
  function onMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        items[(idx + 1) % items.length].focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length].focus();
        break;
      case 'Home':
        e.preventDefault();
        items[0].focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1].focus();
        break;
      case 'Tab':
        e.preventDefault();
        close(true);
        break;
    }
  }

  if (chips.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        title="Vložit data zápasu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus className="h-3.5 w-3.5" />
        vložit
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={onMenuKeyDown}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              maxHeight: pos.maxHeight,
              transform: pos.placement === 'above' ? 'translateY(-100%)' : undefined,
            }}
            className="z-[60] overflow-auto rounded-lg border border-border bg-white py-1 shadow-xl"
          >
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelect(chip.value);
                  close(true);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-surface-hover"
              >
                <span className="whitespace-nowrap text-sm font-medium text-text-primary">
                  {chip.label}
                </span>
                <span
                  className="max-w-[55%] truncate text-xs text-text-muted"
                  title={chip.value}
                >
                  {chip.value}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
