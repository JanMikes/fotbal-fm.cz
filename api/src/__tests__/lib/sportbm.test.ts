import { describe, it, expect } from 'vitest';
import { toShirtNumber } from '../../lib/sportbm.js';

describe('toShirtNumber', () => {
  it.each([
    [9, 9],
    ['9', 9],
    ['15', 15],
  ])('reads %j as %j', (input, expected) => {
    expect(toShirtNumber(input)).toBe(expected);
  });

  it.each([null, undefined, '', 0, '0', '7A', 'abc', 1.5, -3])('treats %j as no number', (input) => {
    expect(toShirtNumber(input)).toBeNull();
  });
});
