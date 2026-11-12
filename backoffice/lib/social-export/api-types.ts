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
   * The swatches live in `TemplateVariantDTO.richTextOptions`; the FACES the
   * editor may offer are this input's `fontOptions`.
   */
  richText: boolean;
  /**
   * Font choice: the faces this input may be filled in, designed font FIRST
   * (`textStyle.fontFamily`), then what the designer opened up. Non-null →
   * the user may switch: a plain input gets a font select (send the pick as
   * the value's `fontFamily`), a rich input uses it as the WYSIWYG's face
   * menu (the per-input whitelist for the runs' `fontFamily`). Null → no
   * choice, the designed font renders. Font URLs are same-origin proxy paths.
   */
  fontOptions: RichTextFontOptionDTO[] | null;
  /**
   * Colour allowlist for a rich input's runs: null = any hex (offer the brand
   * swatches + a free picker), `[]` = colour locked (offer no colour UI),
   * a list = only these swatches (lowercase `#rrggbb`, no free picker). A
   * colour outside the list is a 400 `color_not_allowed`.
   */
  colorOptions: string[] | null;
  /**
   * True → the rich envelope may also carry per-line list types
   * (`lines: ["p","ul","ol",...]`) and the export lays the value out as a
   * block stack (paragraphs + bulleted/numbered items). The rich editor
   * offers list buttons and sends the structure in `InputFieldState.lines`.
   */
  lists: boolean;
  /** Resolved bullet + spacing geometry; non-null exactly when `lists`. */
  listStyle: ListStyleDTO | null;
  /**
   * True (implies `lists`) → the envelope's `lines` may also carry checkbox
   * item types ('cb' unchecked / 'cbx' checked; 400
   * `checkbox_lists_not_allowed` otherwise); the rich editor then also
   * offers a checkbox-list button.
   */
  listCheckboxes: boolean;
  /**
   * Non-null → DEDICATED checklist component: the intended UI is a fixed
   * per-item editor (checkbox + text per row) honoring these capability
   * flags — `toggle` (check/uncheck), `editText`, `addItems`,
   * `removeItems`. The wire format is the ordinary checkbox-list envelope.
   * With all four flags false the server ignores overrides (read-only).
   * Edited through `ChecklistEditor`.
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
  /**
   * Set on the copies `expandRepeatableRows` materialises for a repeatable
   * row's slots ≥ 1 (and on the template row's own members, slot 0): which
   * row, which 0-based slot, and the TEMPLATE row member id it copies. Absent
   * on everything outside a repeatable row.
   */
  rowSlot?: RowSlotRef;
}

/** Where a field sits in a repeatable row (see `TemplateVariantDTO.repeatableRows`). */
export interface RowSlotRef {
  /** The row container id (the key of the render body's `rows`). */
  rowId: string;
  /** 0-based slot: 0 = the template row itself. */
  slot: number;
  /** The template row's member id this field copies (the key inside one row object). */
  memberId: string;
}

/**
 * Per-LINE block type of a rich value (one entry per `\n`-separated line of
 * the concatenated runs): `p` paragraph, `ul` bullet item, `ol` numbered item,
 * `cb` / `cbx` unchecked / checked checkbox item. Only for inputs with
 * `lists` (`cb`/`cbx` additionally need `listCheckboxes`).
 */
export type ListLineType = 'p' | 'ul' | 'ol' | 'cb' | 'cbx';

/**
 * One styled segment of a rich-text value. Null style = inherit the designed
 * style. The concatenation of run texts is the plain-text projection
 * (`maxLength` counts it). `\n` in a run is a hard line break.
 */
export interface RichRunDTO {
  text: string;
  /** Must be one of `richTextOptions.fonts[].family`; null = designed font. */
  fontFamily: string | null;
  /** Lowercase `#rrggbb`, or null = designed color. Any well-formed hex is accepted unless the input carries `colorOptions`. */
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
  /**
   * True → the designer lets the user hide the WHOLE container (WBoost
   * 2026-11): one toggle, sent as `inputs[<container id>] = { hide: true }`.
   * The container and everything in its tree (texts, decorative images,
   * shapes, nested containers) disappear; the members' own states are kept.
   * A hidable container may have `memberInputIds: []` (images / shapes only):
   * it is listed for its toggle and has nothing to reflow.
   */
  hidable?: boolean;
  /** Label of that toggle; null/absent = unnamed. */
  name?: string | null;
  /**
   * Fillable IMAGE slots flowing in this container (WBoost 2026-11) — they
   * are NOT in `memberInputIds`, which stays text-only. Absent/empty on older
   * payloads.
   */
  memberImageInputIds?: string[];
  /** Non-null → a REPEATABLE ROW (see `TemplateVariantDTO.repeatableRows`). */
  repeat?: RepeatSpecDTO | null;
  /**
   * Set on the copies `expandRepeatableRows` materialises for a repeatable
   * row's slots ≥ 1 (and on the template row's own members, slot 0): which
   * row, which 0-based slot, and the TEMPLATE row member id it copies. Absent
   * on everything outside a repeatable row.
   */
  rowSlot?: RowSlotRef;
}

