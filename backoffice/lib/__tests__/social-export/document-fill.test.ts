import { describe, expect, it } from 'vitest';
import type {
  DocumentDTO,
  DocumentPageDTO,
  ImageInputDTO,
  TemplateInputDTO,
  TemplateVariantDTO,
} from '@/lib/social-export/api-types';
import {
  applySharedImage,
  applySharedText,
  applySharedShape,
  applySharedTexts,
  applySavedDocument,
  boundInputView,
  boundShapeView,
  sharedShapeOptions,
  buildDocumentFillBody,
  documentFillFromVersion,
  fieldForInput,
  initDocumentFill,
  initSharedText,
  nextPreviewRenders,
  pagesOfField,
  pagesWord,
  pickerSlotOf,
  sharedFieldInput,
  sharedFieldsOf,
  sharedImageOf,
  toSavedDocument,
} from '@/lib/social-export/document-fill';

// ---------- Helpers ----------------------------------------------------------

function makeInput(overrides: Partial<TemplateInputDTO> = {}): TemplateInputDTO {
  return {
    id: 'txt-1',
    name: 'Nadpis',
    maxLength: null,
    locked: false,
    uppercase: false,
    description: null,
    hidable: true,
    frame: { x: 0, y: 0, width: 100, height: 40 },
    containerId: null,
    textStyle: null,
    richText: false,
    lists: false,
    listStyle: null,
    listCheckboxes: false,
    checklist: null,
    sampleValue: null,
    layerIndex: null,
    fontOptions: null,
    colorOptions: null,
    ...overrides,
  };
}

function makeSlot(overrides: Partial<ImageInputDTO> = {}): ImageInputDTO {
  return {
    id: 'img-1',
    name: 'Foto',
    description: null,
    allowMove: true,
    allowResize: true,
    allowRotate: false,
    hidable: true,
    directories: [],
    includesRoot: true,
    frame: { x: 0, y: 0, width: 400, height: 300 },
    defaultImageUrl: null,
    layerIndex: null,
    isBackground: false,
    ...overrides,
  };
}

function makeVariant(id: string, overrides: Partial<TemplateVariantDTO> = {}): TemplateVariantDTO {
  return {
    id,
    dimension: '210 × 297 mm',
    width: 2480,
    height: 3508,
    preset: null,
    thumbnailUrl: null,
    hasDefaultPreview: false,
    inputs: [makeInput()],
    imageInputs: [makeSlot()],
    shapeInputs: [],
    containers: [],
    richTextOptions: null,
    groupMember: false,
    ...overrides,
  };
}

function makePage(id: string, position: number, variant: TemplateVariantDTO): DocumentPageDTO {
  return { id, position, templateId: `t-${id}`, templateName: `Strana ${id}`, variant };
}

// Two pages from a DUPLICATED template: the same input + slot ids on both.
const pageA = makePage('p-a', 0, makeVariant('v-a', { inputs: [makeInput(), makeInput({ id: 'name', name: 'Jméno' })] }));
const pageB = makePage('p-b', 1, makeVariant('v-b', { inputs: [makeInput(), makeInput({ id: 'name', name: 'Jméno' })] }));
const pageC = makePage('p-c', 2, makeVariant('v-c', { inputs: [makeInput({ id: 'other' })], imageInputs: [] }));

const doc: DocumentDTO = {
  id: 'doc-1',
  name: 'Nabídka',
  position: 0,
  categoryId: null,
  categoryName: null,
  dimension: '210 × 297 mm',
  width: 2480,
  height: 3508,
  printFormat: true,
  pages: [pageA, pageB, pageC],
  fields: [
    {
      id: 'f-name',
      name: 'Jméno klienta',
      kind: 'text',
      bindings: [
        { pageId: 'p-a', inputId: 'name' },
        { pageId: 'p-b', inputId: 'name' },
      ],
      maxLength: 40,
      richText: false,
      textMode: 'plain',
      hidable: true,
      allowedDirectoryIds: null,
    },
    {
      id: 'f-photo',
      name: 'Fotka',
      kind: 'image',
      bindings: [
        { pageId: 'p-a', inputId: 'img-1' },
        { pageId: 'p-b', inputId: 'img-1' },
      ],
      maxLength: null,
      richText: false,
      textMode: 'plain',
      hidable: true,
      allowedDirectoryIds: null,
    },
  ],
};

