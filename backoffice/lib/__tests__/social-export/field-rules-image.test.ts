import { describe, it, expect } from 'vitest';
import type { ImageInputDTO } from '@/lib/social-export/api-types';
import {
  resolveImageLabel,
  defaultImageSlotState,
  hasAdjustments,
  buildRenderImages,
  type ImageSlotState,
} from '@/lib/social-export/field-rules-image';

// ---------- Helpers ----------------------------------------------------------

function makeImageInput(overrides: Partial<ImageInputDTO> = {}): ImageInputDTO {
  return {
    id: 'slot-1',
    name: null,
    description: null,
    allowMove: false,
    allowResize: false,
    allowRotate: false,
    hidable: false,
    directories: [{ id: 'dir-1', name: 'Fotky' }],
    includesRoot: false,
    frame: { x: 0, y: 0, width: 400, height: 300 },
    defaultImageUrl: null,
    layerIndex: null,
    ...overrides,
  };
}

function makeSlotState(overrides: Partial<ImageSlotState> = {}): ImageSlotState {
  return { ...defaultImageSlotState(), ...overrides };
}

const IMG = { id: 'img-9', url: 'http://store/photo.jpg' };

// ---------- resolveImageLabel ------------------------------------------------

describe('resolveImageLabel', () => {
  it('prefers name, then description, then "Obrázek N" (1-based)', () => {
    expect(resolveImageLabel(makeImageInput({ name: 'Foto', description: 'd' }), 0)).toBe('Foto');
    expect(resolveImageLabel(makeImageInput({ name: '  ', description: 'Popis' }), 0)).toBe('Popis');
    expect(resolveImageLabel(makeImageInput({ name: null, description: null }), 2)).toBe('Obrázek 3');
  });
});

describe('hasAdjustments', () => {
  it('is true when any allow* flag is set, false otherwise', () => {
    expect(hasAdjustments(makeImageInput())).toBe(false);
    expect(hasAdjustments(makeImageInput({ allowResize: true }))).toBe(true);
    expect(hasAdjustments(makeImageInput({ allowMove: true }))).toBe(true);
    expect(hasAdjustments(makeImageInput({ allowRotate: true }))).toBe(true);
  });
});

// ---------- buildRenderImages ------------------------------------------------

describe('buildRenderImages', () => {
  it('omits a slot with no image (keeps stand-in)', () => {
    const payload = buildRenderImages([makeImageInput({ id: 's' })], { s: makeSlotState() });
    expect(payload).not.toHaveProperty('s');
  });

  it('skips a slot absent from state', () => {
    const payload = buildRenderImages([makeImageInput({ id: 's' })], {});
    expect(payload).not.toHaveProperty('s');
  });

  it('sends SHORTHAND string when an image is chosen with no placement', () => {
    const inputs = [makeImageInput({ id: 's', allowMove: true, allowResize: true, allowRotate: true })];
    const payload = buildRenderImages(inputs, { s: makeSlotState({ image: IMG }) });
    expect(payload['s']).toBe('img-9');
  });

  it('includes scale only when allowResize and scale !== 1', () => {
    const inputs = [makeImageInput({ id: 's', allowResize: true })];
    const payload = buildRenderImages(inputs, { s: makeSlotState({ image: IMG, scale: 1.4 }) });
    expect(payload['s']).toEqual({ imageId: 'img-9', scale: 1.4 });
  });

  it('sends the pan as frame fractions, only when allowMove and !== 0', () => {
    const inputs = [makeImageInput({ id: 's', allowMove: true })];
    const payload = buildRenderImages(inputs, {
      s: makeSlotState({ image: IMG, offsetXRatio: 0.2, offsetYRatio: -0.1 }),
    });
    // The portable form: WBoost resolves it against THIS variant's frame, so the
    // same value keeps the crop when the user switches dimension.
    expect(payload['s']).toEqual({ imageId: 'img-9', offsetXRatio: 0.2, offsetYRatio: -0.1 });
  });

  it('includes rotation only when allowRotate and !== 0', () => {
    const inputs = [makeImageInput({ id: 's', allowRotate: true })];
    const payload = buildRenderImages(inputs, { s: makeSlotState({ image: IMG, rotation: 8 }) });
    expect(payload['s']).toEqual({ imageId: 'img-9', rotation: 8 });
  });

  it('NEVER sends a param whose allow* flag is false (avoids 400) → shorthand', () => {
    // State has placement values, but the slot allows none of them.
    const inputs = [makeImageInput({ id: 's' })];
    const payload = buildRenderImages(inputs, {
      s: makeSlotState({ image: IMG, scale: 2, offsetXRatio: 0.5, offsetYRatio: 0.5, rotation: 30 }),
    });
    expect(payload['s']).toBe('img-9');
  });

  it('rounds noisy values (scale 3dp, pan 4dp, rotation integer)', () => {
    const inputs = [makeImageInput({ id: 's', allowMove: true, allowResize: true, allowRotate: true })];
    const payload = buildRenderImages(inputs, {
      s: makeSlotState({
        image: IMG,
        scale: 1.23456,
        offsetXRatio: 0.197531,
        offsetYRatio: -0.102469,
        rotation: 7.6,
      }),
    });
    expect(payload['s']).toEqual({
      imageId: 'img-9',
      scale: 1.235,
      offsetXRatio: 0.1975,
      offsetYRatio: -0.1025,
      rotation: 8,
    });
  });

  it('emits { hide: true } for a hidden hidable slot (ignores image)', () => {
    const inputs = [makeImageInput({ id: 's', hidable: true, allowResize: true })];
    const payload = buildRenderImages(inputs, { s: makeSlotState({ image: IMG, scale: 2, hidden: true }) });
    expect(payload['s']).toEqual({ hide: true });
  });

  it('does NOT hide a non-hidable slot even when state.hidden is true', () => {
    const inputs = [makeImageInput({ id: 's', hidable: false })];
    const payload = buildRenderImages(inputs, { s: makeSlotState({ image: IMG, hidden: true }) });
    expect(payload['s']).toBe('img-9');
  });

  it('combines allowed placement params into one object', () => {
    const inputs = [makeImageInput({ id: 's', allowMove: true, allowResize: true, allowRotate: true })];
    const payload = buildRenderImages(inputs, {
      s: makeSlotState({ image: IMG, scale: 1.5, offsetXRatio: 0.1, offsetYRatio: 0, rotation: 45 }),
    });
    expect(payload['s']).toEqual({ imageId: 'img-9', scale: 1.5, offsetXRatio: 0.1, rotation: 45 });
  });
});
