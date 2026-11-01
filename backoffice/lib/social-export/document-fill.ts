/**
 * Multi-page DOCUMENT fill — pure state helpers (client-safe).
 *
 * A document is filled PAGE BY PAGE: every page keeps its own form / image /
 * shape state keyed by its page id, and inside a page by the variant's own
 * input ids. Two pages may carry the SAME input id (a duplicated template) —
 * their values never mix, because the state is always looked up per page.
 *
 * Only SHARED FIELDS join pages: one value is sent once as `fields[fieldId]`
 * and WBoost writes its TEXT into the bound input of every page (it wins over
 * the page's own text; the page's own hide / font for that input are kept
 * unless the field value sets them). To keep the click-into-preview editor
 * truthful, the shared text is also mirrored into the bound inputs' page
 * state, and a text edit of a bound input on any page updates the shared
 * value — while its hide / font stay per page.
 */

import type {
  DocumentDTO,
  DocumentFieldDTO,
  ImageInputDTO,
  DocumentFillBody,
  RichTextOptionsDTO,
  TemplateInputDTO,
  DocumentFieldValue,
  DocumentPageDTO,
  DocumentPageFill,
} from './api-types';
import { buildRenderInputs, initialFieldState, type InputFieldState } from './field-rules';
import { buildRenderImages, defaultImageSlotState, type ImageSlotState } from './field-rules-image';
import { NEUTRAL_PLACEMENT } from './image-placement';
import { applySavedForm, applySavedImages, type SavedDocumentState } from './saved-state';
import { sanitizeShapeColors, type ShapeColorState } from './shape-colors';

/** pageId → inputId → field state. */
export type PageForms = Record<string, Record<string, InputFieldState>>;
/** pageId → image slotId → slot state. */
export type PageImages = Record<string, Record<string, ImageSlotState>>;
/** pageId → shapeId → colour. */
export type PageShapeColors = Record<string, ShapeColorState>;
/**
 * Shared TEXT field id → its state (value, rich runs, field-wide hide / font).
 * Absent = never touched (pages keep their own values).
 */
export type SharedTextValues = Record<string, InputFieldState>;

export interface DocumentFillState {
  forms: PageForms;
  images: PageImages;
  shapeColors: PageShapeColors;
}

/**
 * The starting fill: every page seeded like a single variant — its sample
 * texts, overlaid with the match prefill computed for THAT page's inputs.
 */
export function initDocumentFill(
  document: DocumentDTO,
  prefillFor: (page: DocumentPageDTO) => Record<string, string>
): DocumentFillState {
  const forms: PageForms = {};
  const images: PageImages = {};
  const shapeColors: PageShapeColors = {};

  for (const page of document.pages) {
    const prefill = prefillFor(page);
    forms[page.id] = Object.fromEntries(
      page.variant.inputs.map((input) => [input.id, initialFieldState(input, prefill[input.id])])
    );
    images[page.id] = Object.fromEntries(
      page.variant.imageInputs.map((slot) => [slot.id, defaultImageSlotState()])
    );
    shapeColors[page.id] = {};
  }

  return { forms, images, shapeColors };
}

/**
 * The starting values of the shared TEXT fields: a field whose NAME
 * alias-matches a match field (as an input name would — "Soupeř", "Datum")
 * starts with that match value. Fields without a match stay absent, so their
 * bound inputs keep their own (prefilled / sample) texts.
 */
export function initSharedText(
  document: DocumentDTO,
  valueForName: (name: string) => string
): SharedTextValues {
  const values: SharedTextValues = {};
  for (const field of document.fields) {
    if (field.kind !== 'text' || field.bindings.length === 0) continue;
    const value = valueForName(field.name);
    if (value) values[field.id] = { value, hidden: false };
  }
  return values;
}

/** The valid inputs a shared TEXT field fills, in binding order. */
export function boundTextInputs(document: DocumentDTO, field: DocumentFieldDTO): TemplateInputDTO[] {
  const inputs: TemplateInputDTO[] = [];
  for (const binding of field.bindings) {
    const page = document.pages.find((p) => p.id === binding.pageId);
    const input = page?.variant.inputs.find((i) => i.id === binding.inputId);
    if (input) inputs.push(input);
  }
  return inputs;
}

/**
 * A shared TEXT field as a template input, so it fills with the ordinary
 * editor (match chips, rich text, font choice, hide), validates and builds
 * its render value like any input. Its offers are what EVERY bound input
 * allows: `richText` / `hidable` / `maxLength` from WBoost, the font faces
 * and colours intersected here. No list structure (a shared value is text +
 * runs). Null when no binding resolves to an input.
 */