const emptyPrefill = () => ({});

// ---------- Tests ------------------------------------------------------------

describe('initDocumentFill', () => {
  it('seeds every page separately, with the prefill computed for that page', () => {
    const state = initDocumentFill(doc, (page): Record<string, string> => (page.id === 'p-b' ? { 'txt-1': 'Jen B' } : {}));

    expect(Object.keys(state.forms)).toEqual(['p-a', 'p-b', 'p-c']);
    expect(state.forms['p-a']['txt-1'].value).toBe('');
    expect(state.forms['p-b']['txt-1'].value).toBe('Jen B');
    expect(state.images['p-a']['img-1'].image).toBeNull();
    expect(state.images['p-c']).toEqual({});
  });
});

describe('page values never share implicitly', () => {
  it('two pages with the SAME input id keep their own values in the body', () => {
    const state = initDocumentFill(doc, emptyPrefill);
    state.forms['p-a']['txt-1'] = { value: 'Úvod', hidden: false };
    state.forms['p-b']['txt-1'] = { value: 'Ceník', hidden: false };

    const body = buildDocumentFillBody(doc, state, {});

    expect(body.pages['p-a'].inputs).toEqual({ 'txt-1': 'Úvod' });
    expect(body.pages['p-b'].inputs).toEqual({ 'txt-1': 'Ceník' });
    expect(body.pages['p-c']).toEqual({});
    expect(body.fields).toEqual({});
  });

  it('limits `pages` to the requested page ids (a preview sends only its page)', () => {
    const body = buildDocumentFillBody(doc, initDocumentFill(doc, emptyPrefill), {}, ['p-b']);
    expect(Object.keys(body.pages)).toEqual(['p-b']);
  });
});

describe('shared text fields', () => {
  it('finds the field bound to a page input — per page, per kind', () => {
    expect(fieldForInput(doc, 'p-a', 'name', 'text')?.id).toBe('f-name');
    expect(fieldForInput(doc, 'p-c', 'name', 'text')).toBeNull();
    expect(fieldForInput(doc, 'p-a', 'txt-1', 'text')).toBeNull();
    expect(fieldForInput(doc, 'p-a', 'img-1', 'image')?.id).toBe('f-photo');
    expect(pagesOfField(doc.fields[0])).toEqual(['p-a', 'p-b']);
  });

  it('mirrors the TEXT into every bound input; the page keeps its own hide / font', () => {
    const state = initDocumentFill(doc, emptyPrefill);
    state.forms['p-a'].name = {
      value: 'Old',
      hidden: false,
      runs: [{ text: 'Old', fontFamily: null, color: '#ff0000', underline: false }],
      fontFamily: 'Rubik',
    };
    state.forms['p-b'].name = { value: 'B', hidden: true };

    const forms = applySharedText(doc, state.forms, 'f-name', { value: 'Lucie Svobodová', hidden: false });

    expect(forms['p-a'].name).toMatchObject({ value: 'Lucie Svobodová', runs: null, fontFamily: 'Rubik' });
    expect(forms['p-b'].name).toMatchObject({ value: 'Lucie Svobodová', hidden: true });
    expect(forms['p-b'].name.value).toBe('Lucie Svobodová');
    // Unbound inputs with the same structure stay untouched.
    expect(forms['p-a']['txt-1'].value).toBe('');
    expect(forms['p-c']).toBe(state.forms['p-c']);
  });

  it('sends a touched, non-empty shared value as `fields`; an empty one not at all', () => {
    const state = initDocumentFill(doc, emptyPrefill);

    expect(buildDocumentFillBody(doc, state, { 'f-name': { value: 'Lucie', hidden: false } }).fields).toEqual({
      'f-name': 'Lucie',
    });
    expect(buildDocumentFillBody(doc, state, { 'f-name': { value: '', hidden: false } }).fields).toEqual({});
  });

  it('a field-wide hide rides the field value; a page-level hide of a bound input its page entry', () => {
    const state = initDocumentFill(doc, emptyPrefill);
    state.forms['p-b'].name = { value: 'Lucie', hidden: true };

    const body = buildDocumentFillBody(doc, state, { 'f-name': { value: '', hidden: true } });
    expect(body.fields).toEqual({ 'f-name': { hide: true } });
    expect(body.pages['p-b'].inputs?.name).toEqual({ value: 'Lucie', hide: true });
  });

  it('a rich field mirrors its runs into rich bound inputs and sends them as the field value', () => {
    const rich = makeInput({ id: 'name', name: 'Jméno', richText: true });
    const docRich: DocumentDTO = {
      ...doc,
      pages: [
        makePage('p-a', 0, makeVariant('v-a', { inputs: [rich] })),
        makePage('p-b', 1, makeVariant('v-b', { inputs: [rich] })),
      ],
      fields: [{ ...doc.fields[0], richText: true, textMode: 'rich' }],
    };
    const runs = [{ text: 'Lucie', fontFamily: null, color: '#ff0000', underline: false }];
    const state = initDocumentFill(docRich, emptyPrefill);
    const forms = applySharedText(docRich, state.forms, 'f-name', { value: 'Lucie', hidden: false, runs });
    expect(forms['p-b'].name.runs).toEqual(runs);

    const body = buildDocumentFillBody(docRich, state, { 'f-name': { value: 'Lucie', hidden: false, runs } });
    expect(body.fields).toEqual({ 'f-name': { runs } });
  });
});

