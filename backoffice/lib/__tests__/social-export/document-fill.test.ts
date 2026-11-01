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
  applySharedTexts,
  buildDocumentFillBody,
  fieldForInput,
  initDocumentFill,
  initSharedText,
  pagesOfField,
  pagesWord,
  sharedImageOf,
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

  it('mirrors the value into every bound input and drops page formatting', () => {
    const state = initDocumentFill(doc, emptyPrefill);
    state.forms['p-a'].name = {
      value: 'Old',
      hidden: false,
      runs: [{ text: 'Old', fontFamily: null, color: '#ff0000', underline: false }],
      fontFamily: 'Rubik',
    };

    const forms = applySharedText(doc, state.forms, 'f-name', 'Lucie Svobodová');

    expect(forms['p-a'].name).toMatchObject({ value: 'Lucie Svobodová', runs: null, fontFamily: null });
    expect(forms['p-b'].name.value).toBe('Lucie Svobodová');
    // Unbound inputs with the same structure stay untouched.
    expect(forms['p-a']['txt-1'].value).toBe('');
    expect(forms['p-c']).toBe(state.forms['p-c']);
  });

  it('sends a touched, non-empty shared value as `fields`; an empty one not at all', () => {
    const state = initDocumentFill(doc, emptyPrefill);

    expect(buildDocumentFillBody(doc, state, { 'f-name': 'Lucie' }).fields).toEqual({ 'f-name': 'Lucie' });
    expect(buildDocumentFillBody(doc, state, { 'f-name': '' }).fields).toEqual({});
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
    expect(shared).toEqual({ 'f-name': 'FK Fotbal FM' });
  });

  it('applySharedTexts mirrors every set value into the bound inputs only', () => {
    const state = initDocumentFill(doc, emptyPrefill);
    const forms = applySharedTexts(doc, state.forms, { 'f-name': 'Lucie' });
    expect(forms['p-a'].name.value).toBe('Lucie');
    expect(forms['p-b'].name.value).toBe('Lucie');
    expect(forms['p-a']['txt-1'].value).toBe(state.forms['p-a']['txt-1'].value);
  });
});
