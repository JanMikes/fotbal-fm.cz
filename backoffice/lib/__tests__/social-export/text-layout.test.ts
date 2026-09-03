import { describe, it, expect } from 'vitest';
import type {
  TemplateInputDTO,
  TemplateVariantDTO,
  ImageFrameDTO,
} from '@/lib/social-export/api-types';
import type { InputFieldState } from '@/lib/social-export/field-rules';
import {
  computeGaps,
  computeLayout,
  computeTextFrames,
  computeTextLayout,
  measureWrappedTextHeight,
  type MeasurableText,
} from '@/lib/social-export/text-layout';

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
    containers: [],
    richTextOptions: null,
    ...overrides,
  };
}

function frame(x: number, y: number, width: number, height: number): ImageFrameDTO {
  return { x, y, width, height };
}

const STYLE = { fontFamily: 'Arial', fontSize: 20, lineHeight: 1.2, charSpacing: 0 };

/** Plain-text projection of a measurable value (string or rich segments). */
function plainOf(value: MeasurableText): string {
  return typeof value === 'string' ? value : value.map((segment) => segment.text).join('');
}

/** Fake measurer: height = 10 per character (deterministic, no canvas). */
const measureByLength = (value: MeasurableText) => plainOf(value).length * 10;

// ---------- computeGaps / computeLayout (WBoostContainerLayout port) ----------

describe('computeGaps', () => {
  it('returns the designed vertical gaps between consecutive members', () => {
    const gaps = computeGaps([
      { designedTop: 100, designedHeight: 40 },
      { designedTop: 160, designedHeight: 30 },
      { designedTop: 200, designedHeight: 50 },
    ]);
    expect(gaps).toEqual([20, 10]);
  });

  it('returns no gaps for fewer than two members', () => {
    expect(computeGaps([])).toEqual([]);
    expect(computeGaps([{ designedTop: 5, designedHeight: 10 }])).toEqual([]);
  });
});

describe('computeLayout', () => {
  const designed = [
    { designedTop: 100, designedHeight: 40 },
    { designedTop: 160, designedHeight: 30 },
    { designedTop: 200, designedHeight: 50 },
  ];
  const gaps = computeGaps(designed);

  it('keeps designed tops when actual heights equal designed heights', () => {
    const members = designed.map((d) => ({
      designedTop: d.designedTop,
      actualHeight: d.designedHeight,
      hidden: false,
    }));
    const result = computeLayout(members, 300, gaps);
    expect(result.tops).toEqual([100, 160, 200]);
    expect(result.contentBottom).toBe(250);
    expect(result.overflowPx).toBe(0);
  });

  it('pushes members below a grown member down by the growth', () => {
    const members = [
      { designedTop: 100, actualHeight: 70, hidden: false }, // +30
      { designedTop: 160, actualHeight: 30, hidden: false },
      { designedTop: 200, actualHeight: 50, hidden: false },
    ];
    const result = computeLayout(members, 300, gaps);
    expect(result.tops).toEqual([100, 190, 230]);
  });

  it('collapses hidden members (null top, no space) while keeping gaps', () => {
    const members = [
      { designedTop: 100, actualHeight: 40, hidden: false },
      { designedTop: 160, actualHeight: 30, hidden: true },
      { designedTop: 200, actualHeight: 50, hidden: false },
    ];
    const result = computeLayout(members, 300, gaps);
    // Member 3 sits at member 1's bottom + its own designed gap (10).
    expect(result.tops).toEqual([100, null, 150]);
    expect(result.contentBottom).toBe(200);
  });

  it('anchors at the FIRST member designed top even when it is hidden', () => {
    const members = [
      { designedTop: 100, actualHeight: 40, hidden: true },
      { designedTop: 160, actualHeight: 30, hidden: false },
    ];
    const result = computeLayout(members, 300, gaps.slice(0, 1));
    expect(result.tops).toEqual([null, 100]);
  });

  it('reports overflow when the flow exceeds maxHeight', () => {
    const members = [
      { designedTop: 100, actualHeight: 120, hidden: false },
      { designedTop: 160, actualHeight: 90, hidden: false },
    ];
    const result = computeLayout(members, 150, [20]);
    // content: 100..220, +20 gap, 240..330 → bottom 330; limit 100+150=250.
    expect(result.contentBottom).toBe(330);
    expect(result.overflowPx).toBe(80);
  });
});

