'use client';

import { FileText, ImageIcon, Layers } from 'lucide-react';
import { DocumentDTO, TemplateDTO } from '@/lib/social-export/api-types';
import { pagesWord } from '@/lib/social-export/document-fill';
import SavedBadge from './SavedBadge';

interface TemplateGridProps {
  /** Ordinary templates — page templates of a document must be filtered out by the caller. */
  templates: TemplateDTO[];
  onSelect: (template: TemplateDTO) => void;
  /** Multi-page documents, listed next to the templates of their category. */
  documents?: DocumentDTO[];
  onSelectDocument?: (document: DocumentDTO) => void;
  /** Variant ids that have a saved editing state for the current match. */
  savedVariantIds?: ReadonlySet<string>;
}

type GridEntry =
  | { kind: 'template'; item: TemplateDTO }
  | { kind: 'document'; item: DocumentDTO };

// Group entries by categoryName, with null grouped as "Ostatní"
function groupEntries(entries: GridEntry[]): Array<{ category: string; items: GridEntry[] }> {
  const groupMap = new Map<string, GridEntry[]>();

  // Sort within each group by position then name (documents share the templates' sort space)
  const sorted = [...entries].sort((a, b) => {
    if (a.item.position !== b.item.position) return a.item.position - b.item.position;
    return a.item.name.localeCompare(b.item.name, 'cs');
  });

  for (const entry of sorted) {
    const key = entry.item.categoryName ?? 'Ostatní';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(entry);
  }

  // Build ordered groups: named categories first (sorted), then "Ostatní" last
  const groups: Array<{ category: string; items: GridEntry[] }> = [];
  const keys = Array.from(groupMap.keys()).sort((a, b) => {
    if (a === 'Ostatní') return 1;
    if (b === 'Ostatní') return -1;
    return a.localeCompare(b, 'cs');
  });

  for (const key of keys) {
    groups.push({ category: key, items: groupMap.get(key)! });
  }

  return groups;
}

/**
 * Responsive grid of template cards, grouped by category.
 * Templates with no variants are shown as disabled.
 */
