'use client';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { TemplateVariantDTO } from '@/lib/social-export/api-types';

interface PreviewPanelProps {
  variant: TemplateVariantDTO;
  previewUrl: string | null;
  isRendering: boolean;
}

/**
 * Right-column preview panel showing the rendered image or a placeholder.
 * Maintains the variant's native aspect ratio.
 */
export default function PreviewPanel({ variant, previewUrl, isRendering }: PreviewPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-text-secondary">
        Náhled — {variant.dimension} ({variant.width}&times;{variant.height})
      </h3>

      {/* Aspect-ratio box */}
      <div
        className="relative w-full rounded-xl border border-border bg-surface overflow-hidden flex items-center justify-center"
        style={{ aspectRatio: `${variant.width}/${variant.height}` }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`Náhled ${variant.dimension}`}
            className="w-full h-full object-contain"
          />
        ) : (
          !isRendering && (
            <div className="flex flex-col items-center gap-2 text-text-muted p-6 text-center">
              {/* Simple image icon inline to avoid extra import */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <p className="text-sm">Klikněte na Náhled pro zobrazení</p>
            </div>
          )
        )}

        {/* Rendering overlay */}
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <LoadingSpinner size="md" message="Generování..." fullscreen={false} />
          </div>
        )}
      </div>
    </div>
  );
}
