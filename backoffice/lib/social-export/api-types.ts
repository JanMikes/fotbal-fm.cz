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
/** Resolved list styling (canvas px, defaults derived server-side). */
export interface ListStyleDTO {
  bullet: 'disc' | 'dash' | 'check' | 'image';
  bulletImageUrl: string | null;
  indent: number;
  itemSpacing: number;
  blockSpacing: number;
  /**
   * Checkbox state art for 'cb'/'cbx' items; null = the default drawn
   * checkbox (rounded square in the item's text color, checked adds a
   * white check mark).
   */
  checkboxImageUrl: string | null;
  checkboxCheckedImageUrl: string | null;
}

/** Capabilities of a dedicated checklist component input. */
export interface ChecklistCapabilitiesDTO {
  toggle: boolean;
  editText: boolean;
  addItems: boolean;
  removeItems: boolean;
}

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
   * For container members this is the DESIGNED position — the rendered PNG may
   * shift the text vertically per the fill (see `TemplateContainerDTO`).
   */
  frame: ImageFrameDTO | null;
  /** Container this input reflows inside (`TemplateVariantDTO.containers`), or null. */
  containerId: string | null;
  /** Fabric text metrics for client-side re-measuring; null when unavailable. */
  textStyle: TextStyleDTO | null;
  /**
   * True → the user may FORMAT parts of the text (font face / color /
   * underline): render the rich editor and send the value as `{ runs }`.
   * The pickable fonts + swatches live in `TemplateVariantDTO.richTextOptions`.
   */
  richText: boolean;
  /**
   * True → the rich envelope may also carry per-line list types
   * (`lines: ["p","ul","ol",...]`) and the export lays the value out as a
   * block stack (paragraphs + bulleted/numbered items). The list-editing UI
   * is not built here yet — untouched inputs still render their lists via
   * the server-side sample fallback, and editing a rich value simply sends
   * runs without lines (renders without list structure).
   */
  lists: boolean;
  /** Resolved bullet + spacing geometry; non-null exactly when `lists`. */
  listStyle: ListStyleDTO | null;
  /**
   * True (implies `lists`) → the envelope's `lines` may also carry checkbox
   * item types ('cb' unchecked / 'cbx' checked; 400
   * `checkbox_lists_not_allowed` otherwise). Like `lists`, the editing UI is
   * not built here yet — sample-driven checklists render server-side.
   */
  listCheckboxes: boolean;
  /**
   * Non-null → DEDICATED checklist component: the intended UI is a fixed
   * per-item editor (checkbox + text per row) honoring these capability
   * flags — `toggle` (check/uncheck), `editText`, `addItems`,
   * `removeItems`. The wire format is the ordinary checkbox-list envelope.
   * With all four flags false the server ignores overrides (read-only).
   * Editing UI not built here yet — sample-driven checklists render
   * server-side.
   */
  checklist: ChecklistCapabilitiesDTO | null;
  /**
   * "Vzorový text" — the admin's default fill. The render uses it whenever
   * the export payload OMITS this input (buildRenderInputs omits empty
   * untouched fields, so samples apply automatically); an explicit "" would
   * suppress it. Same wire format the export accepts.
   */
  sampleValue: string | null;
  /**
   * Stacking position on the variant canvas (0 = backmost, higher = on top).
   * One index space with `ImageInputDTO.layerIndex` — sort both lists together
   * by it (descending = topmost first) to build the layers panel. Values may
   * have gaps; null when the object can't be located (or on older API deploys).
   */
  layerIndex: number | null;
}

/**
 * One styled segment of a rich-text value. Null style = inherit the designed
 * style. The concatenation of run texts is the plain-text projection
 * (`maxLength` counts it). Run text must not contain line breaks.
 */
export interface RichRunDTO {
  text: string;
  /** Must be one of `richTextOptions.fonts[].family`; null = designed font. */
  fontFamily: string | null;
  /** Lowercase `#rrggbb`, or null = designed color. Any well-formed hex is accepted. */
  color: string | null;
  underline: boolean;
}

/**
 * One pickable font face for the rich editor. Faces are standalone families
 * ("Rubik (Rubik Bold)") — bold/italic toggles switch `family`; group by
 * `fontName` and map B/I via `weight`/`style` (best-effort metadata).
 */
export interface RichTextFontOptionDTO {
  family: string;
  fontName: string;
  faceName: string;
  weight: number;
  style: string;
  /** Same-origin proxy path serving the font file (for @font-face preview). */
  url: string;
}

/** Fonts whitelist + brand color swatches for a variant's rich-text inputs. */
export interface RichTextOptionsDTO {
  fonts: RichTextFontOptionDTO[];
  /** Suggested brand swatches (primary first), lowercase `#rrggbb`. NOT a whitelist. */
  colors: string[];
}

/** Fabric text metrics of one text input (wrap width = `frame.width`). */
export interface TextStyleDTO {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  charSpacing: number;
  /** Horizontal alignment (left|center|right|justify); absent on older API deploys. */
  textAlign?: string;
}