describe('shared image fields', () => {
  it('mirrors a pick to the other bound slots with a neutral placement', () => {
    const state = initDocumentFill(doc, emptyPrefill);
    state.images['p-a']['img-1'] = {
      ...state.images['p-a']['img-1'],
      image: { id: 'gal-1', url: 'http://store/1.jpg' },
      scale: 2,
    };
    state.images['p-b']['img-1'] = { ...state.images['p-b']['img-1'], scale: 3, hidden: true };

    const images = applySharedImage(doc, state.images, 'f-photo', { id: 'gal-1', url: 'http://store/1.jpg' }, 'p-a');

    // The picking page keeps its own placement.
    expect(images['p-a']['img-1'].scale).toBe(2);
    // The other page takes the picture, resets placement, keeps its visibility.
    expect(images['p-b']['img-1']).toMatchObject({ image: { id: 'gal-1' }, scale: 1, hidden: true });

    const field = doc.fields[1];
    expect(sharedImageOf(field, images)?.id).toBe('gal-1');

    const body = buildDocumentFillBody(doc, { ...state, images }, {});
    expect(body.fields).toEqual({ 'f-photo': 'gal-1' });
    expect(body.pages['p-a'].images).toEqual({ 'img-1': { imageId: 'gal-1', scale: 2 } });
    expect(body.pages['p-b'].images).toEqual({ 'img-1': { hide: true } });
  });
});

describe('pagesWord', () => {
  it('declines "strana"', () => {
    expect([0, 1, 2, 4, 5, 30].map(pagesWord)).toEqual(['stran', 'strana', 'strany', 'strany', 'stran', 'stran']);
  });
});

describe('initSharedText', () => {
  it('starts a text field whose name matches with that value, image fields and misses stay absent', () => {
    const shared = initSharedText(doc, (name) => (name === 'Jméno klienta' ? 'FK Fotbal FM' : name === 'Fotka' ? 'x' : ''));
    expect(shared).toEqual({ 'f-name': { value: 'FK Fotbal FM', hidden: false } });
  });

  it('applySharedTexts mirrors every set value into the bound inputs only', () => {
    const state = initDocumentFill(doc, emptyPrefill);
    const forms = applySharedTexts(doc, state.forms, { 'f-name': { value: 'Lucie', hidden: false } });
    expect(forms['p-a'].name.value).toBe('Lucie');
    expect(forms['p-b'].name.value).toBe('Lucie');
    expect(forms['p-a']['txt-1'].value).toBe(state.forms['p-a']['txt-1'].value);
  });
});

