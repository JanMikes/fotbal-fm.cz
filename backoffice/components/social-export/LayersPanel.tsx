'use client';

import { Eye, EyeOff, Image as ImageIcon, Layers, Lock, Type } from 'lucide-react';
import type { ActivePlaceholder } from './PlaceholderOverlay';
import type { LayerRow } from '@/lib/social-export/layers';

interface LayersPanelProps {
  /** Ordered rows (topmost first) from `buildLayerRows`. */
  rows: LayerRow[];
  active: ActivePlaceholder | null;
  /** Row click — same handler chain as the on-preview pencil. */
  onSelect: (placeholder: ActivePlaceholder) => void;
  /** Row eye — same handler chain as the on-preview eye. */
  onToggleHidden: (placeholder: ActivePlaceholder) => void;
  /** Hover/focus enters a row (null = left) — highlights its box on the preview. */
  onHover: (placeholder: ActivePlaceholder | null) => void;
}

/**
 * Photoshop-style "Vrstvy" panel beside the preview: one row per placeholder in
 * canvas stacking order (topmost first). Hovering a row highlights its zone
 * over the preview; clicking opens the same editor the zone's pencil opens
 * (text panel / image gallery modal); the eye mirrors the on-preview toggle.
 * Purely a navigation aid — the stack itself is fixed by the designer.
 */
export default function LayersPanel({
  rows,
  active,
  onSelect,
  onToggleHidden,
  onHover,
}: LayersPanelProps) {
  if (rows.length === 0) return null;

  return (
    <aside
      className="w-full shrink-0 rounded-xl border border-border bg-surface p-3 lg:sticky lg:top-4 lg:w-60"
      aria-label="Vrstvy šablony"
    >
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        Vrstvy
      </h4>
      <ul className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto" role="list">
        {rows.map((row) => {
          const placeholder: ActivePlaceholder = { kind: row.kind, id: row.id };
          const isActive = active?.kind === row.kind && active.id === row.id;
          const KindIcon = row.kind === 'image' ? ImageIcon : Type;

          return (
            <li
              key={`${row.kind}-${row.id}`}
              className={`flex items-center gap-0.5 rounded-lg transition-colors ${
                isActive ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-surface-hover'
              } ${row.editable ? '' : 'opacity-60'}`}
              onMouseEnter={() => onHover(placeholder)}
              onMouseLeave={() => onHover(null)}
            >
              {row.clickable ? (
                <button
                  type="button"
                  onClick={() => onSelect(placeholder)}
                  onFocus={() => onHover(placeholder)}
                  onBlur={() => onHover(null)}
                  title={`Upravit: ${row.label}`}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring-focus"
                >
                  <KindIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                  <span
                    className={`min-w-0 flex-1 truncate ${
                      row.hidden ? 'line-through opacity-60' : ''
                    }`}
                  >
                    {row.label}
                  </span>
                </button>
              ) : (
                <span
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-sm"
                  title={row.editable ? row.label : 'Pevná součást šablony'}
                >
                  <KindIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                  <span
                    className={`min-w-0 flex-1 truncate ${
                      row.hidden ? 'line-through opacity-60' : ''
                    }`}
                  >
                    {row.label}
                  </span>
                  {!row.editable && (
                    <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                  )}
                </span>
              )}
              {row.hidable && (
                <button
                  type="button"
                  onClick={() => onToggleHidden(placeholder)}
                  aria-pressed={row.hidden}
                  title={row.hidden ? `Zobrazit: ${row.label}` : `Skrýt: ${row.label}`}
                  aria-label={row.hidden ? `Zobrazit: ${row.label}` : `Skrýt: ${row.label}`}
                  className={`mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring-focus ${
                    row.hidden
                      ? 'text-danger hover:bg-danger/10'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
                  }`}
                >
                  {row.hidden ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
