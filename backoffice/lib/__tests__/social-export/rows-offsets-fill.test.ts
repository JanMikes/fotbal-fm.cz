import { describe, it, expect } from 'vitest';
import listing from '../fixtures/wboost-listing-rows.json';
import { mapRawVariant } from '@/lib/services/social-export.mappers';
import { buildVariantRenderBody, restoreRowsAndOffsets } from '@/lib/social-export/render-body';
import { buildGroupRenderBody, fillToEditorState, initDimensionImages, initSurfaceForm, unionInputs } from '@/lib/social-export/group-fill';
import { buildPageFill } from '@/lib/social-export/document-fill';
import { extractMatchPrefill } from '@/lib/social-export/prefill';
import { defaultImageSlotState } from '@/lib/social-export/field-rules-image';
import type { MovableElementDTO, TemplateVariantDTO } from '@/lib/social-export/api-types';
import type { Match } from '@/types/match';

function real(templateName: string, index = 0): TemplateVariantDTO {
  const template = (listing as unknown as { name: string; variants: unknown[] }[]).find((t) => t.name === templateName)!;
  return mapRawVariant(template.variants[index] as never, false);
}

const SCORE = '5a191f3b-0ba9-4a95-b09f-d9cb1bab8297';
const OPPONENT = 'aa3dc632-f4bc-4f2d-9ffc-ad52da560589';
const ROW = '7a221de8-68c3-430b-a3be-92f3fb7dac7f';

const movable = (overrides: Partial<MovableElementDTO> = {}): MovableElementDTO => ({
  id: 'title',
  kind: 'text',
  name: 'Nadpis',
  frame: { x: 113, y: 158, width: 850, height: 58.76 },
  vertical: true,
  horizontal: false,
  limits: { up: 20, down: null, left: null, right: null },
  range: { minX: 0, maxX: 0, minY: -20, maxY: 300 },
  memberIds: [],
  ...overrides,
});

describe('variant render body with rows + offsets', () => {
  it('sends the shown rows in `rows` (never in inputs) and the clamped offsets', () => {
    const variant = { ...real('Výsledky turnaje'), movableElements: [movable()] };
    const row = variant.repeatableRows![0];
    const form = initSurfaceForm(variant.inputs, {});
    form[SCORE] = { value: '4 - 4', hidden: false };
    form[row.slots[1].ids[OPPONENT]] = { value: 'TJ Kelč', hidden: false };

    const body = buildVariantRenderBody(variant, {
      formState: form,
      imageState: {},
      shapeColors: {},
      rowCounts: { [ROW]: 2 },
      offsets: { title: { x: 50, y: 500 } },
    });

    expect(Object.keys(body.inputs).some((id) => row.slots.some((s) => Object.values(s.ids).includes(id)))).toBe(false);
    expect(body.rows![ROW]).toHaveLength(2);
    expect(body.rows![ROW][0][SCORE]).toBe('4 - 4');
    expect(body.rows![ROW][1][OPPONENT]).toBe('TJ Kelč');
    // Clamped to range; the disabled axis stays 0.
    expect(body.offsets).toEqual({ title: { x: 0, y: 300 } });
  });

  it('omits rows/offsets for a plain variant (unchanged wire shape)', () => {
    const variant = { ...real('Výsledky turnaje'), repeatableRows: [], movableElements: [] };
    const body = buildVariantRenderBody(variant, { formState: {}, imageState: {}, shapeColors: {}, rowCounts: {}, offsets: {} });
    expect(body).toEqual({ inputs: {}, images: {}, shapeColors: {} });
  });
});

describe('group render body (real "Výsledek" group)', () => {
  const members = () => [real('Výsledek', 0), real('Výsledek', 1)];

  it('one shared rows list, per-dimension offsets, row pictures stay out of `images`', () => {
    const m = members();
    m[1] = { ...m[1], movableElements: [movable({ id: 'el' })] };
    const left = m[0].repeatableRows![0];
    const form = initSurfaceForm(unionInputs(m), {});
    form[left.slots[3].ids[left.members[0].id]] = { value: 'Střelec 4', hidden: false };

    const body = buildGroupRenderBody(m, form, initDimensionImages(m), {
      rowCounts: { [left.containerId]: 4, [m[0].repeatableRows![1].containerId]: 1 },
      offsets: { [m[1].id]: { el: { x: 0, y: 10 } }, [m[0].id]: { el: { x: 0, y: 10 } } },
    });
    expect(body.rows![left.containerId]).toHaveLength(4);
    expect(body.rows![left.containerId][3][left.members[0].id]).toBe('Střelec 4');
    expect(body.rows![m[0].repeatableRows![1].containerId]).toHaveLength(1);
    // Only the dimension that has the element sends it.
    expect(body.offsets).toEqual({ [m[1].id]: { el: { x: 0, y: 10 } } });
  });

  it('keeps the old body shape without extras or rows', () => {
    const m = members().map((v) => ({ ...v, repeatableRows: [] }));
    const body = buildGroupRenderBody(m, {}, {});
    expect(Object.keys(body).sort()).toEqual(['images', 'inputs', 'placements']);
  });
});

