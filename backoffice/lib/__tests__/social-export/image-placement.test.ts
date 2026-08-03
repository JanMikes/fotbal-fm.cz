import { describe, it, expect } from 'vitest';
import {
  containScale,
  coverScale,
  coverGhostStyle,
  ghostStyle,
  offsetFromRatio,
  panFromDrag,
  ratioFromOffset,
  NEUTRAL_PLACEMENT,
} from '@/lib/social-export/image-placement';

const FRAME = { x: 100, y: 50, width: 400, height: 300 };

describe('containScale', () => {
  it('fits a wide picture by width', () => {
    expect(containScale(FRAME, { width: 800, height: 400 })).toBe(0.5);
  });

  it('fits a tall picture by height', () => {
    expect(containScale(FRAME, { width: 300, height: 1200 })).toBe(0.25);
  });

  it('never returns a non-positive scale for a degenerate size', () => {
    expect(containScale(FRAME, { width: 0, height: 0 })).toBeGreaterThan(0);
  });
});

describe('coverScale', () => {
  it('is the LEAST scale that covers the frame (Math.max of the two ratios)', () => {
    // 800×400 in a 400×300 frame: width fits at 0.5, height needs 0.75 → 0.75.
    expect(coverScale(FRAME, { width: 800, height: 400 })).toBe(0.75);
    // 300×1200: height fits at 0.25, width needs 4/3 → 4/3.
    expect(coverScale(FRAME, { width: 300, height: 1200 })).toBeCloseTo(4 / 3);
  });

  it('never returns a non-positive scale for a degenerate size', () => {
    expect(coverScale(FRAME, { width: 0, height: 0 })).toBeGreaterThan(0);
  });
});

describe('coverGhostStyle (background slots)', () => {
  it('cover-fits anchored top-left — overflow crops away bottom-right', () => {
    // 800×400 in a 400×300 frame → cover 0.75 → 600×300 drawn from (0,0); the
    // 200 px of overflow hang off the RIGHT edge (clipped by the frame box).
    const style = coverGhostStyle(FRAME, { width: 800, height: 400 }, 1);

    expect(style).toEqual({
      width: '600px',
      height: '300px',
      left: '0px',
      top: '0px',
      transform: 'none',
    });
  });

  it('scales everything by the display factor, anchor staying at the corner', () => {
    const style = coverGhostStyle(FRAME, { width: 800, height: 400 }, 0.5);

    expect(style.width).toBe('300px');
    expect(style.height).toBe('150px');
    expect(style.left).toBe('0px');
    expect(style.top).toBe('0px');
  });
});

describe('pan conversions', () => {
  it('round-trips px ↔ fraction against the same frame edge', () => {
    expect(offsetFromRatio(0.25, 400)).toBe(100);
    expect(ratioFromOffset(100, 400)).toBe(0.25);
  });

  it('treats a zero-size frame as no pan rather than dividing by zero', () => {
    expect(ratioFromOffset(50, 0)).toBe(0);
  });

  it('normalises a drag by the frame size ON SCREEN, so preview zoom cancels out', () => {
    // 400 canvas px wide. At 50% the frame is 200 display px, so a 100 px drag
    // is half the frame; at 100% the same half is 200 px.
    expect(panFromDrag(FRAME, 0.5, 100, 0).offsetXRatio).toBe(0.5);
    expect(panFromDrag(FRAME, 1, 200, 0).offsetXRatio).toBe(0.5);
  });
});

describe('ghostStyle', () => {
  it('centres a contained picture in the frame', () => {
    // 800×400 in a 400×300 frame → contain 0.5 → 400×200 drawn, centred.
    const style = ghostStyle(FRAME, { width: 800, height: 400 }, NEUTRAL_PLACEMENT, 1);

    expect(style).toEqual({
      width: '400px',
      height: '200px',
      left: '200px', // frame.width / 2, relative to the box
      top: '150px', // frame.height / 2
      transform: 'translate(-50%, -50%) rotate(0deg)',
    });
  });

  it('applies zoom, pan and rotation the way the server does', () => {
    const style = ghostStyle(
      FRAME,
      { width: 800, height: 400 },
      { scale: 2, offsetXRatio: 0.25, offsetYRatio: -0.1, rotation: 15 },
      1
    );

    expect(style.width).toBe('800px'); // 800 × (0.5 contain × 2)
    expect(style.left).toBe('300px'); // 200 + 0.25 × 400
    expect(style.top).toBe('120px'); // 150 − 0.10 × 300
    expect(style.transform).toBe('translate(-50%, -50%) rotate(15deg)');
  });

  it('scales everything by the display factor', () => {
    const style = ghostStyle(FRAME, { width: 800, height: 400 }, NEUTRAL_PLACEMENT, 0.5);

    expect(style).toEqual({
      width: '200px',
      height: '100px',
      left: '100px',
      top: '75px',
      transform: 'translate(-50%, -50%) rotate(0deg)',
    });
  });

  it('keeps one crop intent across variants whose frames differ', () => {
    // The SAME placement in a square and a narrow frame: both land a quarter of
    // their own frame right of centre. This is why the pan is stored as a
    // fraction — pixels would carry the square's crop into the story wrongly.
    const placement = { ...NEUTRAL_PLACEMENT, offsetXRatio: 0.25 };
    const square = ghostStyle({ x: 0, y: 0, width: 400, height: 400 }, { width: 800, height: 800 }, placement, 1);
    const story = ghostStyle({ x: 0, y: 0, width: 200, height: 600 }, { width: 800, height: 800 }, placement, 1);

    expect(square.left).toBe('300px'); // 200 + 0.25 × 400
    expect(story.left).toBe('150px'); // 100 + 0.25 × 200
  });
});
