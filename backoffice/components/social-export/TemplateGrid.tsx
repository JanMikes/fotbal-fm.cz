'use client';

import { ImageIcon } from 'lucide-react';
import { TemplateDTO } from '@/lib/social-export/api-types';

interface TemplateGridProps {
  templates: TemplateDTO[];
  onSelect: (template: TemplateDTO) => void;
}

// Group templates by categoryName, with null grouped as "Ostatní"
function groupTemplates(templates: TemplateDTO[]): Array<{ category: string; items: TemplateDTO[] }> {
  const groupMap = new Map<string, TemplateDTO[]>();

  // Sort within each group by position then name
  const sorted = [...templates].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.name.localeCompare(b.name, 'cs');
  });

  for (const t of sorted) {
    const key = t.categoryName ?? 'Ostatní';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(t);
  }

  // Build ordered groups: named categories first (sorted), then "Ostatní" last
  const groups: Array<{ category: string; items: TemplateDTO[] }> = [];
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
export default function TemplateGrid({ templates, onSelect }: TemplateGridProps) {
  const groups = groupTemplates(templates);

  return (
    <div className="space-y-8">
      {groups.map(({ category, items }) => (
        <section key={category}>
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            {category}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((template) => {
              const hasVariants = template.variants.length > 0;
              const thumbUrl = template.variants[0]?.thumbnailUrl ?? null;
              const dimensionList = template.variants.map((v) => v.dimension).join(', ');

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
