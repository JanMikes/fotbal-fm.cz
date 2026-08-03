import { describe, it, expect } from 'vitest';
import { applySavedState, type SavedExportState } from '@/lib/social-export/saved-state';
import { defaultImageSlotState } from '@/lib/social-export/field-rules-image';
import type { ImageInputDTO, TemplateVariantDTO } from '@/lib/social-export/api-types';

const SLOT: ImageInputDTO = {
  id: 'slot-1',
  name: 'Foto',
  description: null,
  allowMove: true,
  allowResize: true,
  allowRotate: true,
  hidable: false,
  directories: [],
  includesRoot: true,
  frame: { x: 0, y: 0, width: 400, height: 300 },
  defaultImageUrl: null,
  layerIndex: null,
  isBackground: false,
};

const VARIANT = {
  id: 'variant-1',
  inputs: [],
  imageInputs: [SLOT],
  containers: [],
} as unknown as TemplateVariantDTO;

const IMAGE = { id: 'img-1', url: 'http://store/photo.jpg' };

function saved(slot: Record<string, unknown>): SavedExportState {
  return {
    formState: {},
    imageState: { 'slot-1': slot as never },
  };
}

describe('applySavedState — image placement', () => {
  it('restores a frame-relative pan as-is', () => {
    const { imageState } = applySavedState(
      VARIANT,
      {},
      { 'slot-1': defaultImageSlotState() },
      saved({ image: IMAGE, scale: 1.5, offsetXRatio: 0.25, offsetYRatio: -0.1, rotation: 10, hidden: false })
    );

    expect(imageState['slot-1']).toMatchObject({
      scale: 1.5,
      offsetXRatio: 0.25,
      offsetYRatio: -0.1,
      rotation: 10,
    });
  });

  it('converts a legacy pixel pan against the slot frame, so an old save reopens on its crop', () => {
    const { imageState } = applySavedState(
      VARIANT,
      {},
      { 'slot-1': defaultImageSlotState() },
      saved({ image: IMAGE, scale: 1, offsetX: 100, offsetY: -30, rotation: 0, hidden: false })
    );

    // 100 px of a 400-wide frame, −30 px of a 300-tall one.
    expect(imageState['slot-1'].offsetXRatio).toBe(0.25);
    expect(imageState['slot-1'].offsetYRatio).toBe(-0.1);
  });

  it('falls back to centred when the pan is missing or unusable', () => {
    const { imageState } = applySavedState(
      VARIANT,
      {},
      { 'slot-1': defaultImageSlotState() },
      saved({ image: IMAGE, scale: 1, rotation: 0, hidden: false })
    );

    expect(imageState['slot-1'].offsetXRatio).toBe(0);
    expect(imageState['slot-1'].offsetYRatio).toBe(0);
  });

  it('clamps a hand-edited zoom / rotation into the editor range', () => {
    const { imageState } = applySavedState(
      VARIANT,
      {},
      { 'slot-1': defaultImageSlotState() },
      saved({ image: IMAGE, scale: 99, offsetXRatio: 0, offsetYRatio: 0, rotation: 999, hidden: false })
    );

    expect(imageState['slot-1'].scale).toBe(4);
    expect(imageState['slot-1'].rotation).toBe(180);
  });
});
