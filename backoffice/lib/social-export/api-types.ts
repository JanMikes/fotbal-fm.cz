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

/** Request body of `POST /api/social-export/render`. Returns raw `image/png` bytes. */
export interface RenderRequest {
  variantId: string;
  /** Keyed by input UUID. Omitted inputs keep their default text. */
  inputs: Record<string, RenderInputValue>;
}

/** API route base path for the social-export feature. */
export const SOCIAL_EXPORT_API_BASE = '/api/social-export';
