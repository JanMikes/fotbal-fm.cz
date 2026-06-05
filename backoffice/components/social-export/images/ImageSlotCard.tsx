'use client';

import { useState } from 'react';
import { ImagePlus, RefreshCw, Trash2, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import FrameEditor from './FrameEditor';
import ImagePickerModal from './ImagePickerModal';
import type { GalleryImageDTO, ImageInputDTO } from '@/lib/social-export/api-types';
import {
  hasAdjustments,
  resolveImageLabel,
  IMAGE_ROTATION_MAX,
  IMAGE_ROTATION_MIN,
  IMAGE_SCALE_MAX,
  IMAGE_SCALE_MIN,
  type ImageSlotState,
} from '@/lib/social-export/field-rules-image';
import type { StrapiImage } from '@/types/match';

interface ImageSlotCardProps {
  variantId: string;
  matchId: string | null;
  matchImages: StrapiImage[];
  input: ImageInputDTO;
  index: number;
  state: ImageSlotState;
  onChange: (partial: Partial<ImageSlotState>) => void;
}

const NEUTRAL = { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };

export default function ImageSlotCard({
  variantId,
  matchId,
  matchImages,
  input,
  index,
  state,
  onChange,
}: ImageSlotCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const label = resolveImageLabel(input, index);
  const isHidden = input.hidable && state.hidden;
  const hasImage = !!state.image;
  const showControls = hasImage && hasAdjustments(input);

  function handlePick(image: GalleryImageDTO) {
    // New picture starts centered + contained.
    onChange({ image: { id: image.id, url: image.url }, ...NEUTRAL });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">{label}</h4>
          {input.description && (
            <p className="mt-0.5 text-xs text-text-muted">{input.description}</p>
          )}
        </div>
        {input.hidable && (
          <label className="inline-flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={state.hidden}
              onChange={(e) => onChange({ hidden: e.target.checked })}
              className="rounded border-border"
            />
            Skrýt slot
          </label>
        )}
      </div>

      {isHidden ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-hover px-4 py-6 text-center text-sm text-text-muted">
          Tento slot bude ve výsledku skrytý.
        </div>
      ) : (
        <>
          <FrameEditor
            frame={input.frame}
            imageUrl={state.image?.url ?? null}
            standInUrl={input.defaultImageUrl}
            scale={state.scale}
            offsetX={state.offsetX}
            offsetY={state.offsetY}
            rotation={state.rotation}
            allowMove={input.allowMove}
            allowResize={input.allowResize}
            onChange={onChange}
          />

          {/* Pick / change / remove */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
              {hasImage ? (
                <>
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Změnit obrázek
                </>
              ) : (
                <>
                  <ImagePlus className="mr-1.5 h-4 w-4" />
                  Vybrat obrázek
                </>
              )}
            </Button>
            {hasImage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ image: null, ...NEUTRAL })}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Odebrat
              </Button>
            )}
          </div>

          {/* Positioning controls */}
          {showControls && (
            <div className="mt-3 space-y-3 border-t border-border-light pt-3">
              {input.allowResize && (
                <SliderRow
                  label="Přiblížení"
                  min={IMAGE_SCALE_MIN}
                  max={IMAGE_SCALE_MAX}
                  step={0.01}
                  value={state.scale}
                  display={`${state.scale.toFixed(2)}×`}
                  onChange={(v) => onChange({ scale: v })}
                />
              )}
              {input.allowRotate && (
                <SliderRow
                  label="Otočení"
                  min={IMAGE_ROTATION_MIN}
                  max={IMAGE_ROTATION_MAX}
                  step={1}
                  value={state.rotation}
                  display={`${Math.round(state.rotation)}°`}
                  onChange={(v) => onChange({ rotation: v })}
                />
              )}
              <div className="flex items-center justify-between">
                {input.allowMove ? (
                  <span className="text-xs text-text-muted">Obrázek posunete tažením v rámečku.</span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => onChange({ ...NEUTRAL })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset polohy
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ImagePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        variantId={variantId}
        imageInputId={input.id}
        slotLabel={label}
        matchId={matchId}
        matchImages={matchImages}
        onPick={handlePick}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slider row
// ---------------------------------------------------------------------------

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-text-secondary">{label}</span>
        <span className="tabular-nums text-text-muted">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-hover accent-accent"
      />
    </label>
  );
}