// ---------- computeTextFrames --------------------------------------------------

describe('computeTextFrames', () => {
  it('keeps the designed frame for locked inputs, empty values and missing textStyle', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'locked', locked: true, frame: frame(0, 0, 100, 30), textStyle: STYLE }),
        makeInput({ id: 'empty', frame: frame(0, 50, 100, 30), textStyle: STYLE }),
        makeInput({ id: 'no-style', frame: frame(0, 100, 100, 30) }),
      ],
    });
    const state: Record<string, InputFieldState> = {
      locked: { value: 'ignored', hidden: false },
      empty: { value: '', hidden: false },
      'no-style': { value: 'text', hidden: false },
    };
    const frames = computeTextFrames(variant, state, measureByLength);
    expect(frames['locked']).toEqual(frame(0, 0, 100, 30));
    expect(frames['empty']).toEqual(frame(0, 50, 100, 30));
    expect(frames['no-style']).toEqual(frame(0, 100, 100, 30));
  });

  it('re-measures the height of a filled input (uppercase + maxLength applied)', () => {
    const measured: string[] = [];
    const spy = (value: MeasurableText) => {
      measured.push(plainOf(value));
      return measureByLength(value);
    };
    const variant = makeVariant({
      inputs: [
        makeInput({
          id: 'a',
          uppercase: true,
          maxLength: 4,
          frame: frame(10, 20, 100, 30),
          textStyle: STYLE,
        }),
      ],
    });
    const frames = computeTextFrames(variant, { a: { value: 'abcdef', hidden: false } }, spy);
    expect(measured).toEqual(['ABCD']);
    expect(frames['a']).toEqual(frame(10, 20, 100, 40));
  });

  it('skips inputs without a frame', () => {
    const variant = makeVariant({
      inputs: [makeInput({ id: 'frameless', frame: null, textStyle: STYLE })],
    });
    const frames = computeTextFrames(variant, { frameless: { value: 'x', hidden: false } }, measureByLength);
    expect(frames['frameless']).toBeUndefined();
  });

  it('falls back to the designed height when measuring is unavailable', () => {
    const variant = makeVariant({
      inputs: [makeInput({ id: 'a', frame: frame(0, 0, 100, 30), textStyle: STYLE })],
    });
    const frames = computeTextFrames(variant, { a: { value: 'text', hidden: false } }, () => null);
    expect(frames['a']).toEqual(frame(0, 0, 100, 30));
  });

  it('reflows container members: growth pushes the members below down', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'm1', containerId: 'c', frame: frame(0, 100, 200, 40), textStyle: STYLE }),
        makeInput({ id: 'm2', containerId: 'c', frame: frame(0, 160, 200, 30), textStyle: STYLE }),
      ],
      containers: [{ id: 'c', maxHeight: 300, y: 100, memberInputIds: ['m1', 'm2'] }],
    });
    // m1 measures 7 chars × 10 = 70 (designed 40, +30) → m2 shifts 160 → 190.
    const frames = computeTextFrames(
      variant,
      { m1: { value: 'seven!!', hidden: false }, m2: { value: '', hidden: false } },
      measureByLength
    );
    expect(frames['m1']).toEqual(frame(0, 100, 200, 70));
    expect(frames['m2']).toEqual(frame(0, 190, 200, 30));
  });

  it('collapses a hidden hidable member to a zero-height line at its flow position', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'm1', hidable: true, containerId: 'c', frame: frame(0, 100, 200, 40), textStyle: STYLE }),
        makeInput({ id: 'm2', containerId: 'c', frame: frame(0, 160, 200, 30), textStyle: STYLE }),
      ],
      containers: [{ id: 'c', maxHeight: 300, y: 100, memberInputIds: ['m1', 'm2'] }],
    });
    const frames = computeTextFrames(
      variant,
      { m1: { value: 'hidden text', hidden: true }, m2: { value: '', hidden: false } },
      measureByLength
    );
    // m2 anchors at the container top; m1 collapses onto m2's top.
    expect(frames['m2']).toEqual(frame(0, 100, 200, 30));
    expect(frames['m1']).toEqual(frame(0, 100, 200, 0));
  });

  it('ignores the hidden flag of a non-hidable member (render would too)', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'm1', hidable: false, containerId: 'c', frame: frame(0, 100, 200, 40), textStyle: STYLE }),
        makeInput({ id: 'm2', containerId: 'c', frame: frame(0, 160, 200, 30), textStyle: STYLE }),
      ],
      containers: [{ id: 'c', maxHeight: 300, y: 100, memberInputIds: ['m1', 'm2'] }],
    });
    const frames = computeTextFrames(
      variant,
      { m1: { value: '', hidden: true }, m2: { value: '', hidden: false } },
      measureByLength
    );
    expect(frames['m1']).toEqual(frame(0, 100, 200, 40));
    expect(frames['m2']).toEqual(frame(0, 160, 200, 30));
  });

  it('leaves a container with fewer than two framed members alone', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'm1', containerId: 'c', frame: frame(0, 100, 200, 40), textStyle: STYLE }),
        makeInput({ id: 'm2', containerId: 'c', frame: null, textStyle: STYLE }),
      ],
      containers: [{ id: 'c', maxHeight: 300, y: 100, memberInputIds: ['m1', 'm2'] }],
    });
    const frames = computeTextFrames(
      variant,
      { m1: { value: 'longer text here', hidden: false } },
      measureByLength
    );
    // Height still re-measured, but no reflow happens (y untouched).
    expect(frames['m1']).toEqual(frame(0, 100, 200, 160));
  });

  it('applies a uniform gap instead of the designed gaps when set', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'm1', containerId: 'c', frame: frame(0, 100, 200, 40), textStyle: STYLE }),
        makeInput({ id: 'm2', containerId: 'c', frame: frame(0, 200, 200, 30), textStyle: STYLE }),
      ],
      containers: [
        { id: 'c', maxHeight: 300, y: 100, memberInputIds: ['m1', 'm2'], gap: 8 },
      ],
    });
    const frames = computeTextFrames(
      variant,
      { m1: { value: '', hidden: false }, m2: { value: '', hidden: false } },
      measureByLength
    );
    // Designed gap 60 is replaced by the uniform 8: m2 sits at 100+40+8.
    expect(frames['m2']).toEqual(frame(0, 148, 200, 30));
  });

  it('nested: child growth pushes the sibling section, overflow reports the root', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'h1', containerId: 's1', frame: frame(0, 10, 200, 20), textStyle: STYLE }),
        makeInput({ id: 't1', containerId: 's1', frame: frame(0, 40, 200, 30), textStyle: STYLE }),
        makeInput({ id: 'h2', containerId: 's2', frame: frame(0, 120, 200, 20), textStyle: STYLE }),
        makeInput({ id: 't2', containerId: 's2', frame: frame(0, 150, 200, 30), textStyle: STYLE }),
      ],
      containers: [
        // Child maxHeight is tiny on purpose: nested bounds are NOT enforced.
        { id: 's1', maxHeight: 10, y: 10, memberInputIds: ['h1', 't1'], nested: true },
        { id: 's2', maxHeight: 70, y: 120, memberInputIds: ['h2', 't2'], nested: true },
        {
          id: 'p',
          maxHeight: 200,
          y: 10,
          memberInputIds: [],
          memberContainerIds: ['s1', 's2'],
        },
      ],
    });
    // t1 measures 9 chars × 10 = 90 (designed 30, +60) → section 1 bottom
    // 40+90=130; designed inter-section gap 120−70=50 → section 2 at 180.
    const layout = computeTextLayout(
      variant,
      {
        h1: { value: '', hidden: false },
        t1: { value: 'ninechars', hidden: false },
        h2: { value: '', hidden: false },
        t2: { value: '', hidden: false },
      },
      measureByLength
    );
    expect(layout.frames['h2']).toEqual(frame(0, 180, 200, 20));
    expect(layout.frames['t2']).toEqual(frame(0, 210, 200, 30));
    // Content bottom 240 > 10+200 → overflow 30 on the ROOT (children never).
    expect(layout.overflows).toEqual([{ containerId: 'p', overflowPx: 30 }]);
  });

  it('sibling push: a growing top-level container pushes the one below it', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'a', containerId: 'S1', frame: frame(0, 0, 200, 30), textStyle: STYLE }),
        makeInput({ id: 'b', containerId: 'S2', frame: frame(0, 100, 200, 30), textStyle: STYLE }),
      ],
      containers: [
        { id: 'S1', maxHeight: 500, y: 0, memberInputIds: ['a'] },
        { id: 'S2', maxHeight: 500, y: 100, memberInputIds: ['b'] },
      ],
    });
    // a measures 4×10=40 → bottom 40 < 100 → whitespace absorbs, no move.
    let frames = computeTextFrames(
      variant,
      { a: { value: 'four', hidden: false }, b: { value: '', hidden: false } },
      measureByLength
    );
    expect(frames['b'].y).toBe(100);

    // a measures 15×10=150 → bottom 150 > 100 → b pushed to 150 (contact).
    frames = computeTextFrames(
      variant,
      { a: { value: 'fifteen chars!!', hidden: false }, b: { value: '', hidden: false } },
      measureByLength
    );
    expect(frames['b'].y).toBe(150);
  });

  it('sibling push honors spaceAfter and side-by-side columns never interact', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'a', containerId: 'S1', frame: frame(0, 0, 200, 30), textStyle: STYLE }),
        makeInput({ id: 'b', containerId: 'S2', frame: frame(0, 100, 200, 30), textStyle: STYLE }),
        makeInput({ id: 'c', containerId: 'COL', frame: frame(500, 20, 200, 30), textStyle: STYLE }),
      ],
      containers: [
        { id: 'S1', maxHeight: 500, y: 0, memberInputIds: ['a'], spaceAfter: 25 },
        { id: 'S2', maxHeight: 500, y: 100, memberInputIds: ['b'] },
        { id: 'COL', maxHeight: 500, y: 20, memberInputIds: ['c'] }, // x-disjoint column
      ],
    });
    const frames = computeTextFrames(
      variant,
      {
        a: { value: 'fifteen chars!!', hidden: false },
        b: { value: '', hidden: false },
        c: { value: '', hidden: false },
      },
      measureByLength
    );
    // b lands at S1 bottom (150) + spaceAfter 25.
    expect(frames['b'].y).toBe(175);
    // The disjoint column is untouched.
    expect(frames['c'].y).toBe(20);
  });

  it('reports canvas-bottom overflow on the container pushed off the page', () => {
    const variant = makeVariant({
      height: 300,
      inputs: [
        makeInput({ id: 'a', containerId: 'S1', frame: frame(0, 0, 200, 30), textStyle: STYLE }),
        makeInput({ id: 'b', containerId: 'S2', frame: frame(0, 200, 200, 60), textStyle: STYLE }),
      ],
      containers: [
        { id: 'S1', maxHeight: 500, y: 0, memberInputIds: ['a'] },
        { id: 'S2', maxHeight: 500, y: 200, memberInputIds: ['b'], spaceAfter: 20 },
      ],
    });
    // a measures 25×10=250 → S2 pushed to 250; its content ends at 310, the
    // limit is 300−20=280 → overflow 30 reported on S2.
    const layout = computeTextLayout(
      variant,
      { a: { value: 'x'.repeat(25), hidden: false }, b: { value: '', hidden: false } },
      measureByLength
    );
    expect(layout.overflows).toEqual([{ containerId: 'S2', overflowPx: 30 }]);
  });
});