export function sharedFieldInput(document: DocumentDTO, field: DocumentFieldDTO): TemplateInputDTO | null {
  const bound = boundTextInputs(document, field);
  const first = bound[0];
  if (!first) return null;
  const count = pagesOfField(field).length;

  return {
    ...first,
    id: field.id,
    name: field.name,
    description: `Propíše se na ${count} ${pagesWord(count)}. Prázdné = strany si ponechají svůj text.`,
    maxLength: field.maxLength,
    locked: false,
    uppercase: bound.every((input) => input.uppercase),
    hidable: field.hidable,
    frame: null,
    containerId: null,
    richText: field.richText,
    lists: false,
    listStyle: null,
    listCheckboxes: false,
    checklist: null,
    sampleValue: null,
    layerIndex: null,
    fontOptions: intersectFontOptions(bound),
    colorOptions: intersectColorOptions(bound),
  };
}

/** Faces every bound input offers (first input's order); null when any offers no choice. */
function intersectFontOptions(inputs: TemplateInputDTO[]): TemplateInputDTO['fontOptions'] {
  if (inputs.length === 0 || inputs.some((input) => input.fontOptions == null)) return null;
  const [first, ...rest] = inputs;
  const common = (first.fontOptions ?? []).filter((font) =>
    rest.every((input) => input.fontOptions?.some((other) => other.family === font.family))
  );
  return common.length > 0 ? common : null;
}

/** Colours every bound input allows: null = any (all unrestricted), [] = none in common. */
function intersectColorOptions(inputs: TemplateInputDTO[]): string[] | null {
  let allowed: string[] | null = null;
  for (const input of inputs) {
    if (input.colorOptions == null) continue;
    allowed = allowed === null ? [...input.colorOptions] : allowed.filter((c) => input.colorOptions?.includes(c));
  }
  return allowed;
}

/** The rich-text swatches / faces for the shared fields' editor (the first page that has them). */
export function documentRichTextOptions(document: DocumentDTO): RichTextOptionsDTO | null {
  return document.pages.find((page) => page.variant.richTextOptions != null)?.variant.richTextOptions ?? null;
}

/** Mirror every set shared text into its bound inputs ({@link applySharedText} for all). */
export function applySharedTexts(
  document: DocumentDTO,
  forms: PageForms,
  sharedText: SharedTextValues
): PageForms {
  let next = forms;
  for (const [fieldId, value] of Object.entries(sharedText)) {
    next = applySharedText(document, next, fieldId, value);
  }
  return next;
}

/**
 * Overlay a saved document fill onto the freshly-seeded one. Only pages,
 * inputs, slots, shapes and shared fields that still exist are taken (the
 * document may have changed in WBoost since the save) and every value is
 * shape-checked like a single-variant save. Saved shared texts win over the
 * seeded (match-prefilled) ones and are mirrored into their bound inputs.
 */
export function applySavedDocument(
  document: DocumentDTO,
  base: DocumentFillState,
  baseSharedText: SharedTextValues,
  saved: SavedDocumentState | null | undefined
): { fill: DocumentFillState; sharedText: SharedTextValues; restored: boolean } {
  if (!saved || typeof saved !== 'object' || typeof saved.pages !== 'object' || saved.pages === null) {
    return { fill: base, sharedText: baseSharedText, restored: false };
  }

  const forms: PageForms = { ...base.forms };
  const images: PageImages = { ...base.images };
  const shapeColors: PageShapeColors = { ...base.shapeColors };
  for (const page of document.pages) {
    const savedPage = saved.pages[page.id];
    if (!savedPage) continue;
    forms[page.id] = applySavedForm(page.variant.inputs, base.forms[page.id] ?? {}, savedPage.formState);
    images[page.id] = applySavedImages(page.variant.imageInputs, base.images[page.id] ?? {}, savedPage.imageState);
    shapeColors[page.id] = sanitizeShapeColors(page.variant.shapeInputs, savedPage.shapeColors);
  }

  const sharedText: SharedTextValues = { ...baseSharedText };
  for (const field of document.fields) {
    const raw = saved.sharedText?.[field.id];
    if (field.kind !== 'text' || raw == null) continue;
    const input = sharedFieldInput(document, field);
    if (!input) continue;
    // Older records hold a plain string; a state is shape-checked like any input's.
    const stored = typeof raw === 'string' ? { value: raw, hidden: false } : raw;
    const restored = applySavedForm([input], {}, { [field.id]: stored })[field.id];
    if (restored) sharedText[field.id] = restored;
  }

  return {
    fill: { forms: applySharedTexts(document, forms, sharedText), images, shapeColors },
    sharedText,
    restored: true,
  };
}

