import { describe, expect, it } from 'vitest';
import { parseHexColor } from '@/lib/social-export/hex-color';

describe('parseHexColor', () => {
  it.each([
    ['#AABBCC', '#aabbcc'],
    ['aabbcc', '#aabbcc'],
    ['  #1a8  ', '#11aa88'],
    ['1A8', '#11aa88'],
  ])('normalises %j to %s', (input, expected) => {
    expect(parseHexColor(input)).toBe(expected);
  });

  it.each(['', '#', '#12', '#12345', '#1234567', 'zz1122', 'rgb(0,0,0)', 'red'])(
    'rejects %j',
    (input) => {
      expect(parseHexColor(input)).toBeNull();
    },
  );
});