/** How often a repeatable row may show: `min`…`max`, `default` on a fresh fill. */
export interface RepeatSpecDTO {
  min: number;
  max: number;
  default: number;
}

/** One member of a repeatable row's TEMPLATE row (the keys of one row object). */
export interface RepeatableRowMemberDTO {
  id: string;
  kind: 'text' | 'image' | 'shape' | 'container';
  name: string | null;
}

/** The id every member carries in one row (index 0 = the template row's own ids). */
export interface RepeatableRowSlotDTO {
  index: number;
  containerId: string;
  /** template member id (and the row container id) → that slot's id */
  ids: Record<string, string>;
}

/**
 * A row the designer drew ONCE that the user may repeat (WBoost 2026-11):
 * `repeat.min`…`repeat.max` rows flowing below each other inside
 * `parentContainerId`. Rendered through the bodies' `rows` (one object per
 * row, keyed by the template members' ids; the list length is the count).
 * `fitsRows` is the designed-geometry estimate of how many fit — a warning,
 * never a hard limit (real texts may wrap; the render 400s on overflow).
 */
export interface RepeatableRowDTO {
  containerId: string;
  parentContainerId: string | null;
  name: string | null;
  repeat: RepeatSpecDTO;
  fitsRows: number | null;
  members: RepeatableRowMemberDTO[];
  slots: RepeatableRowSlotDTO[];
}

