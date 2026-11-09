import { describe, it, expect } from 'vitest';
import golden from '../fixtures/element-move-parity.json';
import {
  bounds,
  clamp,
  clampToRange,
  deltas,
  describeLimits,
  normalize,
  round2,
  scale,
  sanitizeOffsets,
} from '@/lib/social-export/element-move';
import type { MovableElementDTO } from '@/lib/social-export/api-types';

/**
 * Parity with WBoost's `assets/editor/element_move.js` — itself pinned to the
 * PHP resolver by `tests/Value/ElementMoveParityTest.php`. The fixture holds
 * the very same case set, run through the WBoost JS (see its `source`).
 */
type Case = Record<string, unknown>;
const cases = golden.cases as unknown as Record<string, Case[]>;
const results = golden.results as unknown as Record<string, unknown[]>;

describe('element-move parity with WBoost', () => {
  it('normalize', () => {
    expect(cases.normalize.map((raw) => normalize(raw))).toEqual(results.normalize);
  });

  it('scale', () => {
    expect(cases.scale.map((c) => scale(c.allowance, c.rx as number, c.ry as number))).toEqual(results.scale);
  });

  it('bounds', () => {
    expect(
      cases.bounds.map((c) => bounds(c.allowance, c.frame as never, c.width as number, c.height as number))
    ).toEqual(results.bounds);
  });

  it('clamp', () => {
    expect(results.clamp).toHaveLength(150);
    expect(
      cases.clamp.map((c) =>
        clamp(c.allowance, c.x as number, c.y as number, c.frame as never, c.width as number, c.height as number)
      )
    ).toEqual(results.clamp);
  });

  it('deltas', () => {
    expect(cases.deltas.map((c) => deltas(c.containers as never, c.offsets as never))).toEqual(results.deltas);
  });
});

describe('round2', () => {
  it('rounds half away from zero to 1/100 and never yields -0', () => {
    expect(round2(0.125)).toBe(0.13);
    expect(round2(-0.125)).toBe(-0.13);
    // Plain IEEE: 1.005 * 100 is 100.4999…, exactly like WBoost (no epsilon tricks).
    expect(round2(1.005)).toBe(1);
    expect(Object.is(round2(-0.004), 0)).toBe(true);
    expect(round2(Number.NaN)).toBe(0);
  });
});

const element = (overrides: Partial<MovableElementDTO> = {}): MovableElementDTO => ({
  id: 'el',
  kind: 'text',
  name: 'Nadpis',
  frame: { x: 80, y: 120, width: 920, height: 140 },
  vertical: true,
  horizontal: false,
  limits: { up: 15, down: null, left: null, right: null },
  range: { minX: 0, maxX: 0, minY: -15, maxY: 1090 },
  memberIds: [],
  ...overrides,
});

describe('clampToRange (the server range is the bound)', () => {
  it('clamps both axes and rounds to 1/100', () => {
    expect(clampToRange(element().range, 40, -20.123)).toEqual({ x: 0, y: -15 });
    expect(clampToRange(element().range, 0, 33.3333)).toEqual({ x: 0, y: 33.33 });
  });

  it('treats non-finite input as 0', () => {
    expect(clampToRange(element().range, Number.NaN, Number.POSITIVE_INFINITY)).toEqual({ x: 0, y: 0 });
  });
});

describe('sanitizeOffsets', () => {
  it('keeps only movable ids, clamps, drops zero moves', () => {
    const movables = [element(), element({ id: 'other', horizontal: true, range: { minX: -50, maxX: 50, minY: 0, maxY: 0 } })];
    expect(
      sanitizeOffsets(movables, {
        el: { x: 9, y: 2000 },
        other: { x: 0, y: 0 },
        gone: { x: 5, y: 5 },
      })
    ).toEqual({ el: { x: 0, y: 1090 } });
  });

  it('accepts a missing map', () => {
    expect(sanitizeOffsets([element()], undefined)).toEqual({});
  });
});

describe('describeLimits', () => {
  it('reads the designer limits per allowed axis (Czech)', () => {
    expect(describeLimits(element())).toBe('nahoru až 15 px · dolů bez omezení');
    expect(
      describeLimits(element({ vertical: false, horizontal: true, limits: { up: null, down: null, left: 0, right: 40 } }))
    ).toBe('doleva ne · doprava až 40 px');
  });
});
