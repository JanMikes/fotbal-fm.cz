'use client';

import { ArrowLeft, ImageIcon } from 'lucide-react';
import Button from '@/components/ui/Button';
import { TemplateDTO, TemplateVariantDTO } from '@/lib/social-export/api-types';

interface VariantChooserProps {
  template: TemplateDTO;
  onSelect: (variant: TemplateVariantDTO) => void;
  onBack: () => void;
}

/**
 * Variant selection screen — shows all variants for a chosen template
 * as preview cards with aspect-ratio boxes.
 */
export default function VariantChooser({ template, onSelect, onBack }: VariantChooserProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Zpět
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{template.name}</h2>
          {template.categoryName && (
            <p className="text-sm text-text-muted">{template.categoryName}</p>
          )}
        </div>
      </div>

      {/* Variant cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {template.variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            onClick={() => onSelect(variant)}
            className="group flex flex-col rounded-xl border border-border bg-surface hover:border-accent hover:shadow-md transition-all duration-200 overflow-hidden text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring-focus active:scale-[0.98]"
          >
            {/* Aspect-ratio preview box */}
            <div
              className="w-full bg-surface-hover flex items-center justify-center overflow-hidden"
              style={{ aspectRatio: `${variant.width}/${variant.height}` }}
            >
              {variant.thumbnailUrl ? (
                <VariantThumbnail src={variant.thumbnailUrl} alt={variant.dimension} />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-text-muted">
                  <ImageIcon className="w-8 h-8" strokeWidth={1.2} />
                </div>
              )}
            </div>

            {/* Labels */}
            <div className="p-3">
              <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                {variant.dimension}
              </p>
              <p className="text-xs text-text-muted">
                {variant.width}&times;{variant.height}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thumbnail with graceful onError fallback
// ---------------------------------------------------------------------------

function VariantThumbnail({ src, alt }: { src: string; alt: string }) {
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
