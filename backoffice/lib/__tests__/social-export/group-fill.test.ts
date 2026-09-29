import { describe, expect, it } from 'vitest';
import type {
  ImageInputDTO,
  TemplateInputDTO,
  TemplateVariantDTO,
} from '@/lib/social-export/api-types';
import { defaultImageSlotState } from '@/lib/social-export/field-rules-image';
import {
  applyImageChange,
  buildGroupRenderBody,
  dimensionsAffectedByImageChange,
  fillToEditorState,
  initDimensionImages,
  initSurfaceForm,
  unionInputs,
} from '@/lib/social-export/group-fill';

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
    dimension: id,
    width: 1080,
    height: 1080,
    preset: null,
    thumbnailUrl: null,
    hasDefaultPreview: false,
    inputs: [makeInput()],
    imageInputs: [makeSlot()],
    containers: [],
    richTextOptions: null,
    groupMember: true,
    ...overrides,
  };
}

const square = makeVariant('v-1x1');
const story = makeVariant('v-9x16', {
  height: 1920,
  inputs: [makeInput({ name: 'Headline 9:16' }), makeInput({ id: 'txt-story', name: 'Jen story' })],
  imageInputs: [makeSlot({ frame: { x: 0, y: 0, width: 800, height: 1200 } })],
});
const members = [square, story];

// ---------- Tests ------------------------------------------------------------

describe('unionInputs', () => {
  it('merges the dimensions first-wins by id', () => {
    const inputs = unionInputs(members);
    expect(inputs.map((i) => i.id)).toEqual(['txt-1', 'txt-story']);
    expect(inputs[0].name).toBe('Nadpis');
  });
});

describe('initSurfaceForm', () => {
  it('seeds from the sample value unless the match prefill supplies one', () => {
    const inputs = [
      makeInput({ id: 'a', sampleValue: 'Vzorový' }),
      makeInput({ id: 'b', sampleValue: 'Vzorový' }),
      makeInput({ id: 'c', sampleValue: '{"runs":[{"text":"Bod 1\\nBod 2"}],"lines":["ul","ul"]}', richText: true, lists: true }),
    ];
    const form = initSurfaceForm(inputs, { b: 'Z prefillu' });
    expect(form.a).toEqual({ value: 'Vzorový', hidden: false });
    expect(form.b).toEqual({ value: 'Z prefillu', hidden: false });
    expect(form.c.lines).toEqual(['ul', 'ul']);
  });
});

describe('applyImageChange', () => {
  const picked = { id: 'pic-1', url: 'https://store/pic-1.png' };

  it('a new pick lands in every dimension with a neutral placement', () => {
    const states = initDimensionImages(members);
    const next = applyImageChange(states, members, 'v-1x1', 'img-1', {
      image: picked,
      scale: 1,
      offsetXRatio: 0,
      offsetYRatio: 0,
      rotation: 0,
    });
    expect(next['v-1x1']['img-1'].image).toEqual(picked);
    expect(next['v-9x16']['img-1'].image).toEqual(picked);
    expect(dimensionsAffectedByImageChange(members, 'v-1x1', { image: picked })).toEqual(['v-1x1', 'v-9x16']);
  });

  it('a placement edit only touches the active dimension', () => {
    const states = applyImageChange(initDimensionImages(members), members, 'v-1x1', 'img-1', { image: picked });
    const next = applyImageChange(states, members, 'v-9x16', 'img-1', { scale: 1.8, offsetYRatio: 0.2 });
    expect(next['v-9x16']['img-1'].scale).toBe(1.8);
    expect(next['v-1x1']['img-1'].scale).toBe(1);
    expect(dimensionsAffectedByImageChange(members, 'v-9x16', { scale: 1.8 })).toEqual(['v-9x16']);
  });

  it('hiding is shared but keeps each dimension placement', () => {
    let states = applyImageChange(initDimensionImages(members), members, 'v-1x1', 'img-1', { image: picked });
    states = applyImageChange(states, members, 'v-1x1', 'img-1', { scale: 2 });
    const next = applyImageChange(states, members, 'v-9x16', 'img-1', { hidden: true });
    expect(next['v-1x1']['img-1']).toMatchObject({ hidden: true, scale: 2 });
    expect(next['v-9x16']['img-1']).toMatchObject({ hidden: true, scale: 1 });
  });
});