describe('applySavedDocument / toSavedDocument', () => {
  const picked = { id: 'img-9', url: 'https://x/9.jpg' };

  function edited() {
    const state = initDocumentFill(doc, emptyPrefill);
    state.forms['p-a']['txt-1'] = { value: 'Jen A', hidden: true };
    state.forms['p-c'].other = { value: 'Céčko', hidden: false };
    state.images = applySharedImage(doc, state.images, 'f-photo', picked);
    return state;
  }

  it('round-trips a fill: per-page values stay per page, shared texts win and are mirrored', () => {
    const saved = toSavedDocument(edited(), { 'f-name': { value: 'Lucie', hidden: false } });
    const restored = applySavedDocument(doc, initDocumentFill(doc, emptyPrefill), { 'f-name': { value: 'Prefill', hidden: false } }, saved);

    expect(restored.restored).toBe(true);
    expect(restored.sharedText).toEqual({ 'f-name': { value: 'Lucie', hidden: false } });
    expect(restored.fill.forms['p-a']['txt-1']).toEqual({ value: 'Jen A', hidden: true });
    expect(restored.fill.forms['p-b']['txt-1'].value).toBe('');
    expect(restored.fill.forms['p-c'].other.value).toBe('Céčko');
    expect(restored.fill.forms['p-a'].name.value).toBe('Lucie');
    expect(restored.fill.forms['p-b'].name.value).toBe('Lucie');
    expect(restored.fill.images['p-b']['img-1'].image).toEqual(picked);
  });

  it('keeps the seed for a missing record and drops pages / fields that no longer exist', () => {
    const base = initDocumentFill(doc, emptyPrefill);
    expect(applySavedDocument(doc, base, { 'f-name': { value: 'P', hidden: false } }, undefined)).toEqual({
      fill: base,
      sharedText: { 'f-name': { value: 'P', hidden: false } },
      restored: false,
    });

    const restored = applySavedDocument(doc, base, {}, {
      pages: { gone: { formState: { x: { value: 'Y', hidden: false } }, imageState: {} } },
      sharedText: { 'f-gone': 'Z', 'f-photo': 'not-a-text-field' },
    });
    expect(restored.restored).toBe(true);
    expect(restored.sharedText).toEqual({});
    expect(Object.keys(restored.fill.forms)).toEqual(['p-a', 'p-b', 'p-c']);
  });
});

describe('nextPreviewRenders', () => {
  const ids = ['p1', 'p2', 'p3', 'p4'];
  const base = {
    pageIds: ids,
    activeId: 'p3',
    dirty: new Set(ids),
    rendering: new Set<string>(),
    blocked: new Set<string>(),
    visible: new Set(['p1', 'p2', 'p3']),
    activeLaneBusy: false,
    backgroundLaneBusy: false,
  };

  it('renders the stale active page first and holds the others back until it is done', () => {
    expect(nextPreviewRenders(base)).toEqual({ active: 'p3', background: null });
    expect(nextPreviewRenders({ ...base, rendering: new Set(['p3']), activeLaneBusy: true })).toEqual({
      active: null,
      background: null,
    });
  });

  it('then renders visible stale thumbnails one at a time, in page order, never off-screen ones', () => {
    const dirty = new Set(['p2', 'p4', 'p1']);
    expect(nextPreviewRenders({ ...base, dirty })).toEqual({ active: null, background: 'p1' });
    expect(
      nextPreviewRenders({ ...base, dirty, rendering: new Set(['p1']), backgroundLaneBusy: true })
    ).toEqual({ active: null, background: null });
    expect(nextPreviewRenders({ ...base, dirty: new Set(['p4']) })).toEqual({ active: null, background: null });
  });

  it('never blocks the active page behind a background render', () => {
    const state = { ...base, rendering: new Set(['p1']), backgroundLaneBusy: true };
    expect(nextPreviewRenders(state)).toEqual({ active: 'p3', background: null });
  });

  it('skips blocked pages; a blocked active page lets the background lane go', () => {
    expect(nextPreviewRenders({ ...base, blocked: new Set(['p3', 'p1']) })).toEqual({ active: null, background: 'p2' });
  });

  it('does not start a page twice when it becomes active mid-render', () => {
    const state = { ...base, activeId: 'p1', rendering: new Set(['p1']), backgroundLaneBusy: true };
    expect(nextPreviewRenders(state)).toEqual({ active: null, background: null });
  });
});

