import { describe, it, expect } from 'vitest';
import { isCupCompetition } from '../../lib/competition';

describe('isCupCompetition', () => {
  it('treats Z-prefixed FAČR codes as cups', () => {
    expect(isCupCompetition('Z1A', 'MOL Cup - 2.předkolo')).toBe(true);
    expect(isCupCompetition('Z1B', null)).toBe(true);
  });

  it('treats league codes as leagues', () => {
    expect(isCupCompetition('A1A', '3. Moravskoslezská fotbalová liga')).toBe(false);
    expect(isCupCompetition('A2F', '4. Moravskoslezská liga sk. F')).toBe(false);
    expect(isCupCompetition('C1A', '2.MSDL st.')).toBe(false);
  });

  it('falls back to the tournament name for non-Z cup codes', () => {
    expect(isCupCompetition('P1A', 'Pohár MSKFS')).toBe(true);
    expect(isCupCompetition('P1A', 'MOL CUP')).toBe(true);
  });
});
