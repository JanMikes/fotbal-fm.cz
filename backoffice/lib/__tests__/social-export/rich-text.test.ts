import { describe, it, expect } from 'vitest';
import {
  canonicalNewlines,
  codePointLength,
  normalizeRuns,
  plainText,
  runsFromPlain,
  truncateRuns,
} from '@/lib/social-export/rich-text';

const run = (text: string, overrides: Record<string, unknown> = {}) => ({
  text,
  fontFamily: null,
  color: null,
  underline: false,
  ...overrides,
});

describe('rich-text newlines', () => {
  it('canonicalizes CRLF and lone CR to \\n', () => {
    expect(canonicalNewlines('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });

  it('keeps hard line breaks in runsFromPlain', () => {
    expect(runsFromPlain('First\r\nSecond\n\nThird')).toEqual([run('First\nSecond\n\nThird')]);
    expect(runsFromPlain('')).toEqual([]);
  });

  it('keeps (canonical) line breaks when normalizing runs', () => {
    const runs = normalizeRuns([
      run('Hello\r\n'),
      run('world', { color: '#ff0000' }),
      run('\rnext', { color: '#ff0000' }),
    ]);
    expect(runs).toEqual([run('Hello\n'), run('world\nnext', { color: '#ff0000' })]);
    expect(plainText(runs!)).toBe('Hello\nworld\nnext');
  });

  it('keeps a run consisting of just a line break', () => {
    expect(normalizeRuns([run('a'), run('\n', { underline: true }), run('b')])).toEqual([
      run('a'),
      run('\n', { underline: true }),
      run('b'),
    ]);
  });

  it('counts a line break as one code point and truncates across it', () => {
    const runs = [run('ab\n'), run('😀c', { color: '#000000' })];
    expect(codePointLength(plainText(runs))).toBe(5);
    expect(truncateRuns(runs, 4)).toEqual([run('ab\n'), run('😀', { color: '#000000' })]);
  });
});