describe('pickerSlotOf', () => {
  const field = doc.fields[1];

  it('prefers an unrestricted bound slot (the whole gallery), else the first bound slot', () => {
    const restricted = makeSlot({ includesRoot: false, directories: [{ id: 'd1', name: 'Hráči' }] });
    const docMixed: DocumentDTO = {
      ...doc,
      pages: [
        makePage('p-a', 0, makeVariant('v-a', { imageInputs: [restricted] })),
        makePage('p-b', 1, makeVariant('v-b')),
        pageC,
      ],
    };
    expect(pickerSlotOf(docMixed, field)).toMatchObject({ page: { id: 'p-b' }, slot: { id: 'img-1' } });

    const allRestricted: DocumentDTO = {
      ...docMixed,
      pages: [docMixed.pages[0], makePage('p-b', 1, makeVariant('v-b', { imageInputs: [restricted] })), pageC],
    };
    expect(pickerSlotOf(allRestricted, field)?.page.id).toBe('p-a');
  });

  it('is null when no binding resolves to a slot', () => {
    expect(pickerSlotOf({ ...doc, pages: [pageC] }, field)).toBeNull();
  });
});

describe('sharedFieldsOf', () => {
  it('names the shared field behind each bound input / slot of one page', () => {
    expect(sharedFieldsOf(doc, 'p-b', 'text')).toEqual({ name: { name: 'Jméno klienta', richText: false, textMode: 'plain' } });
    expect(sharedFieldsOf(doc, 'p-b', 'image')).toEqual({ 'img-1': { name: 'Fotka', richText: false, textMode: 'plain' } });
    expect(sharedFieldsOf(doc, 'p-c', 'text')).toEqual({});
  });
});

describe('sharedFieldInput', () => {
  it('offers what every bound input allows: fonts and colours intersected, no lists', () => {
    const fontA = { family: 'A', url: '/a', fontName: 'A', faceName: 'A', weight: 400, style: 'normal' };
    const fontB = { family: 'B', url: '/b', fontName: 'B', faceName: 'B', weight: 400, style: 'normal' };
    const d: DocumentDTO = {
      ...doc,
      pages: [
        makePage('p-a', 0, makeVariant('v-a', { inputs: [makeInput({ id: 'name', fontOptions: [fontA, fontB], colorOptions: ['#000000', '#ffffff'], lists: true })] })),
        makePage('p-b', 1, makeVariant('v-b', { inputs: [makeInput({ id: 'name', fontOptions: [fontB], colorOptions: null })] })),
      ],
    };
    const input = sharedFieldInput(d, d.fields[0]);
    expect(input).toMatchObject({ id: 'f-name', name: 'Jméno klienta', maxLength: 40, hidable: true, lists: false, frame: null });
    expect(input?.fontOptions?.map((f) => f.family)).toEqual(['B']);
    expect(input?.colorOptions).toEqual(['#000000', '#ffffff']);
  });

  it('restores an older saved plain-string shared value', () => {
    const restored = applySavedDocument(doc, initDocumentFill(doc, emptyPrefill), {}, { pages: {}, sharedText: { 'f-name': 'Old' } });
    expect(restored.sharedText['f-name']).toEqual({ value: 'Old', hidden: false });
  });
});

describe('shared image field without a common folder', () => {
  it('is not sent as a field value — every page sends its own pick', () => {
    const d: DocumentDTO = { ...doc, fields: [doc.fields[0], { ...doc.fields[1], allowedDirectoryIds: [] }] };
    const state = initDocumentFill(d, emptyPrefill);
    state.images['p-a']['img-1'] = { ...state.images['p-a']['img-1'], image: { id: 'gal-1', url: 'u' } };
    const body = buildDocumentFillBody(d, state, {});
    expect(body.fields).toEqual({});
    expect(body.pages['p-a'].images).toEqual({ 'img-1': 'gal-1' });
  });
});