/** The persisted form of a document fill (see {@link applySavedDocument}). */
export function toSavedDocument(state: DocumentFillState, sharedText: SharedTextValues): SavedDocumentState {
  const pages: SavedDocumentState['pages'] = {};
  for (const pageId of Object.keys(state.forms)) {
    const colors = state.shapeColors[pageId] ?? {};
    pages[pageId] = {
      formState: state.forms[pageId] ?? {},
      imageState: state.images[pageId] ?? {},
      ...(Object.keys(colors).length > 0 ? { shapeColors: colors } : {}),
    };
  }
  return { pages, sharedText };
}

/** The shared field of `kind` bound to this page's input, or null. */
export function fieldForInput(
  document: DocumentDTO,
  pageId: string,
  inputId: string,
  kind: DocumentFieldDTO['kind']
): DocumentFieldDTO | null {
  return (
    document.fields.find(
      (field) =>
        field.kind === kind &&
        field.bindings.some((binding) => binding.pageId === pageId && binding.inputId === inputId)
    ) ?? null
  );
}

/** The shared field behind a page input / slot, as the editor panels show it. */
export interface SharedFieldRef {
  name: string;
  /** Text: the shared value may carry rich runs. */
  richText: boolean;
}

/** This page's inputs (or image slots) of `kind` that a shared field fills: inputId → field. */
export function sharedFieldsOf(
  document: DocumentDTO,
  pageId: string,
  kind: DocumentFieldDTO['kind']
): Record<string, SharedFieldRef> {
  const refs: Record<string, SharedFieldRef> = {};
  for (const field of document.fields) {
    if (field.kind !== kind) continue;
    for (const binding of field.bindings) {
      if (binding.pageId === pageId) refs[binding.inputId] = { name: field.name, richText: field.richText };
    }
  }
  return refs;
}

/** Pages a shared field fills (each at most once — WBoost allows one binding per page). */
export function pagesOfField(field: DocumentFieldDTO): string[] {
  return [...new Set(field.bindings.map((binding) => binding.pageId))];
}

/**
 * Mirror a shared TEXT value into every bound input: its text (and its rich
 * runs where both the field and the input are rich). WBoost replaces only
 * the TEXT of a bound input, so the page's own hide / font pick for it stay;
 * list structure is dropped (a shared value carries none).
 */
export function applySharedText(
  document: DocumentDTO,
  forms: PageForms,
  fieldId: string,
  shared: InputFieldState
): PageForms {
  const field = document.fields.find((f) => f.id === fieldId && f.kind === 'text');
  if (!field) return forms;

  const next: PageForms = { ...forms };
  for (const binding of field.bindings) {
    const page = document.pages.find((p) => p.id === binding.pageId);
    const input = page?.variant.inputs.find((i) => i.id === binding.inputId);
    if (!input) continue;

    const current = next[binding.pageId]?.[binding.inputId] ?? { value: '', hidden: false };
    const runs = field.richText && input.richText ? (shared.runs ?? null) : null;
    next[binding.pageId] = {
      ...(next[binding.pageId] ?? {}),
      [binding.inputId]: { ...current, value: shared.value, runs, lines: null },
    };
  }
  return next;
}

/**
 * Mirror a shared IMAGE pick into every bound slot. Each page keeps its own
 * visibility; a page that did not make the pick starts from the neutral
 * placement (its frame differs), the picking page keeps what it set.
 */
export function applySharedImage(
  document: DocumentDTO,
  images: PageImages,
  fieldId: string,
  image: ImageSlotState['image'],
  sourcePageId: string | null = null
): PageImages {
  const field = document.fields.find((f) => f.id === fieldId && f.kind === 'image');
  if (!field) return images;

  const next: PageImages = { ...images };
  for (const binding of field.bindings) {
    if (binding.pageId === sourcePageId) continue;
    const page = document.pages.find((p) => p.id === binding.pageId);
    if (!page?.variant.imageInputs.some((slot) => slot.id === binding.inputId)) continue;

    const current = next[binding.pageId]?.[binding.inputId] ?? defaultImageSlotState();
    next[binding.pageId] = {
      ...(next[binding.pageId] ?? {}),
      [binding.inputId]: { ...current, ...NEUTRAL_PLACEMENT, image },
    };
  }
  return next;
}

/**
 * The bound slot a shared IMAGE field's own picker lists and uploads through
 * (the gallery endpoints are per slot): an unrestricted one (`includesRoot` —
 * the whole project gallery) when there is one, else the first bound slot.
 * Null when no binding resolves to a slot.
 */
export function pickerSlotOf(
  document: DocumentDTO,
  field: DocumentFieldDTO
): { page: DocumentPageDTO; slot: ImageInputDTO } | null {
  let fallback: { page: DocumentPageDTO; slot: ImageInputDTO } | null = null;
  for (const binding of field.bindings) {
    const page = document.pages.find((p) => p.id === binding.pageId);
    const slot = page?.variant.imageInputs.find((s) => s.id === binding.inputId);
    if (!page || !slot) continue;
    if (slot.includesRoot) return { page, slot };
    fallback ??= { page, slot };
  }
  return fallback;
}