// ---------- rich runs -----------------------------------------------------------

describe('computeTextFrames with rich runs', () => {
  it('measures a styled rich value as segments (uppercase + maxLength applied)', () => {
    const seen: MeasurableText[] = [];
    const spy = (value: MeasurableText) => {
      seen.push(value);
      return measureByLength(value);
    };
    const variant = makeVariant({
      inputs: [
        makeInput({
          id: 'r',
          richText: true,
          uppercase: true,
          maxLength: 7,
          frame: frame(0, 0, 200, 30),
          textStyle: STYLE,
        }),
      ],
    });
    const frames = computeTextFrames(
      variant,
      {
        r: {
          value: 'hello you',
          hidden: false,
          runs: [
            { text: 'hello ', fontFamily: null, color: null, underline: false },
            { text: 'you', fontFamily: 'Rubik (Rubik Bold)', color: null, underline: false },
          ],
        },
      },
      spy
    );
    // Truncated to 7 code points ("hello y"), uppercased, family preserved per segment.
    expect(seen).toEqual([
      [
        { text: 'HELLO ', fontFamily: null },
        { text: 'Y', fontFamily: 'Rubik (Rubik Bold)' },
      ],
    ]);
    expect(frames['r']).toEqual(frame(0, 0, 200, 70));
  });

  it('treats unstyled runs as the plain value path', () => {
    const seen: MeasurableText[] = [];
    const spy = (value: MeasurableText) => {
      seen.push(value);
      return measureByLength(value);
    };
    const variant = makeVariant({
      inputs: [makeInput({ id: 'r', richText: true, frame: frame(0, 0, 200, 30), textStyle: STYLE })],
    });
    computeTextFrames(
      variant,
      {
        r: {
          value: 'plain',
          hidden: false,
          runs: [{ text: 'plain', fontFamily: null, color: null, underline: false }],
        },
      },
      spy
    );
    expect(seen).toEqual(['plain']);
  });
});