describe('documentFillFromVersion', () => {
  it('loads every page like a variant version and the shared texts from `fields`', () => {
    const loaded = documentFillFromVersion(doc, {
      fields: { 'f-name': { value: 'Lucie', hide: true }, 'f-photo': { imageId: 'gal-1', url: 'u1' }, 'f-gone': 'x' },
      pages: {
        'p-a': {
          inputs: { name: 'Lucie', 'txt-1': { hide: true } },
          images: { 'img-1': { imageId: 'gal-1', url: 'u1', scale: 2 } },
          shapeColors: {},
        },
        'p-b': { inputs: { name: 'Lucie' }, images: { 'img-1': { imageId: 'gal-1', url: 'u1' } }, shapeColors: {} },
        'p-gone': { inputs: {}, images: {}, shapeColors: {} },
      },
    });

    expect(loaded.sharedText).toEqual({ 'f-name': { value: 'Lucie', hidden: true } });
    expect(loaded.fill.forms['p-a'].name.value).toBe('Lucie');
    expect(loaded.fill.forms['p-a']['txt-1'].hidden).toBe(true);
    expect(loaded.fill.images['p-a']['img-1']).toMatchObject({ image: { id: 'gal-1', url: 'u1' }, scale: 2 });
    expect(sharedImageOf(doc.fields[1], loaded.fill.images)?.id).toBe('gal-1');
    // A page missing from the version starts from its design.
    expect(loaded.fill.forms['p-c'].other.value).toBe('');
    expect(Object.keys(loaded.fill.forms)).toEqual(['p-a', 'p-b', 'p-c']);
  });
});

describe('shared text field modes', () => {
  const listInput = makeInput({ id: 'name', richText: true, lists: true, listCheckboxes: true, listStyle: null });
  const listDoc = (mode: DocumentDTO['fields'][number]['textMode'], other = listInput): DocumentDTO => ({
    ...doc,
    pages: [
      makePage('p-a', 0, makeVariant('v-a', { inputs: [listInput] })),
      makePage('p-b', 1, makeVariant('v-b', { inputs: [other] })),
    ],
    fields: [{ ...doc.fields[0], richText: mode === 'rich' || mode === 'list', textMode: mode }],
  });

  it('list mode: the field edits with lists, mirrors and sends its lines', () => {
    const d = listDoc('list', makeInput({ id: 'name', richText: true, lists: true, listCheckboxes: false }));
    const input = sharedFieldInput(d, d.fields[0]);
    expect(input).toMatchObject({ richText: true, lists: true, listCheckboxes: false, checklist: null });

    const shared = { value: 'A\nB', hidden: false, lines: ['ul', 'ul'] as ('ul')[] };
    const state = initDocumentFill(d, emptyPrefill);
    const forms = applySharedText(d, state.forms, 'f-name', shared);
    expect(forms['p-b'].name.lines).toEqual(['ul', 'ul']);

    const body = buildDocumentFillBody(d, state, { 'f-name': shared });
    expect(body.fields['f-name']).toMatchObject({ lines: ['ul', 'ul'] });
  });

  it('plain / rich modes carry no lines; a bound input edits only what its field carries', () => {
    const d = listDoc('rich');
    expect(sharedFieldInput(d, d.fields[0])).toMatchObject({ richText: true, lists: false });
    const forms = applySharedText(d, initDocumentFill(d, emptyPrefill).forms, 'f-name', {
      value: 'A',
      hidden: false,
      lines: ['ul'],
    });
    expect(forms['p-a'].name.lines).toBeNull();

    expect(boundInputView(listInput, { name: 'x', richText: false, textMode: 'plain' })).toMatchObject({
      richText: false,
      lists: false,
      checklist: null,
    });
    expect(boundInputView(listInput, { name: 'x', richText: true, textMode: 'list' })).toMatchObject({
      richText: true,
      lists: true,
    });
    expect(boundInputView(listInput, null)).toBe(listInput);
  });

  it('checklist mode takes the bound checklist capabilities', () => {
    const checklist = { toggle: true, editText: false, addItems: false, removeItems: false };
    const cl = makeInput({ id: 'name', richText: true, lists: true, listCheckboxes: true, checklist });
    const d = listDoc('checklist', cl);
    d.pages[0] = makePage('p-a', 0, makeVariant('v-a', { inputs: [cl] }));
    expect(sharedFieldInput(d, d.fields[0])).toMatchObject({ checklist, lists: true, listCheckboxes: true });
  });
});

