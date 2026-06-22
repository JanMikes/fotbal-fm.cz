'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
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
}

/**
 * Right-column preview panel: the rendered PNG plus an optional highlight overlay
 * that lets the user click placeholders open and edit them in a floating panel
 * anchored to the box. Coordinate mapping is a single scale factor because the
 * <img> is object-contain inside an aspect-ratio-matched box (no letterboxing):
 *   scale = renderedImgWidth / variant.width.
 */
export default function PreviewPanel({
  variant,
  previewUrl,
  isRendering,
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
  const boxesVisible = highlightMode && !!previewUrl && stageSize != null && scale > 0;

  // Resolve the anchor rect for the open panel from the active placeholder's frame.
  const anchorRect = useMemo(() => {
    if (!active || !boxesVisible) return null;
    if (active.kind === 'text') {
      const input = variant.inputs.find((i) => i.id === active.id);
      return input?.frame ? canvasToDisplay(input.frame, scale) : null;
    }
    const slot = variant.imageInputs.find((i) => i.id === active.id);
    return slot?.frame ? canvasToDisplay(slot.frame, scale) : null;
  }, [active, boxesVisible, variant, scale]);

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
      <div className="flex items-center justify-between gap-3">
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
          title="Upravovat přímo v náhledu"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Upravit v náhledu
        </button>
      </div>

      {/* Border/rounding live on an OUTER wrapper so the inner aspect-ratio box
          is border-free: with box-sizing:border-box a border would shrink the
          content box off the exact W/H ratio and `object-contain` would letterbox
          the image ~1px, drifting the overlay boxes. Border-free → content box is
          exactly W/H → zero letterbox → img rect == overlay rect. */}
      <div className="w-full rounded-xl border border-border bg-surface overflow-hidden">
      <div
        className="relative w-full flex items-center justify-center"
        style={{ aspectRatio: `${variant.width}/${variant.height}` }}
      >
        {previewUrl ? (
          <img
            ref={imgRef}
            src={previewUrl}
            alt={`Náhled ${variant.dimension}`}
            className="w-full h-full object-contain"
            onLoad={measure}
          />
        ) : (
          !isRendering && (
            <div className="flex flex-col items-center gap-2 text-text-muted p-6 text-center">
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

        {/* Highlight boxes */}
        {boxesVisible && (
          <PlaceholderOverlay
            variant={variant}
            scale={scale}
            active={active}
            onSelect={onSelect}
          />
        )}

        {/* Floating editing panel anchored to the active box */}
        {boxesVisible && active && anchorRect && stageSize && (
          <FloatingPanel
            anchorRect={anchorRect}
            stageWidth={stageSize.width}
            stageHeight={stageSize.height}
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

        {/* Rendering overlay */}
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <LoadingSpinner size="md" message="Generování..." fullscreen={false} />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