/**
 * A "smart text area": its members reflow vertically at render time — longer
 * text pushes the flow items below it down, hidden members collapse, and the
 * flow of a TOP-LEVEL container must fit `maxHeight` px from `y` downward
 * (canvas px), otherwise the render fails with a `container_overflow` 400
 * (see `RenderErrorDetails`; `containerId` is always the top-level id).
 *
 * Containers can NEST (2026-08 rework): a child in `memberContainerIds` flows
 * inside its parent as one block and grows freely — `nested: true` containers
 * do not enforce their own maxHeight. A non-null `gap` replaces the designed
 * spacing between consecutive flow items with a uniform value. Containers may
 * also hold decorative images server-side (not exposed here), so the client
 * mirror is approximate for those — the server render stays authoritative.
 */
export interface TemplateContainerDTO {
  id: string;
  maxHeight: number;
  /** Container top = highest designed member in its tree (canvas px). */
  y: number;
  /** FILLABLE member input UUIDs in flow order (top → bottom). */
  memberInputIds: string[];
  /** Nested child container ids (absent/empty on flat containers). */
  memberContainerIds?: string[];
  /** Non-null → uniform px spacing between flow items; null/absent = designed gaps. */
  gap?: number | null;
  /**
   * Guaranteed clearance below the container (canvas px): the landing
   * distance when it collision-pushes the container under it, and its margin
   * against the canvas bottom. Null/absent = 0.
   */
  spaceAfter?: number | null;
  /** True → flows inside a parent; its own maxHeight is NOT enforced. */
  nested?: boolean;
}

/**
 * Structured details of a failed render, forwarded from the WBoost 400 body.
 * `code === 'container_overflow'` → point the user at the container's inputs.
 */
export interface RenderErrorDetails {
  code?: string;
  containerId?: string | null;
  overflowPx?: number;
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
  /**
   * Stacking position on the variant canvas — one index space with
   * `TemplateInputDTO.layerIndex` (see there). Null when unavailable.
   */
  layerIndex: number | null;
  /**
   * True = the variant's BACKGROUND layer. `frame` is the full canvas rect and
   * the fill is deterministic: COVER-fit (`max(frame.width / naturalWidth,
   * frame.height / naturalHeight)`) anchored TOP-LEFT — NOT the centered
   * object-contain math regular slots use. No transform is ever accepted
   * (`allow*` are always false): send the shorthand image id / `{ imageId }`
   * only, plus `{ hide: true }` when `hidable`. False on older API payloads.
   */
  isBackground: boolean;
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
  /**
   * Display label: a ratio ("1:1") for social formats, a human size label
   * ("210 × 297 mm") for print / free-form variants.
   */
  dimension: string;
  width: number;
  height: number;
  /**
   * '1:1' | '4:5' | '9:16' when the variant is a social format, null for
   * print / free-form sizes (or on older API deploys).
   */
  preset: string | null;
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
  /** Containers ("smart text areas"); empty when the variant has none. */
  containers: TemplateContainerDTO[];
  /** Fonts + swatches for rich-text inputs; null unless some input has `richText: true`. */
  richTextOptions: RichTextOptionsDTO | null;
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
 * Response body of `GET /api/social-export/fonts` (wrapped in apiSuccess):
 * EVERY project font face (same shape as `richTextOptions.fonts`, which only
 * lists a variant's rich whitelist). `family` is the exact Fabric string that
 * `inputs[].textStyle.fontFamily` carries; `url` is the same-origin font
 * proxy. Loaded once per session by `useWboostFonts` so client-side text
 * measurement wraps with the real glyph metrics.
 */
export interface ProjectFontsResponse {
  fonts: RichTextFontOptionDTO[];
}

/**
 * A single render input value: a plain string sets the text, an object form
 * `{ value?, hide? }`, or — only for inputs with `richText: true` — the rich
 * form `{ runs, hide? }`. `hide` is only honored for inputs with
 * `hidable: true`; `runs` and `value` are mutually exclusive.
 */
export type RenderInputValue =
  | string
  | { value?: string; hide?: boolean }
  | { runs: RichRunDTO[]; hide?: boolean };

/**
 * A single render image value: a plain gallery image id (centered + contained),
 * or an object with placement. `scale`/`offsetX`/`offsetY`/`rotation` are only
 * accepted when the slot's matching `allow*` flag is true; `hide` only when
 * `hidable`. Background slots (`isBackground: true`) accept NO transform at all —
 * only the shorthand id / `{ imageId }` / `{ hide }`. Build it with
 * `buildRenderImages` so disallowed params are never sent.
 */
export type RenderImageValue =
  | string
  | {
      imageId?: string;
      scale?: number;
      /** Pan in canvas px (single-variant form; we send the ratio instead). */
      offsetX?: number;
      offsetY?: number;
      /** Pan as a fraction of the slot's frame — portable across variants. */
      offsetXRatio?: number;
      offsetYRatio?: number;
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
