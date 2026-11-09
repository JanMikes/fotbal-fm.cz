import { describe, it, expect } from 'vitest';
import listing from '../fixtures/wboost-listing-rows.json';
import {
  applyRowPlan,
  buildRowsBody,
  canApplyRowAction,
  clampRowCount,
  defaultRowCounts,
  expandRepeatableRows,
  flattenFillRows,
  inactiveRowIds,
  inferRowCounts,
  planRowAction,
  rowOfId,
} from '@/lib/social-export/repeatable-rows';
import { mapRawVariant } from '@/lib/services/social-export.mappers';
import type { RepeatableRowDTO, TemplateVariantDTO } from '@/lib/social-export/api-types';
import { defaultImageSlotState } from '@/lib/social-export/field-rules-image';
import { initialFieldState } from '@/lib/social-export/field-rules';

/** The real prod listing (see social-export.listing.test.ts), mapped WITHOUT expansion. */
function rawVariant(templateName: string, index = 0) {
  const template = (listing as unknown as { name: string; variants: unknown[] }[]).find((t) => t.name === templateName)!;
  return mapRawVariant(template.variants[index] as never, false, { expand: false });
}

const SCORE = '5a191f3b-0ba9-4a95-b09f-d9cb1bab8297';
const OPPONENT = 'aa3dc632-f4bc-4f2d-9ffc-ad52da560589';
const ROW = '7a221de8-68c3-430b-a3be-92f3fb7dac7f';
const PARENT = 'de5f8b49-7d6d-481f-97e2-a840ce873f93';

function tournament(): { variant: TemplateVariantDTO; expanded: TemplateVariantDTO; row: RepeatableRowDTO } {
  const variant = rawVariant('Výsledky turnaje');
  const expanded = expandRepeatableRows(variant);
  return { variant, expanded, row: expanded.repeatableRows![0] };
}

describe('expandRepeatableRows (real "Výsledky turnaje")', () => {
  it('materialises every slot up to max with the listed slot ids', () => {
    const { variant, expanded, row } = tournament();
    expect(row.repeat).toEqual({ max: 6, min: 1, default: 5 });
    expect(row.slots).toHaveLength(6);
    // 2 text members × 5 extra slots.
    expect(expanded.inputs).toHaveLength(variant.inputs.length + 10);

    const slot2 = row.slots[2];
    const score2 = expanded.inputs.find((input) => input.id === slot2.ids[SCORE])!;
    expect(score2.rowSlot).toEqual({ rowId: ROW, slot: 2, memberId: SCORE });
    expect(score2.containerId).toBe(slot2.containerId);
    expect(score2.name).toBe('Skóre 1');
    expect(score2.sampleValue).toBe(variant.inputs.find((i) => i.id === SCORE)!.sampleValue);
  });

  it('stacks the copies one pitch apart: designed extent + the parent gap', () => {
    const { variant, expanded, row } = tournament();
    const score = variant.inputs.find((i) => i.id === SCORE)!.frame!;
    // Extent of the row = Skóre's box (351.83 → 402.68); parent gap 25.
    const pitch = score.height + 25;
    for (const slot of row.slots) {
      const copy = expanded.inputs.find((i) => i.id === slot.ids[SCORE])!;
      expect(copy.frame!.y).toBeCloseTo(score.y + slot.index * pitch, 6);
      expect(copy.frame!.x).toBe(score.x);
    }
  });

  it('marks the template row slot 0 and adds the slot containers to the parent flow', () => {
    const { expanded, row } = tournament();
    expect(expanded.inputs.find((i) => i.id === OPPONENT)!.rowSlot).toEqual({ rowId: ROW, slot: 0, memberId: OPPONENT });
    const parent = expanded.containers.find((c) => c.id === PARENT)!;
    expect(parent.memberContainerIds).toEqual(row.slots.map((slot) => slot.containerId));
    const slot3 = expanded.containers.find((c) => c.id === row.slots[3].containerId)!;
    expect(slot3.nested).toBe(true);
    expect(slot3.repeat).toBeNull();
    expect(slot3.rowSlot).toEqual({ rowId: ROW, slot: 3, memberId: ROW });
    expect(slot3.memberInputIds).toEqual([row.slots[3].ids[SCORE], row.slots[3].ids[OPPONENT]]);
  });

  it('is idempotent and leaves a variant without rows untouched', () => {
    const { expanded } = tournament();
    expect(expandRepeatableRows(expanded)).toBe(expanded);
    const plain = { ...rawVariant('Výsledky turnaje'), repeatableRows: [] };
    expect(expandRepeatableRows(plain)).toBe(plain);
  });

  it('expands single-text rows (the real "Výsledek" group dimension)', () => {
    const expanded = expandRepeatableRows(rawVariant('Výsledek', 1));
    expect(expanded.repeatableRows).toHaveLength(2);
    const [left] = expanded.repeatableRows!;
    expect(left.repeat).toEqual({ max: 4, min: 1, default: 4 });
    const copies = expanded.inputs.filter((i) => i.rowSlot?.rowId === left.containerId);
    expect(copies.map((i) => i.rowSlot!.slot)).toEqual([0, 1, 2, 3]);
  });

  it('pushes the designed tops of items below the row by (max − 1) × pitch (designed-gap order)', () => {
    const base = rawVariant('Výsledky turnaje');
    const below = { ...base.inputs.find((i) => i.id === OPPONENT)!, id: 'footer', name: 'Pata', containerId: PARENT, frame: { x: 100, y: 700, width: 300, height: 30 } };
    const variant: TemplateVariantDTO = {
      ...base,
      inputs: [...base.inputs, below],
      containers: base.containers.map((c) => (c.id === PARENT ? { ...c, memberInputIds: ['footer'] } : c)),
    };
    const expanded = expandRepeatableRows(variant);
    const pitch = 50.85 + 25;
    expect(expanded.inputs.find((i) => i.id === 'footer')!.frame!.y).toBeCloseTo(700 + 5 * pitch, 6);
  });
});

