/**
 * Saved export state: the persisted editing state of the export editor for one
 * (match, variant) pair, shared by all backoffice users. Written after every
 * edit so an accidental refresh never loses work; read back to re-seed the
 * editor instead of the plain match prefill.
 *
 * Client-safe (types + pure merge helpers only).
 */

import type { TemplateVariantDTO } from './api-types';
import type { InputFieldState } from './field-rules';
import {
  type ImageSlotState,
  defaultImageSlotState,
  clamp,
  IMAGE_SCALE_MIN,
  IMAGE_SCALE_MAX,
  IMAGE_ROTATION_MIN,
  IMAGE_ROTATION_MAX,
} from './field-rules-image';

/** The JSON blob persisted per (match, variant). */
export interface SavedExportState {
  formState: Record<string, InputFieldState>;
  imageState: Record<string, ImageSlotState>;
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
      formState[input.id] = { value: field.value, hidden: field.hidden };
    }
  }

  const imageState = { ...baseImages };
  for (const slot of variant.imageInputs) {
    const slotState = saved.imageState?.[slot.id];
    if (slotState) {
      imageState[slot.id] = sanitizeSlotState(slotState);
    }
  }

  return { formState, imageState, restored: true };
}

function sanitizeSlotState(raw: ImageSlotState): ImageSlotState {
  const base = defaultImageSlotState();

  const image =
    raw.image && typeof raw.image.id === 'string' && typeof raw.image.url === 'string'
      ? { id: raw.image.id, url: raw.image.url }
      : null;

  return {
    image,
    scale: Number.isFinite(raw.scale)
      ? clamp(raw.scale, IMAGE_SCALE_MIN, IMAGE_SCALE_MAX)
      : base.scale,
    offsetX: Number.isFinite(raw.offsetX) ? raw.offsetX : base.offsetX,
    offsetY: Number.isFinite(raw.offsetY) ? raw.offsetY : base.offsetY,
    rotation: Number.isFinite(raw.rotation)
      ? clamp(raw.rotation, IMAGE_ROTATION_MIN, IMAGE_ROTATION_MAX)
      : base.rotation,
    hidden: raw.hidden === true,
  };
}
