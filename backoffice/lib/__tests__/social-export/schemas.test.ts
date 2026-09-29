import { describe, expect, it } from 'vitest';
import {
  groupRenderRequestSchema,
  renderRequestSchema,
  saveStateRequestSchema,
  versionUpdateSchema,
} from '@/lib/social-export/schemas';

describe('renderRequestSchema', () => {
  it('keeps rich runs, list lines and the font choice (regression: they used to be stripped)', () => {
    const body = {
      variantId: 'v1',
      mode: 'export',
      inputs: {
        rich: {
          runs: [{ text: 'Ahoj', color: '#c8102e' }],
          lines: ['ul'],
          fontFamily: 'Rubik (Rubik Bold)',
        },
        font: { value: 'Text', fontFamily: 'Rubik (Rubik Bold)' },
        fontOnly: { fontFamily: 'Rubik (Rubik Bold)' },
        plain: 'Text',
      },
    };

    const parsed = renderRequestSchema.parse(body);

    expect(parsed.inputs.rich).toEqual({
      runs: [{ text: 'Ahoj', fontFamily: null, color: '#c8102e', underline: false }],
      lines: ['ul'],
      fontFamily: 'Rubik (Rubik Bold)',
    });
    expect(parsed.inputs.font).toEqual({ value: 'Text', fontFamily: 'Rubik (Rubik Bold)' });
    expect(parsed.inputs.fontOnly).toEqual({ fontFamily: 'Rubik (Rubik Bold)' });
    expect(parsed.inputs.plain).toBe('Text');
    expect(parsed.mode).toBe('export');
  });

  it('rejects unknown keys instead of silently dropping them', () => {
    expect(renderRequestSchema.safeParse({ variantId: 'v1', inputs: { a: { value: 'x', bogus: 1 } } }).success).toBe(false);
    expect(renderRequestSchema.safeParse({ variantId: 'v1', inputs: { a: { runs: [], lines: ['xx'] } } }).success).toBe(false);
  });
});

describe('groupRenderRequestSchema', () => {
  it('accepts shared picks and per-dimension placements', () => {
    const parsed = groupRenderRequestSchema.parse({
      groupId: 'g1',
      inputs: { t: 'x' },
      images: { s: 'pic' },
      placements: { v1: { s: { scale: 1.2, offsetXRatio: -0.1 } } },
      mode: 'export',
    });
    expect(parsed.placements).toEqual({ v1: { s: { scale: 1.2, offsetXRatio: -0.1 } } });
  });
});

describe('saveStateRequestSchema', () => {
  it('persists runs, lines, font picks and per-dimension image states', () => {
    const slot = { image: null, scale: 1, offsetXRatio: 0, offsetYRatio: 0, rotation: 0, hidden: false };
    const parsed = saveStateRequestSchema.parse({
      matchId: 'm1',
      templateId: 't1',
      variantId: 'g1',
      state: {
        formState: {
          a: {
            value: 'Ahoj',
            hidden: false,
            runs: [{ text: 'Ahoj', fontFamily: null, color: '#000000', underline: true }],
            lines: ['p'],
            fontFamily: 'Rubik (Rubik Bold)',
          },
        },
        imageState: { s: slot },
        dimensionImageStates: { v1: { s: slot } },
      },
    });

    expect(parsed.state.formState.a.runs).toHaveLength(1);
    expect(parsed.state.formState.a.fontFamily).toBe('Rubik (Rubik Bold)');
    expect(parsed.state.dimensionImageStates?.v1.s).toEqual(slot);
  });
});

describe('versionUpdateSchema', () => {
  it('needs a name or a pin flag', () => {
    expect(versionUpdateSchema.safeParse({}).success).toBe(false);
    expect(versionUpdateSchema.parse({ name: null })).toEqual({ name: null });
    expect(versionUpdateSchema.parse({ pinned: true })).toEqual({ pinned: true });
  });
});