describe('row counts', () => {
  it('defaults, clamps and infers counts from legacy slot ids', () => {
    const { row, expanded } = tournament();
    expect(defaultRowCounts(expanded.repeatableRows)).toEqual({ [ROW]: 5 });
    expect(clampRowCount(row, 99)).toBe(6);
    expect(clampRowCount(row, 0)).toBe(1);
    expect(clampRowCount(row, Number.NaN)).toBe(5);

    // A saved count wins (clamped).
    expect(inferRowCounts(expanded.repeatableRows, { [ROW]: 2 }, [])).toEqual({ [ROW]: 2 });
    // No count: an old record addressing slot 5 by its (legacy) id shows 6 rows.
    expect(inferRowCounts(expanded.repeatableRows, undefined, [row.slots[5].ids[OPPONENT]])).toEqual({ [ROW]: 6 });
    // …and never fewer than the default.
    expect(inferRowCounts(expanded.repeatableRows, undefined, [row.slots[1].ids[SCORE]])).toEqual({ [ROW]: 5 });
  });

  it('lists every id of the unused slots', () => {
    const { row, expanded } = tournament();
    const inactive = inactiveRowIds(expanded.repeatableRows, { [ROW]: 4 });
    expect(inactive.has(row.slots[4].ids[SCORE])).toBe(true);
    expect(inactive.has(row.slots[5].containerId)).toBe(true);
    expect(inactive.has(row.slots[3].ids[SCORE])).toBe(false);
    expect(inactive.has(SCORE)).toBe(false);
  });

  it('finds the row + slot of any slot id', () => {
    const { row, expanded } = tournament();
    expect(rowOfId(expanded.repeatableRows, row.slots[2].ids[OPPONENT])).toEqual({ row, slot: 2, role: OPPONENT });
    expect(rowOfId(expanded.repeatableRows, 'nope')).toBeNull();
  });
});

