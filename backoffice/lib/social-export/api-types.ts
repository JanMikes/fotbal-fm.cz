/**
 * DTOs shared between the social-export API routes and the frontend.
 *
 * These are the ONLY shapes the browser sees. They are deliberately a safe
 * subset of the raw WBoost types: absolute `localhost` URLs are replaced by the
 * service with same-origin proxy paths, and no OAuth/secret material is exposed.
 *
 * This module is client-safe (pure types + constants, no server imports).
 */

/** A placeholder input, as exposed to the form. Bind by `id`, never by `name`. */
export interface TemplateInputDTO {
  id: string;
  name: string | null;
  maxLength: number | null;
  locked: boolean;
  uppercase: boolean;
  description: string | null;
  hidable: boolean;
  /**
   * The textbox bounding box in canvas px, used to draw a highlight box over the
   * preview. `null` when the textbox can't be located — fall back to the flat form.
   */
  frame: ImageFrameDTO | null;
}

/** A rectangle in the variant's canvas pixel space (used to size a positioning UI). */
export interface ImageFrameDTO {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One gallery folder an image slot may pick from / upload into. */
export interface PlaceholderDirectoryDTO {
  id: string;
  name: string;
}

/**
 * An image placeholder slot, as exposed to the form. The user picks a picture
 * (gallery / upload) that renders object-contain + centered in `frame`, and may
 * move/zoom/rotate it within the allowed flags. Bind by `id`, never by `name`.
 */
export interface ImageInputDTO {
  id: string;
  name: string | null;
  description: string | null;
  allowMove: boolean;
  allowResize: boolean;
  allowRotate: boolean;
  hidable: boolean;
  /**
   * The folders the slot may pick from / upload into (resolved server-side,
   * with display names). The UPLOAD TARGET IS THE USER'S CHOICE: when more
   * than one target exists (folders + root), the upload must carry an explicit
   * `directoryId` — restricted multi-folder slots reject uploads without one.
   */
  directories: PlaceholderDirectoryDTO[];
  /**
   * True for unrestricted slots: the gallery root is also a valid pick source
   * and upload target (an upload without `directoryId` lands in the root).
   */
  includesRoot: boolean;
  /** Designer frame in canvas px; null only for malformed variants. */
  frame: ImageFrameDTO | null;
  /** Stand-in shown when the slot is left empty; absolute store URL, nullable. */
  defaultImageUrl: string | null;
}

/** A pickable gallery image for an image slot (from the list/upload endpoints). */
export interface GalleryImageDTO {
  /** Use as `imageId` in the render `images` payload. */
  id: string;
  /** Presigned store URL, loadable directly by the browser. */
  url: string;
  /** Null for gallery-root images (unrestricted slots only). */
  directoryId: string | null;
  directoryName: string | null;
  uploadedAt: string | null;
}

/** One renderable variant (dimension/ratio) of a template. */
export interface TemplateVariantDTO {
  id: string;
  dimension: string;
  width: number;
  height: number;
  /**
   * Same-origin proxy path for the variant thumbnail, or null if thumbnails are
   * disabled. Points at `GET /api/social-export/thumbnail?variantId=<id>`, which
   * streams the image from the API host using the bearer token — the browser
   * never sees the API host or the object store. Null when WBOOST_THUMBNAILS is off.
   */
  thumbnailUrl: string | null;
  /** Whether the variant has a cached default render (previewImageUrl != null). */
  hasDefaultPreview: boolean;
  inputs: TemplateInputDTO[];
  /** Image placeholder slots (empty when the variant has none). */
  imageInputs: ImageInputDTO[];
}

/** A social-network template, grouped/sorted-ready for display. */
export interface TemplateDTO {
  id: string;
  name: string;
  position: number;
  categoryId: string | null;
  categoryName: string | null;
  variants: TemplateVariantDTO[];
}

/** Response body of `GET /api/social-export/templates` (wrapped in apiSuccess). */
export interface TemplatesResponse {
  templates: TemplateDTO[];
}

/**
 * A single render input value: a plain string sets the text, or an object form
 * `{ value?, hide? }`. `hide` is only honored for inputs with `hidable: true`.
 */
export type RenderInputValue = string | { value?: string; hide?: boolean };

/**
 * A single render image value: a plain gallery image id (centered + contained),
 * or an object with placement. `scale`/`offsetX`/`offsetY`/`rotation` are only
 * accepted when the slot's matching `allow*` flag is true; `hide` only when
 * `hidable`. Build it with `buildRenderImages` so disallowed params are never sent.
 */
export type RenderImageValue =
  | string
  | {
      imageId?: string;
      scale?: number;
      offsetX?: number;
      offsetY?: number;
      rotation?: number;
      hide?: boolean;
    };

/** Request body of `POST /api/social-export/render`. Returns raw `image/png` bytes. */
export interface RenderRequest {
  variantId: string;
  /** Keyed by input UUID. Omitted inputs keep their default text. */
  inputs: Record<string, RenderInputValue>;
  /** Keyed by imageInput UUID. Omitted slots keep their stand-in. Optional + backward-compatible. */
  images?: Record<string, RenderImageValue>;
}

/** API route base path for the social-export feature. */
export const SOCIAL_EXPORT_API_BASE = '/api/social-export';
