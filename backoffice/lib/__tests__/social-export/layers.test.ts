import { describe, expect, it } from 'vitest';
import type {
  ImageInputDTO,
  TemplateInputDTO,
  TemplateVariantDTO,
} from '@/lib/social-export/api-types';
import { buildLayerRows } from '@/lib/social-export/layers';

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
    frame: { x: 0, y: 0, width: 100, height: 40 },
    containerId: null,
    textStyle: null,
    richText: false,
    layerIndex: null,
    ...overrides,
  };
}

function makeImageInput(overrides: Partial<ImageInputDTO> = {}): ImageInputDTO {
  return {
    id: 'img-1',
    name: null,
    description: null,
    allowMove: false,
    allowResize: false,
    allowRotate: false,
    hidable: false,
    directories: [],
    includesRoot: false,
    frame: { x: 0, y: 0, width: 400, height: 300 },
    defaultImageUrl: null,
    layerIndex: null,
    isBackground: false,
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
    containers: [],
    richTextOptions: null,
    ...overrides,
  };
}

// ---------- buildLayerRows ---------------------------------------------------

describe('buildLayerRows', () => {
  it('merges text + image inputs sorted by layerIndex descending (topmost first)', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 't-headline', name: 'Nadpis', layerIndex: 2 }),
        makeInput({ id: 't-tagline', name: 'Podtitulek', layerIndex: 5 }),
      ],
      imageInputs: [
        makeImageInput({ id: 'i-photo', name: 'Foto', layerIndex: 0 }),
        makeImageInput({ id: 'i-badge', name: 'Odznak', layerIndex: 3 }),
      ],
    });

    const rows = buildLayerRows(variant, {}, {});

    expect(rows.map((r) => r.id)).toEqual(['t-tagline', 'i-badge', 't-headline', 'i-photo']);
    expect(rows.map((r) => r.kind)).toEqual(['text', 'image', 'text', 'image']);
  });

  it('sinks null layerIndex rows to the end, keeping definition order', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 't-located', layerIndex: 1 }),
        makeInput({ id: 't-lost-a', layerIndex: null }),
      ],
      imageInputs: [makeImageInput({ id: 'i-lost-b', layerIndex: null })],
    });

    const rows = buildLayerRows(variant, {}, {});

    expect(rows.map((r) => r.id)).toEqual(['t-located', 't-lost-a', 'i-lost-b']);
  });

  it('labels rows via the shared label fallbacks (indexed within each list)', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 't1', name: null, description: null, layerIndex: 1 }),
        makeInput({ id: 't2', name: 'Nadpis', layerIndex: 0 }),
      ],
      imageInputs: [
        makeImageInput({ id: 'i1', name: null, description: null, layerIndex: 2 }),
        makeImageInput({
          id: 'i-bg',
          name: null,
          description: null,
          isBackground: true,
          layerIndex: 3,
        }),
      ],
    });

    const rows = buildLayerRows(variant, {}, {});

    expect(rows.find((r) => r.id === 't1')?.label).toBe('Text 1');
    expect(rows.find((r) => r.id === 't2')?.label).toBe('Nadpis');
    expect(rows.find((r) => r.id === 'i1')?.label).toBe('Obrázek 1');
    // Background slots mirror WBoost's fallback label.
    expect(rows.find((r) => r.id === 'i-bg')?.label).toBe('Pozadí');
  });

  it('reflects hidden state from form/image state and hidable flags', () => {
    const variant = makeVariant({
      inputs: [makeInput({ id: 't1', hidable: true, layerIndex: 1 })],
      imageInputs: [makeImageInput({ id: 'i1', hidable: true, layerIndex: 0 })],
    });

    const rows = buildLayerRows(
      variant,
      { t1: { value: '', hidden: true } },
      { i1: { image: null, scale: 1, offsetXRatio: 0, offsetYRatio: 0, rotation: 0, hidden: true } }
    );

    expect(rows.find((r) => r.id === 't1')).toMatchObject({ hidable: true, hidden: true });
    expect(rows.find((r) => r.id === 'i1')).toMatchObject({ hidable: true, hidden: true });
  });

  it('marks locked text rows non-clickable and frameless text rows non-clickable', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 't-locked', locked: true, hidable: true, layerIndex: 2 }),
        makeInput({ id: 't-frameless', frame: null, layerIndex: 1 }),
        makeInput({ id: 't-plain', layerIndex: 0 }),
      ],
      imageInputs: [makeImageInput({ id: 'i-frameless', frame: null, layerIndex: 3 })],
    });

    const rows = buildLayerRows(variant, {}, {});

    // Locked: shown, not editable/clickable, eye suppressed even if hidable.
    expect(rows.find((r) => r.id === 't-locked')).toMatchObject({
      editable: false,
      clickable: false,
      hidable: false,
    });
    // Text without a frame cannot anchor the floating panel.
    expect(rows.find((r) => r.id === 't-frameless')).toMatchObject({
      clickable: false,
      hasFrame: false,
    });
    expect(rows.find((r) => r.id === 't-plain')?.clickable).toBe(true);
    // Image slots open a modal — clickable even without a frame.
    expect(rows.find((r) => r.id === 'i-frameless')).toMatchObject({
      clickable: true,
      hasFrame: false,
    });
  });
});