/** The shared image a field currently shows: the first bound slot that has a pick. */
export function sharedImageOf(
  field: DocumentFieldDTO,
  images: PageImages
): ImageSlotState['image'] {
  for (const binding of field.bindings) {
    const image = images[binding.pageId]?.[binding.inputId]?.image;
    if (image) return image;
  }
  return null;
}

/** One page's own fill (the single-variant render body of its variant). */
export function buildPageFill(
  page: DocumentPageDTO,
  form: Record<string, InputFieldState> | undefined,
  images: Record<string, ImageSlotState> | undefined,
  shapeColors: ShapeColorState | undefined
): DocumentPageFill {
  const fill: DocumentPageFill = {};
  const inputs = buildRenderInputs(page.variant.inputs, form ?? {});
  const pageImages = buildRenderImages(page.variant.imageInputs, images ?? {});
  const colors = sanitizeShapeColors(page.variant.shapeInputs, shapeColors);

  if (Object.keys(inputs).length > 0) fill.inputs = inputs;
  if (Object.keys(pageImages).length > 0) fill.images = pageImages;
  if (Object.keys(colors).length > 0) fill.shapeColors = colors;
  return fill;
}

/**
 * The body WBoost renders: the touched shared texts (built like an input's
 * value — rich runs, field-wide hide / font) + the shared image picks as
 * `fields`, and each page's own fill under its page id (incl. its per-page
 * hide / font of bound inputs). `pageIds` limits `pages` (a preview needs
 * only its own page's entry). An empty, visible shared text is NOT sent —
 * like an empty page input, the bound inputs then keep their own text.
 */
export function buildDocumentFillBody(
  document: DocumentDTO,
  state: DocumentFillState,
  sharedText: SharedTextValues,
  pageIds?: readonly string[]
): DocumentFillBody {
  const fields: Record<string, DocumentFieldValue> = {};

  for (const field of document.fields) {
    if (field.bindings.length === 0) continue;
    if (field.kind === 'text') {
      const state = sharedText[field.id];
      const input = state ? sharedFieldInput(document, field) : null;
      const value = input && state ? buildRenderInputs([input], { [field.id]: state })[field.id] : undefined;
      if (value !== undefined) fields[field.id] = value;
    } else if (field.allowedDirectoryIds?.length !== 0) {
      // [] = no picture passes every bound slot: each page sends its own pick.
      const image = sharedImageOf(field, state.images);
      if (image) fields[field.id] = image.id;
    }
  }

  const pages: Record<string, DocumentPageFill> = {};
  for (const page of document.pages) {
    if (pageIds && !pageIds.includes(page.id)) continue;
    pages[page.id] = buildPageFill(
      page,
      state.forms[page.id],
      state.images[page.id],
      state.shapeColors[page.id]
    );
  }

  return { fields, pages };
}

/**
 * Which page previews to start now. Two lanes, so at most two renders run at
 * once and the page being edited never queues behind the others:
 *  - the ACTIVE lane renders the active page whenever it is stale;
 *  - the BACKGROUND lane renders one stale page whose thumbnail is visible,
 *    in page order — only once the active page is up to date (or cannot
 *    render), so opening a document shows the page being edited first.
 * `blocked` = pages that must not auto-render now (invalid values, or their
 * last render failed and nothing changed since). A page already rendering
 * is never started twice.
 */
export function nextPreviewRenders(state: {
  pageIds: readonly string[];
  activeId: string;
  dirty: ReadonlySet<string>;
  rendering: ReadonlySet<string>;
  blocked: ReadonlySet<string>;
  visible: ReadonlySet<string>;
  activeLaneBusy: boolean;
  backgroundLaneBusy: boolean;
}): { active: string | null; background: string | null } {
  const { activeId, dirty, rendering, blocked } = state;
  const startable = (id: string) => dirty.has(id) && !rendering.has(id) && !blocked.has(id);

  const active = !state.activeLaneBusy && startable(activeId) ? activeId : null;
  const activePending = dirty.has(activeId) && !blocked.has(activeId);
  const background =
    state.backgroundLaneBusy || activePending
      ? null
      : (state.pageIds.find((id) => id !== activeId && state.visible.has(id) && startable(id)) ?? null);

  return { active, background };
}

/** Label of a page in lists / the page strip: "2. Ceník". */
export function pageLabel(page: DocumentPageDTO, index: number): string {
  return `${index + 1}. ${page.templateName}`;
}

/** Czech plural of "strana": 1 strana, 2–4 strany, 0 / 5+ stran. */
export function pagesWord(count: number): string {
  if (count === 1) return 'strana';
  if (count >= 2 && count <= 4) return 'strany';
  return 'stran';
}
