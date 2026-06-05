/**
 * Raw types for the WBoost Brand-Manuals API responses.
 *
 * These mirror the JSON the external API returns verbatim (including nullable
 * fields that are intentionally kept). Do NOT expose these directly to the
 * frontend — map them to the DTOs in `lib/social-export/api-types.ts` first
 * (the service rewrites absolute `localhost` URLs to safe proxy URLs).
 */

/** A single placeholder input on a template variant. Bind by `id` (UUID), never by `name`. */
export interface WboostRawInput {
  /** UUID — the KEY used in the export `inputs` payload. */
  id: string;
  /** Human-readable, usually Czech. Nullable and NOT unique. */
  name: string | null;
  /** Nullable max character length; enforced by the API (over-length → 400). */
  maxLength: number | null;
  /** Locked inputs cannot be addressed — they always render their canvas default. */
  locked: boolean;
  /** When true the value is uppercased on render. */
  uppercase: boolean;
  /** Nullable help text / placeholder. */
  description: string | null;
  /** When true the element may be hidden via `{ hide: true }`. */
  hidable: boolean;
}

/** A rectangle in the variant's canvas pixel space. */
export interface WboostRawFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A single image placeholder slot on a template variant. The designer drew a
 * fixed `frame`; the end-user picks (or uploads) a picture that is placed
 * object-contain + centered inside it, optionally moved/zoomed/rotated within
 * the limits the designer set. Bind by `id` (UUID), never by `name`.
 */
export interface WboostRawImageInput {
  /** UUID — the KEY used in the export `images` payload. */
  id: string;
  /** Human-readable label. Nullable and NOT unique. */
  name: string | null;
  /** Nullable help text. */
  description: string | null;
  /** User may pan the picture in the frame. */
  allowMove: boolean;
  /** User may zoom (uniform scale). */
  allowResize: boolean;
  /** User may rotate. */
  allowRotate: boolean;
  /** Offer a "hide this slot" toggle (sent as `{ hide: true }`). */
  hidable: boolean;
  /** Gallery folder ids this slot may pull from (use the list endpoint to resolve). */
  allowedDirectoryIds: string[];
  /** Designer frame in canvas px; `null` only for malformed variants. */
  frame: WboostRawFrame | null;
  /** Stand-in shown if the slot is left empty. Absolute URL at the store host; nullable. */
  defaultImageUrl: string | null;
}

/** One renderable variant (a specific dimension/ratio) of a template. */
export interface WboostRawVariant {
  /** UUID — used to build the preview/export URL. Unique per variant. */
  id: string;
  /** Label for the variant chooser, e.g. "1:1", "9:16", "4:5". */
  dimension: string;
  width: number;
  height: number;
  /** Nullable cached DEFAULT render (zero user input). Absolute URL at the store host. */
  previewImageUrl: string | null;
  /** Thumbnail / background. Absolute URL at the store host (localhost:19000). */
  backgroundImageUrl: string | null;
  /** Absolute export URL at the API host — DO NOT POST verbatim; rebuild from apiBase + id. */
  exportUrl: string | null;
  inputs: WboostRawInput[];
  /** Image placeholder slots. Empty when the variant has none; may be absent on older payloads. */
  imageInputs?: WboostRawImageInput[];
}

/**
 * A gallery image returned by the slot's image list/upload endpoints. The `url`
 * is a presigned store URL meant to be loaded directly by the browser.
 */
export interface WboostRawGalleryImage {
  /** UUID — use as the `imageId` in the export `images` payload. */
  id: string;
  url: string;
  directoryId: string;
  /** Present on the list endpoint; absent on the upload response. */
  directoryName?: string;
  /** Present on the list endpoint; absent on the upload response. */
  uploadedAt?: string;
}

/** A social-network template. Group by `categoryName`; order by `position`. */
export interface WboostRawTemplate {
  id: string;
  name: string;
  /** Sort ascending for display order. Not guaranteed unique across templates. */
  position: number;
  categoryId: string | null;
  categoryName: string | null;
  createdAt: string;
  variants: WboostRawVariant[];
}

/** OAuth2 client_credentials token response. */
export interface WboostTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
}
