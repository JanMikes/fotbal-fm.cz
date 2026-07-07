'use client';

import type { CSSProperties } from 'react';
import type { DisplayRect } from '@/lib/social-export/geometry';

interface PlaceholderBoxProps {
  /** Position/size of the box in display px, relative to the overlay. */
  rect: DisplayRect;
  /** Whether this box's editing panel is currently open. */
  active: boolean;
  /** Whether the box's row is hovered in the layers panel: active-like emphasis. */
  hovered?: boolean;
  /** Locked text inputs: muted, never-editable treatment. */
  readOnly?: boolean;
  /** Hidden slots: hatched "won't appear in the export" treatment. */
  hidden?: boolean;
  /** Member of a container whose texts overflowed on the last render: red. */
  error?: boolean;
  /** Field name shown as a small tag inside the box (top edge). */
  label?: string;
}

const DUAL_OUTLINE = '0 0 0 1px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.5)';
// Diagonal hatch marking a region that won't appear in the export.
const HATCH =
  'repeating-linear-gradient(45deg, rgba(100,116,139,0.18) 0, rgba(100,116,139,0.18) 6px, rgba(100,116,139,0) 6px, rgba(100,116,139,0) 12px)';

/**
 * One placeholder highlight: just the dashed bordered box over the preview. It is
 * purely decorative (`pointer-events-none`) — the interactive pencil/eye/lock
 * controls live in a SEPARATE, higher-z layer (`PlaceholderTools`) so a
 * neighbouring box's border can never paint over another box's icons.
 *
 * A dual (dark + light) outline is baked in so the dashed stroke stays legible
 * over arbitrary artwork. Hidden slots get a hatched fill so the "will be removed
 * from the export" state reads at a glance, even before the debounced re-render.
 */
export default function PlaceholderBox({
  rect,
  active,
  hovered = false,
  readOnly = false,
  hidden = false,
  error = false,
  label,
}: PlaceholderBoxProps) {
  const emphasized = active || hovered;
  const borderColor = error
    ? 'border-danger'
    : hidden
      ? 'border-text-muted'
      : readOnly
        ? 'border-text-muted/60'
        : emphasized
          ? 'border-accent'
          : 'border-accent/80';

  // Name tag colour follows the border treatment so the two read as one signal.
  const tagColor = error
    ? 'bg-danger'
    : hidden || readOnly
      ? 'bg-text-muted'
      : 'bg-accent';

  const style: CSSProperties = {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    boxShadow: DUAL_OUTLINE,
  };
  if (hidden) style.backgroundImage = HATCH;

  return (
    <div
      className={`pointer-events-none absolute rounded-sm border-2 transition-colors ${
        emphasized && !hidden ? 'border-solid bg-accent/10' : 'border-dashed'
      } ${borderColor}`}
      style={style}
      aria-hidden="true"
    >
      {label ? (
        // Top-LEFT, opposite the top-right tool cluster, with the tool corner
        // reserved so the name is never hidden under the pencil.
        <span
          className={`pointer-events-none absolute left-0 top-0 max-w-[calc(100%-4rem)] truncate rounded-br-sm px-1 py-px text-[11px] font-semibold leading-tight text-white ${tagColor}`}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
