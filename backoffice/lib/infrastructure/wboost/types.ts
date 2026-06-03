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
