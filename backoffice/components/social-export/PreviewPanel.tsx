'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Frame, Loader2, Eye, Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PlaceholderOverlay, { type ActivePlaceholder } from './PlaceholderOverlay';
import FloatingPanel from './FloatingPanel';
import PlaceholderTextPanel from './PlaceholderTextPanel';
import PlaceholderImagePanel from './PlaceholderImagePanel';
import { canvasToDisplay } from '@/lib/social-export/geometry';
import { defaultImageSlotState, type ImageSlotState } from '@/lib/social-export/field-rules-image';
import type { TemplateVariantDTO } from '@/lib/social-export/api-types';
import type { InputFieldState } from '@/lib/social-export/field-rules';
import type { MatchChip } from '@/lib/social-export/prefill';
import type { StrapiImage } from '@/types/match';

interface PreviewPanelProps {
  variant: TemplateVariantDTO;
  previewUrl: string | null;
  isRendering: boolean;
  /** A render is queued (debounce window) but the fetch hasn't started yet. */
  previewPending: boolean;
  // Highlight / click-into-preview editing
  highlightMode: boolean;
  onToggleHighlight: () => void;
  active: ActivePlaceholder | null;
  onSelect: (placeholder: ActivePlaceholder) => void;
  onCloseActive: () => void;
  // Text editing
  formState: Record<string, InputFieldState>;
  onFormChange: (inputId: string, partial: Partial<InputFieldState>) => void;
  chips: MatchChip[];
  // Image editing
  imageState: Record<string, ImageSlotState>;
  onImageChange: (slotId: string, partial: Partial<ImageSlotState>) => void;
  matchId: string | null;
  matchImages: StrapiImage[];
  // Actions (rendered under the preview)
  onPreview: () => void;
  onDownload: () => void;
  actionsDisabled: boolean;
  renderError?: string | null;
}

/**
 * Full-width preview panel: the rendered PNG IS the editor. Every placeholder
 * shows an always-visible tool cluster (pencil + eye) floating over the preview;
 * clicking the pencil opens a floating editing panel anchored to the box. The
 * "Zvýraznit oblasti" toggle only controls the dashed boundary boxes — the icons
 * are always shown. Coordinate mapping is a single scale factor because the
 * <img> is object-contain inside an aspect-ratio-matched box (no letterboxing):
 *   scale = renderedImgWidth / variant.width.
 */
