'use client';

import { Pencil } from 'lucide-react';
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
 */
export default function PlaceholderBox({
  rect,
  label,
  active,
  readOnly = false,
  onEdit,
}: PlaceholderBoxProps) {
  return (
    <div
      className={`pointer-events-none absolute rounded-sm border-2 border-dashed transition-colors ${
        active ? 'border-accent bg-accent/5' : 'border-accent/60 hover:border-accent'
      }`}
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
    >
      {!readOnly && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Upravit: ${label}`}
          title={`Upravit: ${label}`}
          aria-pressed={active}
          className={`pointer-events-auto absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus ${
            active
              ? 'bg-accent text-white'
              : 'bg-white text-accent hover:bg-accent hover:text-white'
          }`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