describe('restoring rows + offsets', () => {
  it('a version fill: rows onto slot ids, counts = list length, offsets per variant', () => {
    const variant = { ...real('Výsledky turnaje'), movableElements: [movable()] };
    const row = variant.repeatableRows![0];
    const loaded = fillToEditorState(
      {
        inputs: {},
        images: {},
        placements: {},
        shapeColors: {},
        rows: { [ROW]: [{ [SCORE]: '1:1' }, { [OPPONENT]: 'TJ Dva' }] },
        offsets: { title: { x: 0, y: 12 } },
      },
      [variant]
    );
    expect(loaded.rowCounts).toEqual({ [ROW]: 2 });
    expect(loaded.formState[SCORE].value).toBe('1:1');
    expect(loaded.formState[row.slots[1].ids[OPPONENT]].value).toBe('TJ Dva');
    expect(loaded.offsets).toEqual({ [variant.id]: { title: { x: 0, y: 12 } } });
  });

  it('a group version keys offsets by dimension', () => {
    const m = [real('Výsledek', 0), { ...real('Výsledek', 1), movableElements: [movable({ id: 'el' })] }];
    const loaded = fillToEditorState(
      { inputs: {}, images: {}, placements: {}, shapeColors: {}, rows: {}, offsets: { [m[1].id]: { el: { x: 0, y: 5 } } } },
      m
    );
    expect(loaded.offsets).toEqual({ [m[1].id]: { el: { x: 0, y: 5 } } });
    expect(loaded.rowCounts).toEqual({ [m[0].repeatableRows![0].containerId]: 4, [m[0].repeatableRows![1].containerId]: 4 });
  });

  it('a saved record without counts infers them from legacy slot ids; offsets are re-clamped', () => {
    const variant = { ...real('Výsledky turnaje'), movableElements: [movable()] };
    const row = variant.repeatableRows![0];
    const restored = restoreRowsAndOffsets([variant], {
      formState: { [row.slots[5].ids[SCORE]]: { value: '9:9', hidden: false } },
      offsets: { [variant.id]: { title: { x: 0, y: -999 } } },
    });
    expect(restored.rowCounts).toEqual({ [ROW]: 6 });
    expect(restored.offsets).toEqual({ [variant.id]: { title: { x: 0, y: -20 } } });

    const counted = restoreRowsAndOffsets([variant], { formState: {}, rowCounts: { [ROW]: 2 } });
    expect(counted.rowCounts).toEqual({ [ROW]: 2 });
  });
});

describe('document page fill', () => {
  it('a page sends its own rows + offsets', () => {
    const variant = { ...real('Výsledky turnaje'), movableElements: [movable()] };
    const page = { id: 'p1', position: 0, templateId: 't', templateName: 'Výsledky', variant };
    const fill = buildPageFill(page, { [SCORE]: { value: '2:2', hidden: false } }, { x: defaultImageSlotState() }, {}, { [ROW]: 1 }, { title: { x: 0, y: 3 } });
    expect(fill.rows).toEqual({ [ROW]: [{ [SCORE]: '2:2' }] });
    expect(fill.offsets).toEqual({ title: { x: 0, y: 3 } });
    expect(fill.inputs).toBeUndefined();
  });
});

describe('match prefill', () => {
  it('reaches only the template row (row 1), like WBoost', () => {
    const variant = real('Výsledky turnaje');
    // Every slot copy carries the template member's name ("Soupeř").
    const inputs = variant.inputs.map((input) => (input.rowSlot?.memberId === OPPONENT ? { ...input, name: 'Soupeř' } : input));
    expect(inputs.filter((i) => i.name === 'Soupeř')).toHaveLength(6);
    const prefill = extractMatchPrefill({ homeTeam: 'FK FM', awayTeam: 'TJ Kelč' } as Match, inputs);
    expect(Object.keys(prefill)).toEqual([OPPONENT]);
  });
});
