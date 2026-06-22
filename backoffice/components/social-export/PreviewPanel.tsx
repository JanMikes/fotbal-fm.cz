'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Frame, Loader2, Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import PlaceholderOverlay, { type ActivePlaceholder } from './PlaceholderOverlay';
import FloatingPanel from './FloatingPanel';
import PlaceholderTextPanel from './PlaceholderTextPanel';
import ImagePickerModal from './images/ImagePickerModal';
import { canvasToDisplay } from '@/lib/social-export/geometry';
import { resolveImageLabel, type ImageSlotState } from '@/lib/social-export/field-rules-image';
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
  // Action (rendered under the preview)
  onDownload: () => void;
  actionsDisabled: boolean;
  renderError?: string | null;
}

const NEUTRAL = { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };

/**
 * Full-width preview panel: the rendered PNG IS the editor. Every placeholder
 * shows an always-visible tool cluster floating over the preview:
 *  - TEXT: a pencil opens a small floating panel (replace value + insert match
 *    data) and, when hidable, an eye to show/hide.
 *  - IMAGE: a pencil opens the gallery picker modal directly (pick / upload) and,
 *    when hidable, an eye to show/hide — no intermediate popover.
 * The "Zvýraznit oblasti" toggle only controls the dashed boundary boxes — the
 * icons are always shown. Coordinate mapping is a single scale factor because the
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
  onDownload,
  actionsDisabled,
  renderError,
}: PreviewPanelProps) {
  // The rendered image's display rect (== the aspect-ratio box rect, no letterbox).
  const imgRef = useRef<HTMLImageElement>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  // Which image slot's gallery picker is open (image pencil opens it directly).
  const [pickerImageId, setPickerImageId] = useState<string | null>(null);

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

  // Pencil click: text opens the floating panel; image opens the gallery modal
  // directly (no intermediate popover).
  const handleSelect = useCallback(
    (p: ActivePlaceholder) => {
      if (p.kind === 'image') {
        onCloseActive();
        setPickerImageId(p.id);
      } else {
        onSelect(p);
      }
    },
    [onSelect, onCloseActive]
  );

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

  // The open text panel (image edits go through the modal, never this panel).
  const activeTextInput =
    active?.kind === 'text' ? variant.inputs.find((i) => i.id === active.id) ?? null : null;
  const activeTextIndex = activeTextInput
    ? variant.inputs.findIndex((i) => i.id === activeTextInput.id)
    : -1;

  // Anchor rect for the open text panel, from its frame.
  const anchorRect = useMemo(() => {
    if (!activeTextInput || !overlayReady) return null;
    return activeTextInput.frame ? canvasToDisplay(activeTextInput.frame, scale) : null;
  }, [activeTextInput, overlayReady, scale]);

  // The image slot whose picker modal is open.
  const pickerInput = pickerImageId
    ? variant.imageInputs.find((i) => i.id === pickerImageId) ?? null
    : null;
  const pickerIndex = pickerInput
    ? variant.imageInputs.findIndex((i) => i.id === pickerInput.id)
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
          ) : (
            !isRendering && (
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
            )
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
              onSelect={handleSelect}
              formState={formState}
              imageState={imageState}
              onToggleHidden={handleToggleHidden}
            />
          )}

          {/* Floating editing panel anchored to the active TEXT box. Keyed by the
              active placeholder so switching boxes remounts the body and re-runs
              its focus/select effect. */}
          {overlayReady && active && activeTextInput && anchorRect && stageSize && (
            <FloatingPanel
              key={`${active.kind}:${active.id}`}
              anchorRect={anchorRect}
              stageWidth={stageSize.width}
              stageHeight={stageSize.height}
              label={activeTextInput.name ?? 'Upravit prvek'}
              onClose={onCloseActive}
            >
              <PlaceholderTextPanel
                input={activeTextInput}
                index={activeTextIndex}
                state={formState[activeTextInput.id] ?? { value: '', hidden: false }}
                chips={chips}
                onChange={(partial) => onFormChange(activeTextInput.id, partial)}
                onClose={onCloseActive}
              />
            </FloatingPanel>
          )}

          {/* Live-render feedback: gray + blur the whole preview and show a large
              spinner, so it's obvious the preview is regenerating. Sits below the
              text popover (z-30) / active tool so editing stays usable mid-render,
              and is non-blocking. */}
          {isRendering && (
            <div
              className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/55 backdrop-blur-[1px] backdrop-grayscale"
              aria-live="polite"
            >
              <Loader2 className="h-14 w-14 animate-spin text-accent" />
              <span className="text-sm font-medium text-text-secondary">Generuji náhled…</span>
            </div>
          )}
        </div>
      </div>

      {renderError && <Alert variant="error">{renderError}</Alert>}

      {/* Action: the preview is live, so only the download remains. */}
      <div className="flex flex-wrap gap-3 pt-1">
        <Button variant="accent" size="md" onClick={onDownload} disabled={actionsDisabled}>
          <Download className="mr-2 h-4 w-4" />
          Stáhnout PNG
        </Button>
      </div>

      {/* Image gallery picker — opened directly by an image placeholder's pencil. */}
      {pickerInput && (
        <ImagePickerModal
          open
          onClose={() => setPickerImageId(null)}
          variantId={variant.id}
          imageInputId={pickerInput.id}
          slotLabel={resolveImageLabel(pickerInput, pickerIndex)}
          directories={pickerInput.directories}
          includesRoot={pickerInput.includesRoot}
          matchId={matchId}
          matchImages={matchImages}
          onPick={(image) => {
            onImageChange(pickerInput.id, { image: { id: image.id, url: image.url }, ...NEUTRAL });
            setPickerImageId(null);
          }}
        />
      )}
    </div>
  );
}
