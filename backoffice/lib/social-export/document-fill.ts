/**
 * Multi-page DOCUMENT fill — pure state helpers (client-safe).
 *
 * A document is filled PAGE BY PAGE: every page keeps its own form / image /
 * shape state keyed by its page id, and inside a page by the variant's own
 * input ids. Two pages may carry the SAME input id (a duplicated template) —
 * their values never mix, because the state is always looked up per page.
 *
 * Only SHARED FIELDS join pages: one value is sent once as `fields[fieldId]`
 * and WBoost writes it into the bound input of every page (it WINS over the
 * page's own value). To keep the click-into-preview editor truthful, the
 * shared value is also mirrored into the bound inputs' page state, and an
 * edit of a bound input on any page updates the shared value.
 */

import type {
  DocumentDTO,
  DocumentFieldDTO,
  DocumentFillBody,
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
/** Shared TEXT field id → value. Absent = never touched (pages keep their own values). */
export type SharedTextValues = Record<string, string>;

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
    if (value) values[field.id] = value;
  }
  return values;
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
    const value = saved.sharedText?.[field.id];
    if (field.kind === 'text' && field.bindings.length > 0 && typeof value === 'string') {
      sharedText[field.id] = value;
    }
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

/** Pages a shared field fills (each at most once — WBoost allows one binding per page). */
export function pagesOfField(field: DocumentFieldDTO): string[] {
  return [...new Set(field.bindings.map((binding) => binding.pageId))];
}

/**
 * Mirror a shared TEXT value into every bound input. The shared value is a
 * plain string that replaces the page value wholesale on the server, so any
 * page-level formatting / list structure / font pick of a bound input is
 * dropped here too (the editor shows what will render).
 */
export function applySharedText(
  document: DocumentDTO,
  forms: PageForms,
  fieldId: string,
  value: string
): PageForms {
  const field = document.fields.find((f) => f.id === fieldId && f.kind === 'text');
  if (!field) return forms;

  const next: PageForms = { ...forms };
  for (const binding of field.bindings) {
    const page = document.pages.find((p) => p.id === binding.pageId);
    if (!page?.variant.inputs.some((input) => input.id === binding.inputId)) continue;

    const current = next[binding.pageId]?.[binding.inputId] ?? { value: '', hidden: false };
    next[binding.pageId] = {
      ...(next[binding.pageId] ?? {}),
      [binding.inputId]: { ...current, value, runs: null, lines: null, fontFamily: null },
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
 * The body WBoost renders: the touched, non-empty shared texts + the shared
 * image picks as `fields`, and each page's own fill under its page id.
 * `pageIds` limits `pages` (a preview needs only its own page's entry).
 * An empty shared text is NOT sent — like an empty page input, the bound
 * inputs then keep their own value / sample text.
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
      const value = sharedText[field.id];
      if (value !== undefined && value !== '') fields[field.id] = value;
    } else {
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
