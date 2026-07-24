import { describe, it, expect } from 'vitest';
import { normalizeClubTeamName } from '../../lib/team-name.js';

describe('normalizeClubTeamName', () => {
  it.each([
    ['Frýdek-Místek', 'FK Frýdek-Místek'],
    ['FK Frýdek-Místek', 'FK Frýdek-Místek'],
    ['FK Frýdek Místek', 'FK Frýdek-Místek'],
    ['FK F-M', 'FK Frýdek-Místek'],
    ['FK FM', 'FK Frýdek-Místek'],
    ['FK Frýdek-Místek z.s.', 'FK Frýdek-Místek'],
    ['FK Frýdek-Místek, z.s.', 'FK Frýdek-Místek'],
    ['FK Frýdek-Místek 1921', 'FK Frýdek-Místek'],
    ['FK Frýdek-Místek 1921 a.s.', 'FK Frýdek-Místek'],
  ])('unifies base variant %s', (input, expected) => {
    expect(normalizeClubTeamName(input)).toBe(expected);
  });

  it.each([
    ['Frýdek-Místek B', 'FK Frýdek-Místek B'],
    ['Frýdek-místek B', 'FK Frýdek-Místek B'],
    ['FK FM B', 'FK Frýdek-Místek B'],
    ['FK FM A', 'FK Frýdek-Místek A'],
    ['FK Frýdek-Místek 1921 B', 'FK Frýdek-Místek B'],
  ])('keeps the squad letter: %s', (input, expected) => {
    expect(normalizeClubTeamName(input)).toBe(expected);
  });

  it.each([
    ['FK F-M U19', 'FK Frýdek-Místek U19'],
    ['FK Frýdek-Místek U10', 'FK Frýdek-Místek U10'],
    ['FK Frýdek Místek U11', 'FK Frýdek-Místek U11'],
    ['FK Frýdek Místek U8', 'FK Frýdek-Místek U8'],
    ['FK Frýdek-Místek U8', 'FK Frýdek-Místek U8'],
  ])('keeps the youth squad suffix: %s', (input, expected) => {
    expect(normalizeClubTeamName(input)).toBe(expected);
  });

  it.each([
    'F-M/Nošovice-Lhoty', // joint squad with another club
    'Fotbalpoint FM', // a different club
    'Fotbalpoint FM A',
    'Fotbalpoint FM B',
    'Fotbal FM',
    '1.FC Poruba',
    'FK Kozlovice',
    '1.BFK Frýdlant n.O., z.s.',
    'Bílovec muži',
    'FC Hlučín',
  ])('leaves other teams unchanged: %s', (name) => {
    expect(normalizeClubTeamName(name)).toBe(name);
  });

  it('collapses extra whitespace before matching', () => {
    expect(normalizeClubTeamName('  FK  Frýdek-Místek   B ')).toBe('FK Frýdek-Místek B');
  });
});
