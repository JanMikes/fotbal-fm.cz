import { describe, expect, it } from 'vitest';
import type { ImageFrameDTO, TemplateContainerDTO, TemplateInputDTO, TemplateVariantDTO } from '@/lib/social-export/api-types';
import {
  buildContainerHides,
  containerHiddenInputIds,
  containerLabel,
  hidableContainers,
  restoreContainerHides,
  unionHidableContainers,
} from '@/lib/social-export/container-hides';
import { buildRenderInputs } from '@/lib/social-export/field-rules';
import { buildGroupRenderBody, fillToEditorState } from '@/lib/social-export/group-fill';
import { applySavedForm } from '@/lib/social-export/saved-state';
import { computeTextLayout, type MeasurableText } from '@/lib/social-export/text-layout';

// ---------- Helpers ----------------------------------------------------------

function makeInput(overrides: Partial<TemplateInputDTO> = {}): TemplateInputDTO {
  return {
    id: 'inp-1',
    name: null,
    maxLength: null,
    locked: false,
    uppercase: false,
    description: null,
    hidable: false,
    frame: null,
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

function makeVariant(overrides: Partial<TemplateVariantDTO> = {}): TemplateVariantDTO {
  return {
    id: 'var-1',
    dimension: '1:1',
    width: 1080,
    height: 1080,
    preset: null,
    thumbnailUrl: null,
    hasDefaultPreview: false,
    inputs: [],
    imageInputs: [],
    shapeInputs: [],
    containers: [],
    richTextOptions: null,
    groupMember: false,
    ...overrides,
  };
}

function frame(x: number, y: number, width: number, height: number): ImageFrameDTO {
  return { x, y, width, height };
}

const STYLE = { fontFamily: 'Arial', fontSize: 20, lineHeight: 1.2, charSpacing: 0 };
const measureByLength = (value: MeasurableText) =>
  (typeof value === 'string' ? value : value.map((segment) => segment.text).join('')).length * 10;

const BUBBLE: TemplateContainerDTO = {
  id: 'bubble',
  maxHeight: 400,
  y: 100,
  memberInputIds: ['quote'],
  memberContainerIds: ['inner'],
  hidable: true,
  name: 'Bublina',
};
const INNER: TemplateContainerDTO = { id: 'inner', maxHeight: 400, y: 160, memberInputIds: ['author'], nested: true };
const FIXED: TemplateContainerDTO = { id: 'fixed', maxHeight: 400, y: 600, memberInputIds: ['other'] };

// ---------- Tests ------------------------------------------------------------

describe('container hides', () => {
  it('lists only hidable containers and labels them', () => {
    expect(hidableContainers([BUBBLE, INNER, FIXED]).map((c) => c.id)).toEqual(['bubble']);
    expect(containerLabel(BUBBLE, 0)).toBe('Bublina');
    expect(containerLabel({ ...BUBBLE, name: null }, 1)).toBe('Skupina prvků 2');
    expect(
      unionHidableContainers([
        makeVariant({ id: 'a', containers: [BUBBLE] }),
        makeVariant({ id: 'b', containers: [{ ...BUBBLE, name: 'Jiný' }, FIXED] }),
      ]).map((c) => c.name)
    ).toEqual(['Bublina']);
  });

  it('expands a hidden container to its whole tree (nested included)', () => {
    const state = { bubble: { value: '', hidden: true } };
    expect([...containerHiddenInputIds([BUBBLE, INNER, FIXED], state)].sort()).toEqual(['author', 'quote']);
    // A non-hidable container never hides, even with a stale toggle.
    expect([...containerHiddenInputIds([FIXED], { fixed: { value: '', hidden: true } })]).toEqual([]);
  });

  it('sends { hide: true } under the container id next to the inputs', () => {
    const inputs = [makeInput({ id: 'quote', hidable: true })];
    const state = {
      quote: { value: 'Citace', hidden: false },
      bubble: { value: '', hidden: true },
      fixed: { value: '', hidden: true },
    };
    expect(buildContainerHides([BUBBLE, FIXED], state)).toEqual({ bubble: { hide: true } });
    // The member keeps its own value — the container hide wins server-side.
    expect(buildRenderInputs(inputs, state, [BUBBLE, FIXED])).toEqual({ bubble: { hide: true }, quote: 'Citace' });
    expect(buildRenderInputs(inputs, { ...state, bubble: { value: '', hidden: false } }, [BUBBLE])).toEqual({ quote: 'Citace' });
  });

  it('group render body carries the shared container hide once', () => {
    const members = [
      makeVariant({ id: 'a', containers: [BUBBLE] }),
      makeVariant({ id: 'b', containers: [BUBBLE] }),
    ];
    expect(buildGroupRenderBody(members, { bubble: { value: '', hidden: true } }, {}).inputs).toEqual({ bubble: { hide: true } });
  });

  it('restores the toggle from a saved form and from an export version', () => {
    expect(restoreContainerHides([BUBBLE, FIXED], { bubble: { value: '', hidden: true }, fixed: { value: '', hidden: true } })).toEqual({
      bubble: { value: '', hidden: true },
    });
    expect(applySavedForm([], {}, { bubble: { value: '', hidden: true } }, [BUBBLE])).toEqual({
      bubble: { value: '', hidden: true },
    });

    const loaded = fillToEditorState(
      { inputs: { bubble: { hide: true } }, images: {}, placements: {}, shapeColors: {} },
      [makeVariant({ containers: [BUBBLE] })]
    );
    expect(loaded.formState.bubble).toEqual({ value: '', hidden: true });
  });

  it('collapses the hidden container in the client reflow like hidden members', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'quote', containerId: 'bubble', frame: frame(0, 100, 200, 40), textStyle: STYLE }),
        makeInput({ id: 'after', containerId: 'page', frame: frame(0, 300, 200, 40), textStyle: STYLE }),
      ],
      containers: [
        { id: 'page', maxHeight: 900, y: 100, memberInputIds: ['after'], memberContainerIds: ['bubble'] },
        { ...BUBBLE, memberContainerIds: [], nested: true },
      ],
    });
    const state = { quote: { value: '', hidden: false }, after: { value: '', hidden: false } };

    expect(computeTextLayout(variant, state, measureByLength).frames['after'].y).toBe(300);
    // Hidden bubble → `after` anchors at the flow top (the bubble's place).
    expect(computeTextLayout(variant, { ...state, bubble: { value: '', hidden: true } }, measureByLength).frames['after'].y).toBe(100);
  });
});
