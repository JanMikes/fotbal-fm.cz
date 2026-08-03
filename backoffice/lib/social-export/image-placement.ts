/**
 * Pure image-placement math — the mirror of WBoost's server-side
 * `ImagePlacement`, which is what actually bakes a picture into the exported
 * PNG. Both sides must agree exactly: this draws the drag stand-in over the
 * preview, and any divergence shows up as the picture visibly jumping when the
 * fresh server render lands.
 *
 * The contract:
 *   contain    = min(frame.width / naturalWidth, frame.height / naturalHeight)
 *   finalScale = contain × scale
 *   centre     = frame centre + offset
 *   rotation   = degrees, clockwise, about that centre
 *
 * The pan is stored as a FRACTION of the frame (`offsetXRatio` /
 * `offsetYRatio`), not in canvas pixels. A placeholder has a different `frame`
 * in every variant of a template, so pixels carry a crop from a 1080×1080 into
 * a 1080×1920 wrongly while the fraction keeps the intent — and WBoost's export
 * API accepts exactly this form (`offsetXRatio` / `offsetYRatio`).
 *
 * Client-safe (types + pure functions only).
 */

import type { ImageFrameDTO } from './api-types';

/** Intrinsic pixel size of the chosen picture, as the browser decoded it. */
export interface NaturalSize {
  width: number;
  height: number;
}

/** The placement fields this math reads (a subset of `ImageSlotState`). */
export interface Placement {
  scale: number;
  offsetXRatio: number;
  offsetYRatio: number;
  rotation: number;
}

/** Everything neutral: contained, centred, upright. */
export const NEUTRAL_PLACEMENT: Placement = {
  scale: 1,
  offsetXRatio: 0,
  offsetYRatio: 0,
  rotation: 0,
};

/** The object-contain base scale: the picture just fits inside the frame. */
export function containScale(frame: ImageFrameDTO, natural: NaturalSize): number {
  const width = natural.width > 0 ? natural.width : 1;
  const height = natural.height > 0 ? natural.height : 1;
  const contain = Math.min(frame.width / width, frame.height / height);

  return contain > 0 ? contain : 1;
}

/** The object-cover base scale: the least scale at which the picture covers the frame. */
export function coverScale(frame: ImageFrameDTO, natural: NaturalSize): number {
  const width = natural.width > 0 ? natural.width : 1;
  const height = natural.height > 0 ? natural.height : 1;
  const cover = Math.max(frame.width / width, frame.height / height);

  return cover > 0 ? cover : 1;
}

/** Resolve a pan expressed as a fraction of a frame edge into canvas px. */
export function offsetFromRatio(ratio: number, frameSize: number): number {
  return ratio * frameSize;
}

/** Express a canvas-px pan as a fraction of a frame edge (the inverse). */
export function ratioFromOffset(offset: number, frameSize: number): number {
  return frameSize > 0 ? offset / frameSize : 0;
}

/**
 * Inline CSS for the stand-in `<img>` inside a frame-sized, overflow-hidden box
 * at display scale `scale` (= rendered preview width / variant width).
 */
export function ghostStyle(
  frame: ImageFrameDTO,
  natural: NaturalSize,
  placement: Placement,
  scale: number
): { width: string; height: string; left: string; top: string; transform: string } {
  const finalScale = containScale(frame, natural) * placement.scale;
  const centerX = frame.width / 2 + offsetFromRatio(placement.offsetXRatio, frame.width);
  const centerY = frame.height / 2 + offsetFromRatio(placement.offsetYRatio, frame.height);

  return {
    width: `${(natural.width > 0 ? natural.width : 1) * finalScale * scale}px`,
    height: `${(natural.height > 0 ? natural.height : 1) * finalScale * scale}px`,
    left: `${centerX * scale}px`,
    top: `${centerY * scale}px`,
    transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
  };
}

/**
 * Inline CSS for a BACKGROUND slot's stand-in `<img>`: WBoost's deterministic
 * background fill is a COVER fit anchored TOP-LEFT (overflow crops away
 * bottom-right) — no pan, zoom or rotation, so no `Placement` is taken. Same
 * style shape as {@link ghostStyle} so the two are drop-in interchangeable.
 */
export function coverGhostStyle(
  frame: ImageFrameDTO,
  natural: NaturalSize,
  scale: number
): { width: string; height: string; left: string; top: string; transform: string } {
  const finalScale = coverScale(frame, natural);

  return {
    width: `${(natural.width > 0 ? natural.width : 1) * finalScale * scale}px`,
    height: `${(natural.height > 0 ? natural.height : 1) * finalScale * scale}px`,
    left: '0px',
    top: '0px',
    transform: 'none',
  };
}

/**
 * Convert a drag in display px into the pan fractions it represents. The frame
 * shrinks/grows with the preview zoom, so the drag is normalised by the frame's
 * on-screen size — dragging half way across the frame always means 0.5.
 */
export function panFromDrag(
  frame: ImageFrameDTO,
  scale: number,
  deltaX: number,
  deltaY: number
): { offsetXRatio: number; offsetYRatio: number } {
  const displayWidth = frame.width * scale;
  const displayHeight = frame.height * scale;

  return {
    offsetXRatio: displayWidth > 0 ? deltaX / displayWidth : 0,
    offsetYRatio: displayHeight > 0 ? deltaY / displayHeight : 0,
  };
}