export default function TemplateGrid({
  templates,
  onSelect,
  documents = [],
  onSelectDocument,
  savedVariantIds,
}: TemplateGridProps) {
  const groups = groupEntries([
    ...templates.map((item): GridEntry => ({ kind: 'template', item })),
    ...documents.map((item): GridEntry => ({ kind: 'document', item })),
  ]);

  return (
    <div className="space-y-8">
      {groups.map(({ category, items }) => (
        <section key={category}>
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            {category}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((entry) => {
              if (entry.kind === 'document') {
                return (
                  <DocumentCard
                    key={`document-${entry.item.id}`}
                    document={entry.item}
                    onSelect={() => onSelectDocument?.(entry.item)}
                    saved={savedVariantIds?.has(entry.item.id) === true}
                  />
                );
              }
              const template = entry.item;
              const hasVariants = template.variants.length > 0;
              const thumbUrl = template.variants[0]?.thumbnailUrl ?? null;
              const dimensionList = template.variants.map((v) => v.dimension).join(', ');
              const hasSavedState =
                template.variants.some((v) => savedVariantIds?.has(v.id)) ||
                (template.group != null && savedVariantIds?.has(template.group.id) === true);

              return (
                <button
                  key={template.id}
                  type="button"
                  disabled={!hasVariants}
                  onClick={() => hasVariants && onSelect(template)}
                  className={`
                    group flex flex-col rounded-xl border overflow-hidden text-left transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-ring-focus
                    ${hasVariants
                      ? 'border-border bg-surface hover:border-accent hover:shadow-md cursor-pointer active:scale-[0.98]'
                      : 'border-border bg-surface opacity-50 cursor-not-allowed'}
                  `}
                >
                  {/* Thumbnail area */}
                  <div className="relative w-full aspect-video bg-surface-hover flex items-center justify-center overflow-hidden">
                    {thumbUrl ? (
                      <ThumbnailImage src={thumbUrl} alt={template.name} />
                    ) : (
                      <PlaceholderTile />
                    )}
                    {!hasVariants && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <span className="text-xs font-medium text-text-muted bg-white px-2 py-0.5 rounded-full border border-border">
                          Žádné varianty
                        </span>
                      </div>
                    )}
                    {hasSavedState && <SavedBadge className="absolute top-1.5 right-1.5" />}
                    {template.group && (
                      <span
                        className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 text-[10px] font-medium text-text-secondary"
                        title="Jedna grafika ve více rozměrech — vyplníte jednou, stáhnete najednou"
                      >
                        <Layers className="h-3 w-3" />
                        Všechny rozměry
                      </span>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-3 flex-1 flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-text-primary line-clamp-2 group-hover:text-accent transition-colors">
                      {template.name}
                    </p>
                    {template.categoryName && (
                      <p className="text-xs text-text-muted">{template.categoryName}</p>
                    )}
                    {dimensionList && (
                      <p className="text-xs text-text-muted mt-1">{dimensionList}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A multi-page document: up to three page thumbnails fanned out, name, page count. */
function DocumentCard({
  document,
  onSelect,
  saved,
}: {
  document: DocumentDTO;
  onSelect: () => void;
  /** A saved fill exists for this match. */
  saved: boolean;
}) {
  const hasPages = document.pages.length > 0;
  const thumbs = document.pages.slice(0, 3);

  return (
    <button
      type="button"
      disabled={!hasPages}
      onClick={() => hasPages && onSelect()}
      className={`
        group flex flex-col rounded-xl border overflow-hidden text-left transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-ring-focus
        ${hasPages
          ? 'border-border bg-surface hover:border-accent hover:shadow-md cursor-pointer active:scale-[0.98]'
          : 'border-border bg-surface opacity-50 cursor-not-allowed'}
      `}
    >
      <div className="relative flex w-full aspect-video items-center justify-center gap-1.5 overflow-hidden bg-surface-hover p-2">
        {thumbs.length > 0 ? (
          thumbs.map((page) => (
            <div
              key={page.id}
              className="h-full overflow-hidden rounded border border-border bg-white shadow-sm"
              style={{ aspectRatio: `${page.variant.width}/${page.variant.height}` }}
            >
              {page.variant.thumbnailUrl ? (
                <ThumbnailImage src={page.variant.thumbnailUrl} alt={page.templateName} />
              ) : (
                <PlaceholderTile />
              )}
            </div>
          ))
        ) : (
          <PlaceholderTile />
        )}
        <span
          className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 text-[10px] font-medium text-text-secondary"
          title="Vícestránkový dokument — vyplníte stranu po straně, stáhnete jako jeden soubor"
        >
          <FileText className="h-3 w-3" />
          Dokument
        </span>
        {saved && <SavedBadge className="absolute top-1.5 right-1.5" />}
      </div>

      <div className="p-3 flex-1 flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-text-primary line-clamp-2 group-hover:text-accent transition-colors">
          {document.name}
        </p>
        {document.categoryName && <p className="text-xs text-text-muted">{document.categoryName}</p>}
        <p className="text-xs text-text-muted mt-1">
          {document.pages.length} {pagesWord(document.pages.length)} · {document.dimension}
        </p>
      </div>
    </button>
  );
}

// Renders the thumbnail with an inline DOM fallback on image load error.
function ThumbnailImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = 'none';
        const parent = target.parentElement;
        if (parent) {
          const placeholder = document.createElement('div');
          placeholder.className = 'flex items-center justify-center w-full h-full';
          placeholder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted)"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
          parent.appendChild(placeholder);
        }
      }}
    />
  );
}

function PlaceholderTile() {
  return (
    <div className="flex items-center justify-center w-full h-full text-text-muted">
      <ImageIcon className="w-8 h-8" strokeWidth={1.2} />
    </div>
  );
}