export default function PreviewPanel({
  variant,
  previewUrl,
  isRendering,
  previewPending,
  highlightMode,
  onToggleHighlight,
  active,
  onSelect,
  onCloseActive,
  formState,
  onFormChange,
  chips,
  imageState,
  onImageChange,
  matchId,
  matchImages,
  onPreview,
  onDownload,
  actionsDisabled,
  renderError,
}: PreviewPanelProps) {
  // The rendered image's display rect (== the aspect-ratio box rect, no letterbox).
  const imgRef = useRef<HTMLImageElement>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);

  const measure = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setStageSize({ width: rect.width, height: rect.height });
    }
  }, []);

  // Track the rendered image rect via ResizeObserver (covers layout/resize) and
  // an explicit onLoad (covers the first paint of a new src).
  useEffect(() => {
    const el = imgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, previewUrl]);

  const scale = stageSize ? stageSize.width / variant.width : 0;
  // The overlay (tool icons) is shown whenever we have a measured preview —
  // independent of the highlight toggle, which now only gates the dashed boxes.
  const overlayReady = !!previewUrl && stageSize != null && scale > 0;

  // Toggle the hidden flag of a placeholder from its on-box eye icon.
  const handleToggleHidden = useCallback(
    (p: ActivePlaceholder) => {
      if (p.kind === 'text') {
        onFormChange(p.id, { hidden: !(formState[p.id]?.hidden ?? false) });
      } else {
        onImageChange(p.id, { hidden: !(imageState[p.id]?.hidden ?? false) });
      }
    },
    [formState, imageState, onFormChange, onImageChange]
  );

  // Resolve the anchor rect for the open panel from the active placeholder's frame.
  const anchorRect = useMemo(() => {
    if (!active || !overlayReady) return null;
    if (active.kind === 'text') {
      const input = variant.inputs.find((i) => i.id === active.id);
      return input?.frame ? canvasToDisplay(input.frame, scale) : null;
    }
    const slot = variant.imageInputs.find((i) => i.id === active.id);
    return slot?.frame ? canvasToDisplay(slot.frame, scale) : null;
  }, [active, overlayReady, variant, scale]);

  // The resolved data for the open panel.
  const activeTextInput =
    active?.kind === 'text' ? variant.inputs.find((i) => i.id === active.id) ?? null : null;
  const activeTextIndex = activeTextInput
    ? variant.inputs.findIndex((i) => i.id === activeTextInput.id)
    : -1;
  const activeImageInput =
    active?.kind === 'image' ? variant.imageInputs.find((i) => i.id === active.id) ?? null : null;
  const activeImageIndex = activeImageInput
    ? variant.imageInputs.findIndex((i) => i.id === activeImageInput.id)
    : -1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-secondary">
          Náhled — {variant.dimension} ({variant.width}&times;{variant.height})
        </h3>
        <button
          type="button"
          onClick={onToggleHighlight}
          aria-pressed={highlightMode}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            highlightMode
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
          title="Zobrazit/skrýt rámečky upravitelných oblastí"
        >
          <Frame className="h-3.5 w-3.5" />
          Zvýraznit oblasti
        </button>
      </div>

      <p className="text-xs text-text-muted">
        Klikněte na <span className="font-medium text-text-secondary">tužku</span> u prvku a upravte
        ho přímo v náhledu. Náhled se aktualizuje automaticky.
      </p>

      {/* Border/rounding live on an OUTER wrapper so the inner aspect-ratio box
          is border-free: with box-sizing:border-box a border would shrink the
          content box off the exact W/H ratio and `object-contain` would letterbox
          the image ~1px, drifting the overlay boxes. Border-free → content box is
          exactly W/H → zero letterbox → img rect == overlay rect.
          maxWidth caps the height (~78vh) while keeping the aspect ratio so a tall
          portrait template stays comfortable on screen. */}
      <div
        className="mx-auto w-full overflow-hidden rounded-xl border border-border bg-surface"
        style={{ maxWidth: `min(100%, calc(78vh * ${variant.width} / ${variant.height}))` }}
      >
        <div
          className="relative flex w-full items-center justify-center"
          style={{ aspectRatio: `${variant.width}/${variant.height}` }}
        >
          {previewUrl ? (
            <img
              ref={imgRef}
              src={previewUrl}
              alt={`Náhled ${variant.dimension}`}
              className="h-full w-full object-contain"
              onLoad={measure}
            />
          ) : isRendering ? (
            <LoadingSpinner fullscreen={false} size="md" message="Generování náhledu…" />
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-text-muted">
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
              <p className="text-sm">Náhled se připravuje…</p>
            </div>
          )}

          {/* Highlight boxes + tool icons */}
          {overlayReady && stageSize && (
            <PlaceholderOverlay
              variant={variant}
              scale={scale}
              stageWidth={stageSize.width}
              stageHeight={stageSize.height}
              showBorders={highlightMode}
              active={active}
              onSelect={onSelect}
              formState={formState}
              imageState={imageState}
              onToggleHidden={handleToggleHidden}
            />
          )}

          {/* Floating editing panel anchored to the active box. Keyed by the
              active placeholder so switching boxes remounts the body and re-runs
              its focus/select effect. */}
          {overlayReady && active && anchorRect && stageSize && (
            <FloatingPanel
              key={`${active.kind}:${active.id}`}
              anchorRect={anchorRect}
              stageWidth={stageSize.width}
              stageHeight={stageSize.height}
              label={activeTextInput?.name ?? activeImageInput?.name ?? 'Upravit prvek'}
              onClose={onCloseActive}
            >
              {activeTextInput ? (
                <PlaceholderTextPanel
                  input={activeTextInput}
                  index={activeTextIndex}
                  state={formState[activeTextInput.id] ?? { value: '', hidden: false }}
                  chips={chips}
                  onChange={(partial) => onFormChange(activeTextInput.id, partial)}
                  onClose={onCloseActive}
                />
              ) : activeImageInput ? (
                <PlaceholderImagePanel
                  variantId={variant.id}
                  matchId={matchId}
                  matchImages={matchImages}
                  input={activeImageInput}
                  index={activeImageIndex}
                  state={imageState[activeImageInput.id] ?? defaultImageSlotState()}
                  onChange={(partial) => onImageChange(activeImageInput.id, partial)}
                  onClose={onCloseActive}
                />
              ) : null}
            </FloatingPanel>
          )}

          {/* Single non-blocking status badge in one fixed spot — covers both the
              queued (debounce) and rendering states so the indicator never jumps
              between the header and the corner. Only shown once a preview exists;
              the very first render uses the centered spinner above. */}
          {(previewPending || isRendering) && previewUrl && (
            <div
              className="pointer-events-none absolute right-2 top-2 z-40 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-text-secondary shadow-md ring-1 ring-black/5"
              aria-live="polite"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Aktualizuji…
            </div>
          )}
        </div>
      </div>

      {renderError && <Alert variant="error">{renderError}</Alert>}

      {/* Actions: kept directly under the preview */}
      <div className="flex flex-wrap gap-3 pt-1">
        <Button variant="primary" size="md" onClick={onPreview} disabled={actionsDisabled}>
          <Eye className="mr-2 h-4 w-4" />
          Náhled
        </Button>
        <Button variant="accent" size="md" onClick={onDownload} disabled={actionsDisabled}>
          <Download className="mr-2 h-4 w-4" />
          Stáhnout PNG
        </Button>
      </div>
    </div>
  );
}