describe('buildGroupRenderBody', () => {
  it('splits shared picks from per-dimension placements', () => {
    const states = initDimensionImages(members);
    states['v-1x1']['img-1'] = { ...defaultImageSlotState(), image: { id: 'pic-1', url: 'u' }, scale: 1.5, offsetXRatio: 0.25 };
    states['v-9x16']['img-1'] = { ...defaultImageSlotState(), image: { id: 'pic-1', url: 'u' } };

    const body = buildGroupRenderBody(members, { 'txt-1': { value: 'Výhra', hidden: false } }, states);

    expect(body.inputs).toEqual({ 'txt-1': 'Výhra' });
    expect(body.images).toEqual({ 'img-1': 'pic-1' });
    expect(body.placements).toEqual({ 'v-1x1': { 'img-1': { scale: 1.5, offsetXRatio: 0.25 } } });
  });

  it('sends a hidden slot as a shared hide', () => {
    const states = initDimensionImages(members);
    for (const member of members) states[member.id]['img-1'] = { ...defaultImageSlotState(), hidden: true };

    expect(buildGroupRenderBody(members, {}, states).images).toEqual({ 'img-1': { hide: true } });
  });
});

describe('fillToEditorState', () => {
  it('turns a loaded version back into shared texts + per-dimension images', () => {
    const { formState, imageStates } = fillToEditorState(
      {
        inputs: { 'txt-1': { value: 'Z historie', hide: true }, 'txt-story': 'Příběh' },
        images: { 'img-1': { imageId: 'pic-1', url: 'https://store/pic-1.png' } },
        placements: { 'v-9x16': { 'img-1': { scale: 1.4, offsetYRatio: 0.1 } } },
      },
      members
    );

    expect(formState['txt-1']).toEqual({ value: 'Z historie', hidden: true });
    expect(formState['txt-story'].value).toBe('Příběh');
    expect(imageStates['v-1x1']['img-1']).toMatchObject({ image: { id: 'pic-1' }, scale: 1, offsetYRatio: 0 });
    expect(imageStates['v-9x16']['img-1']).toMatchObject({ image: { id: 'pic-1' }, scale: 1.4, offsetYRatio: 0.1 });
  });

  it('keeps a single variant version transform on the image entry', () => {
    const { imageStates } = fillToEditorState(
      {
        inputs: {},
        images: { 'img-1': { imageId: 'pic-1', url: 'u', scale: 2, offsetX: 100 } },
        placements: {},
      },
      [square]
    );

    // px pan converted against the slot's frame (400 px wide).
    expect(imageStates['v-1x1']['img-1']).toMatchObject({ scale: 2, offsetXRatio: 0.25 });
  });

  it('restores rich runs and list lines', () => {
    const rich = makeVariant('v-rich', {
      inputs: [makeInput({ richText: true, lists: true })],
      imageInputs: [],
    });
    const { formState } = fillToEditorState(
      {
        inputs: {
          'txt-1': {
            runs: [
              { text: 'A\n', fontFamily: null, color: '#c8102e', underline: false },
              { text: 'B', fontFamily: null, color: null, underline: false },
            ],
            lines: ['ul', 'ul'],
          },
        },
        images: {},
        placements: {},
      },
      [rich]
    );

    expect(formState['txt-1'].value).toBe('A\nB');
    expect(formState['txt-1'].lines).toEqual(['ul', 'ul']);
    expect(formState['txt-1'].runs?.[0].color).toBe('#c8102e');
  });
});
