import { describe, it, expect } from 'vitest';
import listing from '../fixtures/wboost-listing-rows.json';
import { containerSheets, sheetOfField, visibleEntries } from '@/lib/social-export/container-sheets';
import { mapRawVariant } from '@/lib/services/social-export.mappers';
import { inactiveRowIds } from '@/lib/social-export/repeatable-rows';
import type { TemplateContainerDTO, TemplateInputDTO, TemplateVariantDTO } from '@/lib/social-export/api-types';

function realVariant(templateName: string, index = 0): TemplateVariantDTO {
  const template = (listing as unknown as { name: string; variants: unknown[] }[]).find((t) => t.name === templateName)!;
  return mapRawVariant(template.variants[index] as never, false);
}

const text = (id: string, y: number, overrides: Partial<TemplateInputDTO> = {}): TemplateInputDTO => ({
  id,
  name: id,
  maxLength: null,
  locked: false,
  uppercase: false,
  description: null,
  hidable: false,
  frame: { x: 0, y, width: 100, height: 20 },
  containerId: null,
  textStyle: null,
  richText: false,
  fontOptions: null,
  colorOptions: null,
  lists: false,
  listStyle: null,
  listCheckboxes: false,
  checklist: null,
  sampleValue: null,
  layerIndex: null,
  ...overrides,
});

const container = (id: string, members: string[], overrides: Partial<TemplateContainerDTO> = {}): TemplateContainerDTO => ({
  id,
  maxHeight: 400,
  y: 0,
  memberInputIds: members,
  memberContainerIds: [],
  gap: null,
  spaceAfter: null,
  nested: false,
  hidable: false,
  name: null,
  memberImageInputIds: [],
  repeat: null,
  ...overrides,
});

function variant(inputs: TemplateInputDTO[], containers: TemplateContainerDTO[]): TemplateVariantDTO {
  return {
    id: 'v',
    dimension: '4:5',
    width: 1080,
    height: 1350,
    preset: '4:5',
    thumbnailUrl: null,
    hasDefaultPreview: false,
    inputs,
    imageInputs: [],
    shapeInputs: [],
    containers,
    richTextOptions: null,
    groupMember: false,
    repeatableRows: [],
    movableElements: [],
  };
}

describe('containerSheets (one pencil per TOP-LEVEL container, WBoost P1)', () => {
  it('a top-level container with ≥ 2 editable fields gets one sheet; nested containers become sections', () => {
    const v = variant(
      [
        text('title', 10, { containerId: 'root' }),
        text('a', 50, { containerId: 'child', hidable: true }),
        text('b', 80, { containerId: 'child' }),
      ],
      [
        container('root', ['title'], { memberContainerIds: ['child'], name: 'Blok' }),
        container('child', ['a', 'b'], { nested: true, hidable: true, name: 'Řádek' }),
      ]
    );
    const [sheet] = containerSheets(v);
    expect(sheet.id).toBe('root');
    expect(sheet.name).toBe('Blok');
    expect(sheet.textIds).toEqual(['title', 'a', 'b']);
    expect(sheet.entries).toEqual([
      { kind: 'field', field: 'text', id: 'title', depth: 0 },
      { kind: 'section', id: 'child', depth: 0, name: 'Řádek', hidable: true, row: null },
      { kind: 'field', field: 'text', id: 'a', depth: 1 },
      { kind: 'field', field: 'text', id: 'b', depth: 1 },
    ]);
    expect(sheetOfField([sheet], 'b')?.id).toBe('root');
    expect(sheetOfField([sheet], 'nope')).toBeNull();
  });

  it('keeps per-field pencils for a container with fewer than 2 editable fields (locked ones do not count)', () => {
    const v = variant(
      [text('locked', 10, { containerId: 'c', locked: true }), text('only', 40, { containerId: 'c' })],
      [container('c', ['locked', 'only'])]
    );
    expect(containerSheets(v)).toEqual([]);
  });

  it('lists repeatable rows as "Řádek n" slot sections + an add entry (real "Výsledky turnaje")', () => {
    const real = realVariant('Výsledky turnaje');
    const sheets = containerSheets(real);
    // The rows' parent qualifies; "text-blok" (locked + 1 editable) does not.
    expect(sheets.map((s) => s.id)).toEqual(['de5f8b49-7d6d-481f-97e2-a840ce873f93']);
    const [sheet] = sheets;
    const sections = sheet.entries.filter((e) => e.kind === 'section');
    expect(sections.map((s) => (s.kind === 'section' ? s.row?.slot : null))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(sheet.entries.at(-1)).toEqual({ kind: 'rowAdd', rowId: '7a221de8-68c3-430b-a3be-92f3fb7dac7f', depth: 0 });
    expect(sheet.rowIds).toEqual(['7a221de8-68c3-430b-a3be-92f3fb7dac7f']);

    // Only the shown rows are listed.
    const row = real.repeatableRows![0];
    const inactive = inactiveRowIds(real.repeatableRows, { [row.containerId]: 2 });
    const shown = visibleEntries(sheet, inactive);
    expect(shown.filter((e) => e.kind === 'section')).toHaveLength(2);
    expect(shown.filter((e) => e.kind === 'field')).toHaveLength(4);
    expect(shown.at(-1)?.kind).toBe('rowAdd');
  });

  it('a single-text row qualifies through its slots (real "Výsledek" columns)', () => {
    const sheets = containerSheets(realVariant('Výsledek', 1));
    expect(sheets).toHaveLength(2);
    expect(sheets[0].textIds).toHaveLength(4);
  });
});
