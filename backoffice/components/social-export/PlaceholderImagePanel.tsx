'use client';

import { Crosshair, ImageIcon, X } from 'lucide-react';
import {
  IMAGE_ROTATION_MAX,
  IMAGE_ROTATION_MIN,
  IMAGE_SCALE_MAX,
  IMAGE_SCALE_MIN,
  hasAdjustments,
  type ImageSlotState,
} from '@/lib/social-export/field-rules-image';
import { NEUTRAL_PLACEMENT } from '@/lib/social-export/image-placement';
import type { ImageInputDTO } from '@/lib/social-export/api-types';

interface PlaceholderImagePanelProps {
  input: ImageInputDTO;
  state: ImageSlotState;
  label: string;
  onChange: (partial: Partial<ImageSlotState>) => void;
  /** Open the gallery picker for this slot. */
  onReplace: () => void;
  onClose: () => void;
}

/**
 * Floating panel body for one IMAGE placeholder: the precise counterpart to
 * dragging the picture on the preview. Only the adjustments the designer allowed
 * are offered — a control the export would reject with a 400 must never be on
 * screen.
 *
 * Panning has no slider on purpose: it is two-dimensional and the preview drag
 * (plus arrow keys on the focused picture) is the better instrument. "Vycentrovat"
 * is the way back to a neutral placement.
 */
export default function PlaceholderImagePanel({
  input,
  state,
  label,
  onChange,
  onReplace,
  onClose,
}: PlaceholderImagePanelProps) {
  const adjustable = hasAdjustments(input);
  const panned = state.offsetXRatio !== 0 || state.offsetYRatio !== 0;
  const placed = panned || state.scale !== 1 || state.rotation !== 0;

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zavřít"
          className="rounded p-0.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onReplace}
        className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
      >
        <ImageIcon className="h-4 w-4" />
        Vyměnit obrázek
      </button>

      {adjustable ? (
        <>
          {input.allowResize && (
            <label className="mb-3 block">
              <span className="mb-1 flex items-center justify-between text-xs font-medium text-text-secondary">
                Zvětšení
                <span className="tabular-nums text-text-muted">
                  {Math.round(state.scale * 100)} %
                </span>
              </span>
              <input
                type="range"
                min={IMAGE_SCALE_MIN}
                max={IMAGE_SCALE_MAX}
                step={0.01}
                value={state.scale}
                onChange={(event) => onChange({ scale: Number(event.target.value) })}
                className="w-full accent-accent"
              />
            </label>
          )}

          {input.allowRotate && (
            <label className="mb-3 block">
              <span className="mb-1 flex items-center justify-between text-xs font-medium text-text-secondary">
                Otočení
                <span className="tabular-nums text-text-muted">
                  {Math.round(state.rotation)}°
                </span>
              </span>
              <input
                type="range"
                min={IMAGE_ROTATION_MIN}
                max={IMAGE_ROTATION_MAX}
                step={1}
                value={state.rotation}
                onChange={(event) => onChange({ rotation: Number(event.target.value) })}
                className="w-full accent-accent"
              />
            </label>
          )}

          {input.allowMove && (
            <p className="mb-2 text-[11px] leading-snug text-text-muted">
              Obrázek posunete tažením přímo v náhledu (nebo šipkami, když je vybraný).
            </p>
          )}

          <button
            type="button"
            onClick={() => onChange({ ...NEUTRAL_PLACEMENT })}
            disabled={!placed}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-hover disabled:cursor-not-allowed disabled:text-text-muted"
          >
            <Crosshair className="h-3.5 w-3.5" />
            Vycentrovat
          </button>
        </>
      ) : (
        <p className="text-[11px] leading-snug text-text-muted">
          Šablona u tohoto obrázku nepovoluje posun, zvětšení ani otočení.
        </p>
      )}
    </div>
  );
}