/** Offset range of a movable element, canvas px relative to its designed position. */
export interface MoveRangeDTO {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * An element the user may MOVE (WBoost 2026-11): a text (locked ones too), a
 * shape, a decorative image or a whole top-level container. Send
 * `offsets[id] = { x, y }` clamped to `range` (the server's own bound);
 * `limits` (designer max per direction, null = anywhere on the artwork) is
 * informational. `frame` is the DESIGNED box — draw it at `frame + offset`.
 */
export interface MovableElementDTO {
  id: string;
  kind: 'text' | 'shape' | 'image' | 'container';
  name: string | null;
  frame: ImageFrameDTO | null;
  vertical: boolean;
  horizontal: boolean;
  limits: { up: number | null; down: number | null; left: number | null; right: number | null };
  range: MoveRangeDTO;
  /** A container's member ids (they move with it). */
  memberIds: string[];
}

/** One moved element's offset (canvas px). */
export interface ElementOffset {
  x: number;
  y: number;
}

/** elementId → offset (the `offsets` body of ONE variant). */
export type ElementOffsets = Record<string, ElementOffset>;

/** One row object of a `rows` body: template member id → its value. */
export type RenderRowValue = RenderInputValue | RenderImageValue;
export type RenderRow = Record<string, RenderRowValue>;
/** row container id → the shown rows, in order (length = count). */
export type RenderRows = Record<string, RenderRow[]>;

/**
 * A shape the designer opened up for RECOLOURING — one colour field. The
 * picked `#rrggbb` repaints its fill, its border or both (`target`), and is
 * sent as `shapeColors[id]` on render.
 */
export interface ShapeInputDTO {
  id: string;
  name: string | null;
  target: 'fill' | 'stroke' | 'both';
  /** The designed colour — the "reset" swatch, = colorOptions[0]. */
  defaultColor: string;
  /** Swatches to offer (lowercase `#rrggbb`); the only accepted values unless `freeColor`. */
  colorOptions: string[];
  /** Any hex is accepted — offer a colour picker next to the swatches. */
  freeColor: boolean;
  /** Bounding box in canvas px; null = no box over the preview. */
  frame: ImageFrameDTO | null;
  /** Stacking position — same index space as the text/image `layerIndex`. */
  layerIndex: number | null;
  /**
   * Set on the copies `expandRepeatableRows` materialises for a repeatable
   * row's slots ≥ 1 (and on the template row's own members, slot 0): which
   * row, which 0-based slot, and the TEMPLATE row member id it copies. Absent
   * on everything outside a repeatable row.
   */
  rowSlot?: RowSlotRef;
}

/**
 * Structured details of a failed render, forwarded from the WBoost 400 body.
 * `code === 'container_overflow'` → point the user at the container's inputs.
 */
export interface RenderErrorDetails {
  code?: string;
  containerId?: string | null;
  overflowPx?: number;
  /** The text input a value error concerns (value_too_long, rich-text codes, …). */
  inputId?: string;
  /** The image slot an image error concerns (image_not_allowed, …). */
  imageInputId?: string;
  /** The shape a colour error concerns (shape_color_not_allowed, invalid_shape_color). */
  shapeInputId?: string;
  /** Group renders: the member dimension that failed. */
  variantId?: string;
  /** Document renders: the page that failed. */
  pageId?: string;
  maxLength?: number;
  /** Move errors (unknown_element, move_not_allowed, offset_out_of_range). */
  elementId?: string;
  /** A refused value inside `rows`: its row + 0-based index. */
  rowContainerId?: string;
  rowIndex?: number;
  /**
   * `unfilled_pictures` (exports only): how many grey stand-in pictures an AI
   * scan left in the template(s) — offer "Exportovat přesto", which resends
   * the export with `allowUnfilled: true`. `editorUrl` is the WBoost editor of
   * the first affected variant (`variantId`).
   */
  count?: number;
  editorUrl?: string;
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
  /** Container this slot flows in (`memberImageInputIds`), or null. */
  containerId?: string | null;
  /**
   * Set on the copies `expandRepeatableRows` materialises for a repeatable
   * row's slots ≥ 1 (and on the template row's own members, slot 0): which
   * row, which 0-based slot, and the TEMPLATE row member id it copies. Absent
   * on everything outside a repeatable row.
   */
  rowSlot?: RowSlotRef;
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
  /** Shapes the user may recolour (empty when the designer opened none up). */
  shapeInputs: ShapeInputDTO[];
  /** Containers ("smart text areas"); empty when the variant has none. */
  containers: TemplateContainerDTO[];
  /** Fonts + swatches for rich-text inputs; null unless some input has `richText: true`. */
  richTextOptions: RichTextOptionsDTO | null;
  /**
   * True when this variant is a member dimension of its template's GROUP
   * (`TemplateDTO.group`) — filled once together with the other members. A
   * variant added by hand to a grouped template is not a member (false) and
   * is edited on its own.
   */
  groupMember: boolean;
  /**
   * Repeatable rows (empty when none). The variant's inputs / imageInputs /
   * shapeInputs / containers are EXPANDED to every row's `max` slots (see
   * `expandRepeatableRows`) — each copy carries `rowSlot` and its slot id.
   */
  repeatableRows?: RepeatableRowDTO[];
  /** Elements the user may move (empty / absent when none). */
  movableElements?: MovableElementDTO[];
}

/** The synchronized group a template is (one design in several dimensions). */
export interface TemplateGroupRefDTO {
  id: string;
  name: string;
  /**
   * The group's repeatable rows: ONE shared count for every dimension;
   * `fitsRows` is the SMALLEST member's estimate. Empty when none.
   */
  repeatableRows?: { containerId: string; repeat: RepeatSpecDTO; fitsRows: number | null }[];
}

/** A social-network template, grouped/sorted-ready for display. */
export interface TemplateDTO {
  id: string;
  name: string;
  position: number;
  categoryId: string | null;
  categoryName: string | null;
  variants: TemplateVariantDTO[];
  /**
   * Non-null → the template is a GROUP: its member variants (`groupMember`)
   * share their input ids and are filled ONCE, previewed per dimension and
   * exported as a ZIP (or one dimension as PNG).
   */
  group: TemplateGroupRefDTO | null;
  /**
   * Non-null → this template is a PAGE of a multi-page document. Page
   * templates are not offered on their own: the template picker hides them
   * and lists the document (`DocumentDTO`) instead.
   */
  document: TemplateDocumentRefDTO | null;
}

/** The document a page template belongs to. */
export interface TemplateDocumentRefDTO {
  id: string;
  name: string;
  position: number;
  pageId: string;
}

/** One page of a document: a template + its variant of the document size. */
export interface DocumentPageDTO {
  /** Page id — the key of `pages` in the fill body. */
  id: string;
  /** 0-based. */
  position: number;
  templateId: string;
  templateName: string;
  /** Same shape as a template variant — fills with the ordinary editor. */
  variant: TemplateVariantDTO;
}

/** One input a shared field fills (only VALID bindings reach the browser). */
export interface DocumentFieldBindingDTO {
  pageId: string;
  inputId: string;
}

export type DocumentFieldTextMode = 'plain' | 'rich' | 'list' | 'checklist';

/** A SHARED field: one value fills the bound input on every page. */
export interface DocumentFieldDTO {
  id: string;
  name: string;
  /** `shape` = a recolourable shape (`variant.shapeInputs`); its value is `#rrggbb`. */
  kind: 'text' | 'image' | 'shape';
  bindings: DocumentFieldBindingDTO[];
  /** Smallest maxLength of the bound text inputs (null = unlimited / image). */
  maxLength: number | null;
  /** Text: EVERY bound input is rich → the field value may carry `{ runs }` (offer the rich editor). */
  richText: boolean;
  /**
   * Text: the richest value EVERY bound input accepts — `plain` (string),
   * `rich` (`{runs}`), `list` (`{runs, lines}` with list blocks) or
   * `checklist` (a checklist value; binds only checklists). Send that shape.
   */
  textMode: DocumentFieldTextMode;
  /** Every bound input / slot is hidable → `{ hide: true }` as the field value hides it on every page. */
  hidable: boolean;
  /**
   * Image: the gallery folders a pick may come from — the INTERSECTION of
   * the bound slots' folders. null = any folder (also always for text);
   * [] = the slots share no folder (no pick passes every page).
   */
  allowedDirectoryIds: string[] | null;
}

/**
 * A multi-page document — e.g. a 4-page offer. One page size; every page
 * is filled separately (two pages may carry the SAME input id and still
 * keep their own values); only shared fields join pages.
 */
export interface DocumentDTO {
  id: string;
  name: string;
  position: number;
  categoryId: string | null;
  categoryName: string | null;
  /** Page size label ("210 × 297 mm" / "4:5"). */
  dimension: string;
  width: number;
  height: number;
  /** True → the print PDF (`format: "pdf"`) is offered. */
  printFormat: boolean;
  /** In page order. */
  pages: DocumentPageDTO[];
  fields: DocumentFieldDTO[];
}

/** Response body of `GET /api/social-export/documents` (wrapped in apiSuccess). */
export interface DocumentsResponse {
  documents: DocumentDTO[];
}

/** `pdf-screen` = PDF for sending, `pdf` = print PDF (printFormat only), `png` = ZIP of pages. */
export type DocumentExportFormat = 'pdf-screen' | 'pdf' | 'png';

/** A shared field value: text → plain string; image → gallery image id (or `{imageId, hide}`). */
export type DocumentFieldValue = RenderInputValue | { imageId?: string; hide?: boolean };

/** One page's own fill — the single-variant render body of that page's variant. */
export interface DocumentPageFill {
  inputs?: Record<string, RenderInputValue>;
  images?: Record<string, RenderImageValue>;
  shapeColors?: Record<string, string>;
  /** The page's repeatable rows (never shared). */
  rows?: RenderRows;
  /** The page's moved elements (never shared). */
  offsets?: ElementOffsets;
}

/** The document fill sent to WBoost: shared `fields` + per-page entries keyed by page id. */
export interface DocumentFillBody {
  fields: Record<string, DocumentFieldValue>;
  pages: Record<string, DocumentPageFill>;
}

/**
 * Request body of `POST /api/social-export/document-render`: `preview` one
 * page (`pageId`, WebP) or `export` the whole document in `format`.
 */
export interface DocumentRenderRequest extends DocumentFillBody {
  documentId: string;
  mode: 'preview' | 'export';
  pageId?: string;
  format?: DocumentExportFormat;
  /** `export` only: go through despite grey stand-in pictures (`unfilled_pictures`). */
  allowUnfilled?: boolean;
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
 * `{ value?, hide?, fontFamily? }`, or — only for inputs with `richText: true`
 * — the rich form `{ runs, hide?, fontFamily? }`. `hide` is only honored for
 * inputs with `hidable: true`; `runs` and `value` are mutually exclusive;
 * `fontFamily` (the whole-text font choice) must be one of the input's
 * `fontOptions[].family` and is refused where `fontOptions` is null.
 */
export type RenderInputValue =
  | string
  | { value?: string; hide?: boolean; fontFamily?: string }
  | { runs: RichRunDTO[]; lines?: ListLineType[]; hide?: boolean; fontFamily?: string };

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
  /** Keyed by shapeInput UUID → `#rrggbb`. Omitted shapes keep their designed colour. */
  shapeColors?: Record<string, string>;
  /** Repeatable rows; once sent, a row's values live ONLY here. */
  rows?: RenderRows;
  /** Moved elements. */
  offsets?: ElementOffsets;
}

/**
 * Per-dimension image placement of a group fill: variantId → imageInputId →
 * transform. It replaces the shared pick's transform in that dimension.
 */
export type GroupPlacements = Record<
  string,
  Record<string, { scale?: number; offsetXRatio?: number; offsetYRatio?: number; rotation?: number }>
>;

/**
 * Request body of the group routes (`/api/social-export/group-render`,
 * `/api/social-export/group-export`): ONE fill for every member dimension.
 */
export interface GroupRenderRequest {
  groupId: string;
  /** Member dimension to render (preview / single-dimension export); absent = the whole group as ZIP. */
  variantId?: string;
  inputs: Record<string, RenderInputValue>;
  /** Shared picks only: image id or `{ hide: true }` — placement lives in `placements`. */
  images?: Record<string, RenderImageValue>;
  placements?: GroupPlacements;
  /** Shared by every dimension (members share shape ids). */
  shapeColors?: Record<string, string>;
  /** Shared rows — ONE count for every dimension. */
  rows?: RenderRows;
  /** Moves are PER DIMENSION: variantId → elementId → offset. */
  offsets?: Record<string, ElementOffsets>;
  /** `export` only: go through despite grey stand-in pictures (`unfilled_pictures`). */
  allowUnfilled?: boolean;
}

/** Digest of a version's fill (what history lists show instead of a thumbnail). */
export interface ExportVersionSummaryDTO {
  texts: { label: string; value: string }[];
  pictures: number;
  hidden: number;
}

/**
 * One entry of a fill surface's shared EXPORT HISTORY in WBoost (a group for
 * synchronized templates, the variant otherwise). Pinned first, then freshest.
 */
export interface ExportVersionDTO {
  id: string;
  subject: 'group' | 'variant' | 'document';
  groupId: string | null;
  variantId: string | null;
  /** Document versions only. */
  documentId?: string | null;
  /** Document versions: saved work on the web, never exported. */
  draft?: boolean;
  name: string | null;
  pinned: boolean;
  pinnedAt: string | null;
  createdAt: string;
  lastExportedAt: string;
  exportCount: number;
  /** Channel of the latest export: web | api | mcp | facebook | instagram. */
  channel: string;
  summary: ExportVersionSummaryDTO;
}

/** A version's fill in the render request shape, seeded against the current design. */
export interface ExportVersionFillDTO {
  inputs: Record<string, RenderInputValue>;
  /** Picked images carry their public `url` next to `imageId`. */
  images: Record<string, RenderImageValue & { url?: string }>;
  placements: GroupPlacements;
  /** Shape inputId → `#rrggbb` ({} when no shape was recoloured). */
  shapeColors: Record<string, string>;
  /** Repeatable rows as the bodies send them ({} without rows). Not repeated in inputs/images/shapeColors. */
  rows?: RenderRows;
  /**
   * Moved elements: a VARIANT version `{ elementId: {x, y} }`, a GROUP
   * version `{ variantId: { elementId: {x, y} } }`. {} when nothing moved.
   */
  offsets?: Record<string, ElementOffset> | Record<string, ElementOffsets>;
}

export interface ExportVersionDetailDTO extends ExportVersionDTO {
  fill: ExportVersionFillDTO;
}

/**
 * A DOCUMENT version's fill in the document export body's shape: `pages` is
 * complete (shared values already fanned out), `fields` re-collects each
 * shared field's value. Picked images carry their public `url`.
 */
export interface DocumentExportVersionFillDTO {
  fields: Record<string, DocumentFieldValue & { url?: string }>;
  pages: Record<
    string,
    {
      inputs: Record<string, RenderInputValue>;
      images: Record<string, RenderImageValue & { url?: string }>;
      shapeColors: Record<string, string>;
      rows?: RenderRows;
      offsets?: ElementOffsets;
    }
  >;
}

export interface DocumentExportVersionDetailDTO extends ExportVersionDTO {
  fill: DocumentExportVersionFillDTO;
}

/** API route base path for the social-export feature. */
export const SOCIAL_EXPORT_API_BASE = '/api/social-export';
