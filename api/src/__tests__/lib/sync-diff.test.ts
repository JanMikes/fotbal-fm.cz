import { describe, it, expect } from 'vitest';
import { changedFields, relationId, relationIds } from '../../lib/sync-diff.js';

describe('changedFields', () => {
  const stored = {
    facrId: '2026009U1B0501',
    homeTeam: 'team-home',
    homeScore: 4,
    awayScore: 4,
    matchDate: '2026-09-15',
    matchTime: '14:30',
    round: 5,
    period: null,
    categories: ['cat-u10'],
  };

  it('reports nothing when the payload equals what is stored', () => {
    expect(changedFields(stored, {
      facrId: '2026009U1B0501',
      homeTeam: 'team-home',
      homeScore: 4,
      awayScore: 4,
      matchDate: '2026-09-15',
      matchTime: '14:30',
      round: 5,
      period: '',
      categories: ['cat-u10'],
    })).toEqual([]);
  });

  it('names the fields that differ', () => {
    expect(changedFields(stored, { homeScore: 5, awayScore: 4, matchTime: '15:00' }))
      .toEqual(['homeScore', 'matchTime']);
  });

  it('treats a score FAČR withdrew (null) as a change', () => {
    expect(changedFields(stored, { homeScore: null, awayScore: null }))
      .toEqual(['homeScore', 'awayScore']);
  });

  it('treats a first score as a change', () => {
    expect(changedFields({ homeScore: null, awayScore: null }, { homeScore: 0, awayScore: 0 }))
      .toEqual(['homeScore', 'awayScore']);
  });

  it('does not confuse 0 or false with empty', () => {
    expect(changedFields({ points: null, isActive: null }, { points: 0, isActive: false }))
      .toEqual(['points', 'isActive']);
  });

  it('treats null, undefined, empty string and empty list as the same empty value', () => {
    expect(changedFields(
      { a: null, b: undefined, c: '', d: [] },
      { a: '', b: null, c: null, d: null },
    )).toEqual([]);
  });

  it('skips fields the payload leaves undefined (they are not sent)', () => {
    expect(changedFields(stored, { tournament: undefined, homeScore: 4 })).toEqual([]);
  });

  it('compares a field missing from the stored entry as empty', () => {
    expect(changedFields({}, { tournament: 'tournament-1' })).toEqual(['tournament']);
    expect(changedFields({}, { period: '' })).toEqual([]);
  });

  it('compares relation lists as sets', () => {
    expect(changedFields({ categories: ['b', 'a'] }, { categories: ['a', 'b'] })).toEqual([]);
    expect(changedFields({ categories: ['a', 'b'] }, { categories: ['a'] })).toEqual(['categories']);
  });

  it('does not equate a number with its string form', () => {
    expect(changedFields({ season: '2026' }, { season: 2026 })).toEqual(['season']);
  });
});

describe('relationId', () => {
  it('returns the documentId of a populated relation', () => {
    expect(relationId({ documentId: 'abc' })).toBe('abc');
  });

  it('returns null for an unset relation', () => {
    expect(relationId(null)).toBeNull();
    expect(relationId(undefined)).toBeNull();
  });
});

describe('relationIds', () => {
  it('returns the documentIds of a populated list', () => {
    expect(relationIds([{ documentId: 'a' }, { documentId: 'b' }])).toEqual(['a', 'b']);
  });

  it('returns an empty list for an unset relation', () => {
    expect(relationIds(null)).toEqual([]);
    expect(relationIds(undefined)).toEqual([]);
  });
});
