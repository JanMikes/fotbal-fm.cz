/**
 * Pure geometry helpers for mapping designer canvas coordinates to on-screen
 * display pixels. Client-safe (no imports beyond shared types).
 *
 * The preview <img> is rendered object-contain inside a container whose
 * aspect-ratio equals the variant's (width/height), so there is no
 * letterboxing — the rendered image rect equals the container rect. Therefore
 * canvas-px → display-px is a single uniform scale factor:
 *   scale = renderedImgWidth / variant.width
 */

import type { ImageFrameDTO } from './api-types';

/** A rectangle in display (CSS) pixels, relative to the overlay's top-left. */
export interface DisplayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Map a canvas-px `frame` to display-px using the single scale factor.
 * `scale = renderedImgWidth / variant.width` (see module doc).
 */
export function canvasToDisplay(frame: ImageFrameDTO, scale: number): DisplayRect {
  return {
    left: frame.x * scale,
    top: frame.y * scale,
    width: frame.width * scale,
    height: frame.height * scale,
  };
}