describe('shared shape fields', () => {
  const shape = (id: string, over: Partial<DocumentDTO['pages'][number]['variant']['shapeInputs'][number]> = {}) => ({
    id,
    name: 'Pruh',
    target: 'fill' as const,
    defaultColor: '#111111',
    colorOptions: ['#111111', '#ff0000', '#00ff00'],
    freeColor: false,
    frame: null,
    layerIndex: null,
    ...over,
  });
  const d: DocumentDTO = {
    ...doc,
    pages: [
      makePage('p-a', 0, makeVariant('v-a', { shapeInputs: [shape('sh')] })),
      makePage('p-b', 1, makeVariant('v-b', { shapeInputs: [shape('sh', { defaultColor: '#222222', colorOptions: ['#222222', '#ff0000'] })] })),
      makePage('p-c', 2, makeVariant('v-c', { shapeInputs: [shape('sh')] })),
    ],
    fields: [
      {
        id: 'f-shape',
        name: 'Barva pruhu',
        kind: 'shape',
        bindings: [
          { pageId: 'p-a', inputId: 'sh' },
          { pageId: 'p-b', inputId: 'sh' },
        ],
        maxLength: null,
        richText: false,
        textMode: 'plain',
        hidable: false,
        allowedDirectoryIds: null,
      },
    ],
  };
  const field = d.fields[0];

  it('offers the colours every bound shape accepts; free only when all are free', () => {
    expect(sharedShapeOptions(d, field)).toEqual({ colors: ['#ff0000'], free: false });
    const ref = sharedFieldsOf(d, 'p-b', 'shape').sh;
    expect(ref.shapeOptions).toEqual({ colors: ['#ff0000'], free: false });
    expect(boundShapeView(d.pages[1].variant.shapeInputs[0], ref).colorOptions).toEqual(['#222222', '#ff0000']);
  });

  it('mirrors a pick into the bound pages only, sends it as the field value, and clears back to the designs', () => {
    let state = initDocumentFill(d, emptyPrefill);
    state.shapeColors['p-c'] = { sh: '#00ff00' };
    state = applySharedShape(d, state, 'f-shape', '#ff0000');
    expect(state.shapeColors['p-a']).toEqual({ sh: '#ff0000' });
    expect(state.shapeColors['p-b']).toEqual({ sh: '#ff0000' });
    expect(state.shapeColors['p-c']).toEqual({ sh: '#00ff00' });
    expect(buildDocumentFillBody(d, state, {}).fields).toEqual({ 'f-shape': '#ff0000' });

    state = applySharedShape(d, state, 'f-shape', null);
    expect(state.shapeColors['p-a']).toEqual({});
    expect(buildDocumentFillBody(d, state, {}).fields).toEqual({});
  });

  it('survives autosave and loads from a history version; disallowed colours are dropped', () => {
    const state = applySharedShape(d, initDocumentFill(d, emptyPrefill), 'f-shape', '#ff0000');
    const restored = applySavedDocument(d, initDocumentFill(d, emptyPrefill), {}, toSavedDocument(state, {}));
    expect(restored.fill.sharedShapes).toEqual({ 'f-shape': '#ff0000' });
    expect(restored.fill.shapeColors['p-b']).toEqual({ sh: '#ff0000' });

    const bad = applySavedDocument(d, initDocumentFill(d, emptyPrefill), {}, { pages: {}, sharedText: {}, sharedShapes: { 'f-shape': '#00ff00' } });
    expect(bad.fill.sharedShapes).toEqual({});

    const loaded = documentFillFromVersion(d, {
      fields: { 'f-shape': '#FF0000' },
      pages: { 'p-a': { inputs: {}, images: {}, shapeColors: { sh: '#ff0000' } } },
    });
    expect(loaded.fill.sharedShapes).toEqual({ 'f-shape': '#ff0000' });
    expect(loaded.fill.shapeColors['p-b']).toEqual({ sh: '#ff0000' });
  });
});
