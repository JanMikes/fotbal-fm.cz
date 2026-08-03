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
  /**
   * Designer frame (the textbox bounding box) in canvas px; `null` when the
   * textbox can't be located on the canvas. May be absent on older payloads.
   * For container members this is the DESIGNED position — the render may move
   * the box vertically per the fill (see `WboostRawContainer`).
   */
  frame?: WboostRawFrame | null;
  /**
   * Id of the container (see `WboostRawVariant.containers`) this input reflows
   * inside, or null for an independent input. May be absent on older payloads.
   */
  containerId?: string | null;
  /**
   * Fabric text metrics of the box (wrap width = `frame.width`) — only needed
   * to re-measure wrapped text height client-side. May be absent on older payloads.
   */
  textStyle?: WboostRawTextStyle | null;
  /**
   * True → the export accepts a rich `{ runs }` value for this input (font
   * face / color / underline). May be absent on older payloads.
   */
  richText?: boolean;
  /**
   * Stacking position of the input's object on the variant canvas (0 =
   * backmost, higher = painted on top). Shares ONE index space with
   * `imageInputs[].layerIndex`; values may have gaps (decorative objects
   * occupy positions too). Null when the object can't be located; may be
   * absent on older payloads.
   */
  layerIndex?: number | null;
}

/** One pickable font face for rich-text inputs (faces are standalone families). */
export interface WboostRawRichTextFontOption {
  /** The exact fontFamily string a rich run must carry. */
  family: string;
  fontName: string;
  faceName: string;
  weight: number;
  style: string;
  /** Absolute store URL of the font file (host may be `localhost` in dev — proxy it). */
  url: string;
}

/** Fonts whitelist + brand color swatches for a variant's rich-text inputs. */
export interface WboostRawRichTextOptions {
  fonts: WboostRawRichTextFontOption[];
  /** Lowercase `#rrggbb`, primary brand colors first. Suggestions, not a whitelist. */
  colors: string[];
}

/**
 * One project font face from `GET /api/projects/{projectId}/fonts` — the same
 * shape as the rich-text option, but covering EVERY uploaded face of the
 * project (fonts for client-side text measurement, not just rich whitelists).
 * The endpoint may be absent on older API deploys (404).
 */
export type WboostRawProjectFont = WboostRawRichTextFontOption;

/** Fabric text metrics of one text input. */
export interface WboostRawTextStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  charSpacing: number;
  /** Horizontal alignment (left|center|right|justify); absent on older API deploys. */
  textAlign?: string;
}

/**
 * A "smart text area": its member inputs reflow vertically at render time —
 * longer text pushes the members below it down, hidden members collapse, and
 * the flow is bounded by `maxHeight` px measured from `y` downward (canvas
 * px). An export whose container content can't fit responds 400 with
 * `code: "container_overflow"`.
 */
export interface WboostRawContainer {
  id: string;
  maxHeight: number;
  /** Container top = designed top of the first member (canvas px). */
  y: number;
  /** Member input UUIDs in flow order (top → bottom). */
  memberInputIds: string[];
}

/** A rectangle in the variant's canvas pixel space. */
export interface WboostRawFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One gallery folder an image slot may pick from / upload into. */
export interface WboostRawPlaceholderDirectory {
  id: string;
  name: string;
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
  /** Raw designer allow-list ([] = unrestricted). Prefer `directories`. */
  allowedDirectoryIds: string[];
  /**
   * RESOLVED upload/pick folders with display names (the empty allow-list is
   * already expanded, deleted folders dropped). These are the valid
   * `directoryId` upload targets. May be absent on older payloads.
   */
  directories?: WboostRawPlaceholderDirectory[];
  /**
   * True for unrestricted slots: the gallery ROOT is also a valid pick source
   * and upload target (upload with no `directoryId` stores into the root).
   * May be absent on older payloads.
   */
  includesRoot?: boolean;
  /** Designer frame in canvas px; `null` only for malformed variants. */
  frame: WboostRawFrame | null;
  /** Stand-in shown if the slot is left empty. Absolute URL at the store host; nullable. */
  defaultImageUrl: string | null;
  /**
   * Stacking position of the slot's object on the variant canvas — one index
   * space with `inputs[].layerIndex` (see there). Null when the object can't
   * be located; may be absent on older payloads.
   */
  layerIndex?: number | null;
  /**
   * True = this slot is the variant's BACKGROUND layer: `frame` is the full
   * canvas rect, the picture is COVER-fitted over it anchored top-left
   * (overflow crops bottom-right), and NO transform is accepted — the `allow*`
   * flags are always false; the export payload must be the shorthand image id
   * or `{ imageId }` (plus `{ hide: true }` when hidable). May be absent on
   * older payloads (→ false).
   */
  isBackground?: boolean;
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
  /** Containers ("smart text areas"). May be absent on older payloads. */
  containers?: WboostRawContainer[];
  /**
   * Fonts + swatches for rich-text inputs. Null/absent unless some input has
   * `richText: true`.
   */
  richTextOptions?: WboostRawRichTextOptions | null;
}

/**
 * A gallery image returned by the slot's image list/upload endpoints. The `url`
 * is a presigned store URL meant to be loaded directly by the browser.
 */
export interface WboostRawGalleryImage {
  /** UUID — use as the `imageId` in the export `images` payload. */
  id: string;
  url: string;
  /** Null/absent for gallery-root images (the API serializer omits null fields). */
  directoryId?: string | null;
  /** Present on the list endpoint; null/absent for root images and on the upload response. */
  directoryName?: string | null;
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
