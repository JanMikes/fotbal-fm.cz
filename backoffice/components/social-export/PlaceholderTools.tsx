'use client';

import { Pencil, Lock, Eye, EyeOff } from 'lucide-react';

interface PlaceholderToolsProps {
  /** Computed position of the cluster in display px, relative to the overlay. */
  left: number;
  top: number;
  /** Accessible label fragment (the placeholder's name). */
  label: string;
  /** Whether this placeholder's editing panel is currently open. */
  active: boolean;
  /** Locked text input: show a lock indicator instead of a pencil. */
  readOnly: boolean;
  /** Whether this placeholder may be hidden (shows the eye toggle). */
  hidable: boolean;
  /** Current hidden state (eye → crossed-out eye). */
  hidden: boolean;
  /** Open the editing panel. */
  onEdit: () => void;
  /** Toggle the hidden state. */
  onToggleHidden: () => void;
}

/**
 * The always-on-top control cluster for one placeholder: a pencil (edit) and,
 * when the slot is hidable, an eye (show/hide) — or a lock indicator for locked
 * text. It lives in the overlay's top layer so it always paints above EVERY box
 * border, regardless of placeholder order or overlap.
 *
 * At rest the cluster is slightly translucent so it doesn't permanently obscure
 * the artwork; it returns to full opacity (and pops above neighbours) on hover,
 * focus, or while its panel is active. The cluster carries `data-pp-tools` so the
 * FloatingPanel's outside-pointerdown handler treats a tool click as "inside"
 * and doesn't dismiss an open panel.
 */
export default function PlaceholderTools({
  left,
  top,
  label,
  active,
  readOnly,
  hidable,
  hidden,
  onEdit,
  onToggleHidden,
}: PlaceholderToolsProps) {
  // Dark hairline ring keeps the white pills legible on bright/white artwork
  // (mirrors the dual-outline trick on the dashed box). focus:ring swaps it for
  // the focus ring.
  const btnBase =
    'pointer-events-auto flex h-[30px] w-[30px] items-center justify-center rounded-full shadow-md ring-1 ring-black/30 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring-focus';

  return (
    <div
      data-pp-tools=""
      className={`pointer-events-none absolute flex items-center gap-1 transition-opacity ${
        active
          ? 'z-30 opacity-100'
          : 'z-20 opacity-80 hover:z-30 hover:opacity-100 focus-within:z-30 focus-within:opacity-100'
      }`}
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      {readOnly ? (
        <span
          aria-label={`Uzamčeno: ${label}`}
          title={`Toto pole je uzamčené šablonou a nelze ho upravit.`}
          className="pointer-events-none flex h-[26px] w-[26px] items-center justify-center rounded-md bg-white/85 text-text-muted ring-1 ring-black/20"
        >
          <Lock className="h-3.5 w-3.5" />
        </span>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Upravit: ${label}`}
          title={`Upravit: ${label}`}
          aria-pressed={active}
          className={`${btnBase} ${
            active ? 'bg-accent text-white' : 'bg-white text-accent hover:bg-accent hover:text-white'
          }`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}

      {hidable && (
        <button
          type="button"
          onClick={onToggleHidden}
          aria-label={hidden ? `Zobrazit: ${label}` : `Skrýt: ${label}`}
          title={hidden ? `Zobrazit: ${label}` : `Skrýt: ${label}`}
          aria-pressed={hidden}
          className={`${btnBase} ${
            hidden
              ? 'bg-text-muted text-white hover:bg-text-secondary'
              : 'bg-white text-text-primary hover:bg-surface-hover'
          }`}
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
