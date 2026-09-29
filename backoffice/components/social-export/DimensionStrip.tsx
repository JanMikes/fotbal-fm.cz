'use client';

import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import type { TemplateVariantDTO } from '@/lib/social-export/api-types';

interface DimensionStripProps {
  members: TemplateVariantDTO[];
  activeId: string;
  onActivate: (variantId: string) => void;
  /** Latest preview object URL per dimension (null while none rendered yet). */
  previews: Record<string, string | null>;
  renderingIds: ReadonlySet<string>;
  /** Dimensions whose texts are predicted to (or did) overflow. */
  overflowingIds: ReadonlySet<string>;
  onDownload: (variantId: string) => void;
  downloadDisabled: (variantId: string) => boolean;
}

/**
 * Every member dimension of a group side by side — the WBoost group fill
 * page's overview: each card shows that dimension's live preview, flags a
 * text overflow, downloads that dimension as PNG, and a click makes it the
 * dimension edited in the big preview below (texts are shared, so editing
 * any dimension changes all of them; picture placement is per dimension).
 */
export default function DimensionStrip({
  members,
  activeId,
  onActivate,
  previews,
  renderingIds,
  overflowingIds,
  onDownload,
  downloadDisabled,
}: DimensionStripProps) {
  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-1" role="tablist" aria-label="Rozměry šablony">
      {members.map((member) => {
        const active = member.id === activeId;
        const preview = previews[member.id] ?? null;
        const rendering = renderingIds.has(member.id);
        const overflowing = overflowingIds.has(member.id);

        return (
          <div
            key={member.id}
            className={`flex w-40 shrink-0 flex-col overflow-hidden rounded-xl border bg-surface transition-colors ${
              active ? 'border-accent ring-2 ring-accent/30' : overflowing ? 'border-danger' : 'border-border hover:border-accent'
            }`}
          >
            <div className="flex items-center justify-between gap-1 px-2 py-1.5">
              <span className="truncate text-xs font-semibold text-text-primary" title={member.dimension}>
                {member.dimension}
              </span>
              <button
                type="button"
                onClick={() => onDownload(member.id)}
                disabled={downloadDisabled(member.id)}
                title="Stáhnout tento rozměr jako PNG"
                className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-3 w-3" />
                PNG
              </button>
            </div>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onActivate(member.id)}
              className="relative block w-full bg-surface-hover focus:outline-none focus:ring-2 focus:ring-ring-focus"
              style={{ aspectRatio: `${member.width}/${member.height}` }}
              title={active ? 'Upravujete tento rozměr' : 'Upravit tento rozměr'}
            >
              {preview ? (
                <img src={preview} alt={`Náhled ${member.dimension}`} className="h-full w-full object-contain" />
              ) : member.thumbnailUrl ? (
                <img src={member.thumbnailUrl} alt="" className="h-full w-full object-contain opacity-60" />
              ) : null}
              {rendering && (
                <span className="absolute inset-0 flex items-center justify-center bg-white/50">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                </span>
              )}
              {overflowing && (
                <span
                  className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  title="Texty se v tomto rozměru nevejdou"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Přesah
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
