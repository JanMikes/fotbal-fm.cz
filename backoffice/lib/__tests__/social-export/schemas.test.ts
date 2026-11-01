import { describe, expect, it } from 'vitest';
import {
  documentRenderRequestSchema,
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

  it('persists a document fill: per-page state + shared texts, and stays strict', () => {
    const slot = { image: { id: 'i', url: 'u' }, scale: 1.5, offsetXRatio: 0.1, offsetYRatio: 0, rotation: 0, hidden: false };
    const body = {
      matchId: 'm1',
      templateId: 'doc-1',
      variantId: 'doc-1',
      state: {
        formState: {},
        imageState: {},
        document: {
          pages: { p1: { formState: { a: { value: 'X', hidden: true } }, imageState: { s: slot }, shapeColors: { sh: '#ff0000' } } },
          sharedText: { f1: 'Lucie' },
        },
      },
    };

    const parsed = saveStateRequestSchema.parse(body);
    expect(parsed.state.document?.pages.p1.imageState.s).toEqual(slot);
    expect(parsed.state.document?.sharedText).toEqual({ f1: 'Lucie' });
    expect(
      saveStateRequestSchema.safeParse({
        ...body,
        state: { ...body.state, document: { ...body.state.document, extra: 1 } },
      }).success
    ).toBe(false);
  });
});

describe('versionUpdateSchema', () => {
  it('needs a name or a pin flag', () => {
    expect(versionUpdateSchema.safeParse({}).success).toBe(false);
    expect(versionUpdateSchema.parse({ name: null })).toEqual({ name: null });
    expect(versionUpdateSchema.parse({ pinned: true })).toEqual({ pinned: true });
  });
});

describe('documentRenderRequestSchema', () => {
  const fill = {
    fields: { f1: 'Lucie', f2: { imageId: 'img-1' } },
    pages: {
      p1: { inputs: { t: { runs: [{ text: 'A', color: '#000000' }] } }, images: { s: { imageId: 'img', scale: 2 } } },
      p2: { shapeColors: { sh: '#ff0000' } },
    },
  };

  it('accepts a page preview and a document export, keeping rich runs per page', () => {
    const preview = documentRenderRequestSchema.parse({ documentId: 'd1', mode: 'preview', pageId: 'p1', ...fill });
    expect(preview.pages.p1.inputs?.t).toEqual({
      runs: [{ text: 'A', fontFamily: null, color: '#000000', underline: false }],
    });

    const exported = documentRenderRequestSchema.parse({ documentId: 'd1', mode: 'export', format: 'png', ...fill });
    expect(exported.format).toBe('png');
    expect(exported.fields.f2).toEqual({ imageId: 'img-1' });
  });

  it('refuses a preview without a page, an unknown format and unknown keys', () => {
    expect(documentRenderRequestSchema.safeParse({ documentId: 'd1', mode: 'preview', ...fill }).success).toBe(false);
    expect(
      documentRenderRequestSchema.safeParse({ documentId: 'd1', mode: 'export', format: 'jpg', ...fill }).success
    ).toBe(false);
    expect(
      documentRenderRequestSchema.safeParse({ documentId: 'd1', mode: 'export', ...fill, pages: { p1: { foo: 1 } } })
        .success
    ).toBe(false);
  });
});