// ---------- computeTextLayout (overflow prediction) ----------------------------

describe('computeTextLayout', () => {
  it('predicts container overflow with the render tolerance and rounding', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'm1', containerId: 'c', frame: frame(0, 100, 200, 40), textStyle: STYLE }),
        makeInput({ id: 'm2', containerId: 'c', frame: frame(0, 160, 200, 30), textStyle: STYLE }),
      ],
      containers: [{ id: 'c', maxHeight: 100, y: 100, memberInputIds: ['m1', 'm2'] }],
    });
    // m1: 12 chars → 120px (designed 40): flow = 100..220, gap 20, m2 240..270.
    // Limit = 100 + 100 = 200 → overflow 70.
    const { frames, overflows } = computeTextLayout(
      variant,
      { m1: { value: 'twelve chars', hidden: false }, m2: { value: '', hidden: false } },
      measureByLength
    );
    expect(frames['m2'].y).toBe(240);
    expect(overflows).toEqual([{ containerId: 'c', overflowPx: 70 }]);
  });

  it('reports no overflow when the flow fits', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'm1', containerId: 'c', frame: frame(0, 100, 200, 40), textStyle: STYLE }),
        makeInput({ id: 'm2', containerId: 'c', frame: frame(0, 160, 200, 30), textStyle: STYLE }),
      ],
      containers: [{ id: 'c', maxHeight: 300, y: 100, memberInputIds: ['m1', 'm2'] }],
    });
    const { overflows } = computeTextLayout(
      variant,
      { m1: { value: 'ok', hidden: false }, m2: { value: '', hidden: false } },
      measureByLength
    );
    expect(overflows).toEqual([]);
  });

  it('hiding a member can resolve the overflow', () => {
    const variant = makeVariant({
      inputs: [
        makeInput({ id: 'm1', hidable: true, containerId: 'c', frame: frame(0, 100, 200, 40), textStyle: STYLE }),
        makeInput({ id: 'm2', containerId: 'c', frame: frame(0, 160, 200, 30), textStyle: STYLE }),
      ],
      containers: [{ id: 'c', maxHeight: 100, y: 100, memberInputIds: ['m1', 'm2'] }],
    });
    const { overflows } = computeTextLayout(
      variant,
      { m1: { value: 'twelve chars', hidden: true }, m2: { value: '', hidden: false } },
      measureByLength
    );
    expect(overflows).toEqual([]);
  });
});

// ---------- measureWrappedTextHeight (no canvas in the node test env) ---------

describe('measureWrappedTextHeight', () => {
  it('returns null when no canvas 2D context is available', () => {
    expect(measureWrappedTextHeight('text', 100, STYLE)).toBeNull();
  });
});
