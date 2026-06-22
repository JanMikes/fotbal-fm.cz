'use client';

import { Pencil, Lock } from 'lucide-react';
import type { DisplayRect } from '@/lib/social-export/geometry';

interface PlaceholderBoxProps {
  /** Position/size of the box in display px, relative to the overlay. */
  rect: DisplayRect;
  /** Accessible label for the pencil button (the placeholder's name). */
  label: string;
  /** Whether this box's editing panel is currently open. */
  active: boolean;
  /** When true the box is shown but has no pencil (e.g. locked text). */
  readOnly?: boolean;
  /** Open this box's editing panel. */
  onEdit: () => void;
}

/**
 * One placeholder highlight: a dashed bordered box over the preview, with a
 * pencil button at its top-right corner. The box itself is pointer-events-none
 * (so it never blocks the image); only the pencil is interactive.
 *
 * A dual (dark + light) outline is baked in so the dashed border and the white
 * pencil badge stay legible over arbitrary artwork (which is often itself the
 * accent hue, or white). Locked placeholders get a muted, lock-marked treatment
 * matching the flat form's "uzamčeno" state.
 */
export default function PlaceholderBox({
  rect,
  label,
  active,
  readOnly = false,
  onEdit,
}: PlaceholderBoxProps) {
  const borderColor = readOnly
    ? 'border-text-muted/60'
    : active
      ? 'border-accent'
      : 'border-accent/80 hover:border-accent';

  return (
    <div
      className={`pointer-events-none absolute rounded-sm border-2 border-dashed transition-colors ${borderColor} ${
        active ? 'bg-accent/10' : ''
      }`}
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        // Dark + light outline so the dashed stroke reads on any background.
        boxShadow: '0 0 0 1px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.5)',
      }}
      {...(readOnly ? { title: `Uzamčeno: ${label}`, 'aria-label': `Uzamčeno: ${label}` } : {})}
    >
      {readOnly ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-text-muted shadow-md ring-1 ring-black/15"
        >
          <Lock className="h-3 w-3" />
        </span>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Upravit: ${label}`}
          title={`Upravit: ${label}`}
          aria-pressed={active}
          className={`pointer-events-auto absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full shadow-md ring-1 ring-black/15 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring-focus ${
            active
              ? 'bg-accent text-white'
              : 'bg-white text-accent hover:bg-accent hover:text-white'
          }`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
