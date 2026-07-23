/**
 * Pure helpers for the image-placeholder slots: form state shape, labels, and
 * building the render `images` payload while honoring each slot's allow* flags.
 * Client-safe (no imports beyond shared types).
 *
 * API rules reflected here (mirror the WBoost delta):
 *  - bind by `id` (UUID), never by `name`
 *  - omit a slot entirely → its `defaultImageUrl` stand-in renders
 *  - `hide` honored only when `hidable: true`
 *  - `scale` (≠1) needs allowResize; the pan (≠0) needs allowMove; `rotation`
 *    (≠0) needs allowRotate — sending a disallowed non-default → 400, so we never
 *    emit one
 *  - the pan goes as `offsetXRatio`/`offsetYRatio` (a fraction of the slot's
 *    frame), the portable form: the same value means the same crop in every
 *    variant of the template, whose frames differ
 *  - a picture with no placement is sent as the SHORTHAND string (image id)
 */

import type { ImageInputDTO, RenderImageValue } from './api-types';

/** Zoom (×contain) and rotation bounds shared by the editor and the sliders. */
export const IMAGE_SCALE_MIN = 1;
export const IMAGE_SCALE_MAX = 4;
export const IMAGE_ROTATION_MIN = -180;
export const IMAGE_ROTATION_MAX = 180;

/** Clamp a value into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Per-slot editable form state. */
export interface ImageSlotState {
  /** Chosen gallery image (id + url for preview), or null to keep the stand-in. */
  image: { id: string; url: string } | null;
  /** Multiplier on the object-contain fit (1.0 = exactly contain). */
  scale: number;
  /**
   * Pan from the frame centre as a FRACTION of the frame's width / height
   * (0.25 = a quarter of the frame to the right / down), never canvas px: the
   * same placeholder has a different frame in every variant, so the fraction is
   * what keeps one crop intent when the user switches dimension — and it is the
   * form WBoost's export API takes (`offsetXRatio` / `offsetYRatio`).
   */
  offsetXRatio: number;
  offsetYRatio: number;
  /** Rotation in degrees. */
  rotation: number;
  /** Whether the user toggled "hide this slot" (only meaningful if hidable). */
  hidden: boolean;
}

/** The neutral state for a freshly-seen slot: stand-in, centered, contained. */
export function defaultImageSlotState(): ImageSlotState {
  return { image: null, scale: 1, offsetXRatio: 0, offsetYRatio: 0, rotation: 0, hidden: false };
}

/** Resolve the slot label: name, else description, else a generic "Obrázek N". */
export function resolveImageLabel(input: ImageInputDTO, index: number): string {
  const name = input.name?.trim();
  if (name) return name;
  const description = input.description?.trim();
  if (description) return description;
  return `Obrázek ${index + 1}`;
}

/** Whether the slot offers any positioning control (move / zoom / rotate). */
export function hasAdjustments(input: ImageInputDTO): boolean {
  return input.allowMove || input.allowResize || input.allowRotate;
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Build the `images` payload from the form state, applying the API rules above.
 * Slots with no chosen image (and not hidden) are omitted so their stand-in
 * renders. Disallowed placement params are never emitted.
 */
export function buildRenderImages(
  imageInputs: ImageInputDTO[],
  state: Record<string, ImageSlotState>
): Record<string, RenderImageValue> {
  const payload: Record<string, RenderImageValue> = {};

  for (const slot of imageInputs) {
    const s = state[slot.id];
    if (!s) continue;

    if (slot.hidable && s.hidden) {
      payload[slot.id] = { hide: true };
      continue;
    }

    if (!s.image) continue; // no picture → omit → stand-in renders

    const obj: {
      imageId: string;
      scale?: number;
      offsetXRatio?: number;
      offsetYRatio?: number;
      rotation?: number;
    } = { imageId: s.image.id };

    if (slot.allowResize) {
      const scale = round(s.scale, 3);
      if (scale !== 1) obj.scale = scale;
    }
    if (slot.allowMove) {
      // Sent as fractions of the frame — WBoost resolves them against this
      // variant's own frame, so the value stays right in every dimension.
      const offsetXRatio = round(s.offsetXRatio, 4);
      const offsetYRatio = round(s.offsetYRatio, 4);
      if (offsetXRatio !== 0) obj.offsetXRatio = offsetXRatio;
      if (offsetYRatio !== 0) obj.offsetYRatio = offsetYRatio;
    }
    if (slot.allowRotate) {
      const rotation = round(s.rotation);
      if (rotation !== 0) obj.rotation = rotation;
    }

    // No placement → shorthand string; otherwise the object form.
    payload[slot.id] = Object.keys(obj).length === 1 ? s.image.id : obj;
  }

  return payload;
}
