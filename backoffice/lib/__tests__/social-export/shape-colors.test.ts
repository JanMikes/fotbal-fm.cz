import { describe, expect, it } from 'vitest';
import type { ShapeInputDTO, TemplateVariantDTO } from '@/lib/social-export/api-types';
import {
  currentShapeColor,
  normalizeHexColor,
  resolveShapeLabel,
  sanitizeShapeColors,
  unionShapeInputs,
} from '@/lib/social-export/shape-colors';
import { buildLayerRows } from '@/lib/social-export/layers';
import { fillToEditorState } from '@/lib/social-export/group-fill';

function makeShape(overrides: Partial<ShapeInputDTO> = {}): ShapeInputDTO {
  return {
    id: 'shape-1',
    name: 'Pruh',
    target: 'fill',
    defaultColor: '#112233',
    colorOptions: ['#112233', '#c8102e'],
    freeColor: false,
    frame: { x: 10, y: 20, width: 100, height: 40 },
    layerIndex: 3,
    ...overrides,
  };
}

function makeVariant(id: string, shapeInputs: ShapeInputDTO[]): TemplateVariantDTO {
  return {
    id,
    dimension: id,
    width: 1080,
    height: 1080,
    preset: null,
    thumbnailUrl: null,
    hasDefaultPreview: false,
    inputs: [],
    imageInputs: [],
    shapeInputs,
    containers: [],
    richTextOptions: null,
    groupMember: true,
  };
}

describe('normalizeHexColor', () => {
  it('mirrors WBoost: #rgb / rrggbb in any case → lowercase #rrggbb, else null', () => {
    expect(normalizeHexColor('#C8102E')).toBe('#c8102e');
    expect(normalizeHexColor('0af')).toBe('#00aaff');
    expect(normalizeHexColor('red')).toBeNull();
    expect(normalizeHexColor('#c8102e80')).toBeNull();
  });
});

describe('sanitizeShapeColors', () => {
  it('keeps only accepted picks of existing shapes, dropping designed-colour no-ops', () => {
    const listed = makeShape();
    const free = makeShape({ id: 'shape-2', freeColor: true, colorOptions: ['#000000'], defaultColor: '#000000' });

    expect(
      sanitizeShapeColors([listed, free], {
        'shape-1': '#C8102E',
        'shape-2': '#0af',
        gone: '#ffffff',
      })
    ).toEqual({ 'shape-1': '#c8102e', 'shape-2': '#00aaff' });

    expect(
      sanitizeShapeColors([listed, free], {
        'shape-1': '#ffffff', // not in the list, shape is list-only
        'shape-2': '#000000', // the designed colour
      })
    ).toEqual({});
    expect(sanitizeShapeColors([listed], undefined)).toEqual({});
  });
});

describe('shape helpers', () => {
  it('unions shapes over group members (first dimension wins) and resolves labels + current colour', () => {
    const first = makeShape({ name: 'Pruh 1:1' });
    const members = [makeVariant('v-1x1', [first]), makeVariant('v-9x16', [makeShape({ name: 'Pruh 9:16' })])];

    expect(unionShapeInputs(members)).toEqual([first]);
    expect(resolveShapeLabel(makeShape({ name: null }), 1)).toBe('Barva tvaru 2');
    expect(currentShapeColor(first, {})).toBe('#112233');
    expect(currentShapeColor(first, { 'shape-1': '#c8102e' })).toBe('#c8102e');
  });

  it('lists shapes in the layers panel by layerIndex, never hidable', () => {
    const rows = buildLayerRows(makeVariant('v', [makeShape(), makeShape({ id: 'no-frame', frame: null, layerIndex: 7 })]), {}, {});

    expect(rows.map((r) => [r.kind, r.id, r.clickable, r.hidable])).toEqual([
      ['shape', 'no-frame', false, false],
      ['shape', 'shape-1', true, false],
    ]);
  });

  it('loads a version’s shapeColors, re-validated against the current design', () => {
    const { shapeColors } = fillToEditorState(
      { inputs: {}, images: {}, placements: {}, shapeColors: { 'shape-1': '#c8102e', gone: '#ffffff' } },
      [makeVariant('v', [makeShape()])]
    );

    expect(shapeColors).toEqual({ 'shape-1': '#c8102e' });
  });
});