describe('row actions (WBoost fill_rows semantics)', () => {
  it('gates add at max, remove at min, up/down at the ends', () => {
    const { row } = tournament();
    expect(canApplyRowAction(row, 6, 'add')).toBe(false);
    expect(canApplyRowAction(row, 5, 'add')).toBe(true);
    expect(canApplyRowAction(row, 1, 'remove', 0)).toBe(false);
    expect(canApplyRowAction(row, 3, 'up', 0)).toBe(false);
    expect(canApplyRowAction(row, 3, 'down', 2)).toBe(false);
    expect(canApplyRowAction(row, 3, 'down', 1)).toBe(true);
  });

  it('removing a middle row shifts the later rows up (texts, hides, pictures) and resets the freed slot', () => {
    const { row, expanded } = tournament();
    const id = (slot: number, role: string) => row.slots[slot].ids[role];
    const score = expanded.inputs.find((i) => i.id === SCORE)!;
    const formState = {
      [id(0, SCORE)]: { value: '1:0', hidden: false },
      [id(1, SCORE)]: { value: '2:0', hidden: false },
      [id(2, SCORE)]: { value: '3:0', hidden: true },
      [id(2, OPPONENT)]: { value: 'TJ Tři', hidden: false },
      unrelated: { value: 'x', hidden: false },
    };
    const imageStates = {
      // A text id in the picture map is not a picture role: left alone.
      v1: { [id(2, SCORE)]: { ...defaultImageSlotState(), image: { id: 'img', url: 'u' } } },
    };
    const plan = planRowAction(row, 3, 'remove', 1)!;
    expect(plan.count).toBe(2);

    const next = applyRowPlan({ formState, imageStates, shapeColors: {} }, row, plan, {
      text: (memberId) => initialFieldState(expanded.inputs.find((i) => i.id === memberId)!),
    });
    expect(next.formState[id(0, SCORE)].value).toBe('1:0');
    expect(next.formState[id(1, SCORE)]).toEqual({ value: '3:0', hidden: true });
    expect(next.formState[id(1, OPPONENT)].value).toBe('TJ Tři');
    // The freed last slot shows the template row's sample again.
    expect(next.formState[id(2, SCORE)]).toEqual(initialFieldState(score));
    expect(next.formState.unrelated.value).toBe('x');
    expect(next.imageStates.v1).toEqual(imageStates.v1);
  });

  it('moves a picture with its row in every dimension and empties the freed slot', () => {
    const row: RepeatableRowDTO = {
      containerId: 'r',
      parentContainerId: 'p',
      name: null,
      repeat: { min: 1, max: 3, default: 2 },
      fitsRows: 3,
      members: [
        { id: 'crest', kind: 'image', name: 'Erb' },
        { id: 'band', kind: 'shape', name: 'Pruh' },
      ],
      slots: [0, 1, 2].map((index) => ({
        index,
        containerId: index === 0 ? 'r' : `r#${index}`,
        ids: index === 0 ? { r: 'r', crest: 'crest', band: 'band' } : { r: `r#${index}`, crest: `crest#${index}`, band: `band#${index}` },
      })),
    };
    const picked = { ...defaultImageSlotState(), image: { id: 'img-2', url: 'u' }, scale: 1.5 };
    const next = applyRowPlan(
      {
        formState: {},
        imageStates: { v1: { crest: defaultImageSlotState(), 'crest#1': picked }, v2: { 'crest#1': { ...picked, scale: 1 } } },
        shapeColors: { 'band#1': '#c8102e' },
      },
      row,
      planRowAction(row, 2, 'remove', 0)!,
      { text: () => ({ value: '', hidden: false }) }
    );
    expect(next.imageStates.v1.crest).toEqual(picked);
    expect(next.imageStates.v1['crest#1']).toEqual(defaultImageSlotState());
    expect(next.imageStates.v2.crest).toEqual({ ...picked, scale: 1 });
    expect(next.shapeColors).toEqual({ band: '#c8102e' });
  });

  it('up swaps two rows', () => {
    const { row } = tournament();
    const id = (slot: number) => row.slots[slot].ids[SCORE];
    const next = applyRowPlan(
      { formState: { [id(0)]: { value: 'A', hidden: false }, [id(1)]: { value: 'B', hidden: false } }, imageStates: {}, shapeColors: {} },
      row,
      planRowAction(row, 2, 'up', 1)!,
      { text: () => ({ value: '', hidden: false }) }
    );
    expect(next.formState[id(0)].value).toBe('B');
    expect(next.formState[id(1)].value).toBe('A');
  });
});

describe('rows in the render body', () => {
  it('moves every slot value out of inputs into rows, one object per shown row', () => {
    const { row, expanded } = tournament();
    const id = (slot: number, role: string) => row.slots[slot].ids[role];
    const body = buildRowsBody(expanded.repeatableRows, { [ROW]: 3 }, {
      inputs: {
        [id(0, SCORE)]: '4 - 4',
        [id(0, OPPONENT)]: 'TJ Kelč',
        [id(2, OPPONENT)]: { hide: true },
        [id(4, SCORE)]: 'inactive row — dropped',
        title: 'Turnaj',
      },
      images: {},
      shapeColors: {},
    });
    expect(body.inputs).toEqual({ title: 'Turnaj' });
    expect(body.rows).toEqual({
      [ROW]: [{ [SCORE]: '4 - 4', [OPPONENT]: 'TJ Kelč' }, {}, { [OPPONENT]: { hide: true } }],
    });
  });

  it('sends nothing for a variant without rows', () => {
    const body = buildRowsBody([], {}, { inputs: { a: 'x' }, images: {}, shapeColors: {} });
    expect(body).toEqual({ inputs: { a: 'x' }, images: {}, shapeColors: {}, rows: {} });
  });

  it('a version`s fill.rows flattens back onto the slot ids (count = list length)', () => {
    const { row, expanded } = tournament();
    const flat = flattenFillRows(expanded.repeatableRows, {
      [ROW]: [{ [SCORE]: '1:1' }, {}, { [OPPONENT]: 'TJ Tři' }],
      unknown: [{}],
    });
    expect(flat.counts).toEqual({ [ROW]: 3 });
    expect(flat.inputs).toEqual({ [SCORE]: '1:1', [row.slots[2].ids[OPPONENT]]: 'TJ Tři' });
  });
});
