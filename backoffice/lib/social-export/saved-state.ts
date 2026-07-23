/**
 * Saved export state: the persisted editing state of the export editor for one
 * (match, variant) pair, shared by all backoffice users. Written after every
 * edit so an accidental refresh never loses work; read back to re-seed the
 * editor instead of the plain match prefill.
 *
 * Client-safe (types + pure merge helpers only).
 */

import type { ImageFrameDTO, TemplateVariantDTO } from './api-types';
import type { InputFieldState } from './field-rules';
import { normalizeRuns, plainText, isStyled } from './rich-text';
import {
  type ImageSlotState,
  defaultImageSlotState,
  clamp,
  IMAGE_SCALE_MIN,
  IMAGE_SCALE_MAX,
  IMAGE_ROTATION_MIN,
  IMAGE_ROTATION_MAX,
} from './field-rules-image';
import { ratioFromOffset } from './image-placement';

/**
 * An image slot AS PERSISTED. The pan is stored as a fraction of the frame, but
 * records written before that carry it in canvas px (`offsetX`/`offsetY`), and a
 * record can always be older than the code reading it — so both forms are
 * tolerated here and normalised by {@link applySavedState}.
 */
export type StoredImageSlotState = Omit<ImageSlotState, 'offsetXRatio' | 'offsetYRatio'> & {
  offsetXRatio?: number;
  offsetYRatio?: number;
  offsetX?: number;
  offsetY?: number;
};

/** The JSON blob persisted per (match, variant). */
export interface SavedExportState {
  formState: Record<string, InputFieldState>;
  imageState: Record<string, StoredImageSlotState>;
}

/** One saved record as served by GET /api/social-export/state?matchId=. */
export interface SavedExportStateDTO {
  variantId: string;
  templateId: string;
  state: SavedExportState;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Restore helpers
// ---------------------------------------------------------------------------

/**
 * Overlay a saved state onto the freshly-seeded editor state. Only ids that
 * still exist on the variant are taken (the template may have changed in
 * WBoost since the save), and every value is shape-checked and clamped so a
 * stale or hand-edited record can never break the editor.
 */
export function applySavedState(
  variant: TemplateVariantDTO,
  baseForm: Record<string, InputFieldState>,
  baseImages: Record<string, ImageSlotState>,
  saved: SavedExportState | null | undefined
): {
  formState: Record<string, InputFieldState>;
  imageState: Record<string, ImageSlotState>;
  restored: boolean;
} {
  if (!saved) {
    return { formState: baseForm, imageState: baseImages, restored: false };
  }

  const formState = { ...baseForm };
  for (const input of variant.inputs) {
    const field = saved.formState?.[input.id];
    if (field && typeof field.value === 'string' && typeof field.hidden === 'boolean') {
      // Restore rich runs only when they are shape-valid, the input still
      // allows rich text (the admin may have unchecked it since the save) and
      // the plain projection matches `value` — otherwise drop the runs and
      // keep the plain text (self-healing against stale/hand-edited records;
      // an old client reading this record simply ignores `runs`).
      const runs =
        input.richText && field.runs != null ? normalizeRuns(field.runs) : null;
      const runsValid = runs !== null && isStyled(runs) && plainText(runs) === field.value;

      formState[input.id] = {
        value: field.value,
        hidden: field.hidden,
        ...(runsValid ? { runs } : {}),
      };
    }
  }

  const imageState = { ...baseImages };
  for (const slot of variant.imageInputs) {
    const slotState = saved.imageState?.[slot.id];
    if (slotState) {
      imageState[slot.id] = sanitizeSlotState(slotState, slot.frame);
    }
  }

  return { formState, imageState, restored: true };
}

/**
 * Records written before the pan became frame-relative carry `offsetX`/`offsetY`
 * in canvas px. They are converted here against the slot's frame — the same
 * conversion the drag does — so an old save reopens on the crop it was made on
 * instead of silently snapping back to centre.
 */
function sanitizeSlotState(
  raw: StoredImageSlotState,
  frame: ImageFrameDTO | null
): ImageSlotState {
  const base = defaultImageSlotState();

  const image =
    raw.image && typeof raw.image.id === 'string' && typeof raw.image.url === 'string'
      ? { id: raw.image.id, url: raw.image.url }
      : null;

  const pan = (
    ratio: unknown,
    pixels: unknown,
    frameSize: number | undefined,
    fallback: number
  ): number => {
    if (typeof ratio === 'number' && Number.isFinite(ratio)) return ratio;
    if (typeof pixels === 'number' && Number.isFinite(pixels) && frameSize) {
      return ratioFromOffset(pixels, frameSize);
    }
    return fallback;
  };

  return {
    image,
    scale: Number.isFinite(raw.scale)
      ? clamp(raw.scale, IMAGE_SCALE_MIN, IMAGE_SCALE_MAX)
      : base.scale,
    offsetXRatio: pan(raw.offsetXRatio, raw.offsetX, frame?.width, base.offsetXRatio),
    offsetYRatio: pan(raw.offsetYRatio, raw.offsetY, frame?.height, base.offsetYRatio),
    rotation: Number.isFinite(raw.rotation)
      ? clamp(raw.rotation, IMAGE_ROTATION_MIN, IMAGE_ROTATION_MAX)
      : base.rotation,
    hidden: raw.hidden === true,
  };
}
