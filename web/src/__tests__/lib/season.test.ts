import { describe, it, expect } from 'vitest';
import { seasonFromDate, matchSeason, formatSeason, seasonDateRange } from '../../lib/season';

describe('seasonFromDate', () => {
  it('assigns July and later to the starting season', () => {
    expect(seasonFromDate('2025-07-01')).toBe(2025);
    expect(seasonFromDate('2025-12-31')).toBe(2025);
  });

  it('assigns January–June to the previous starting year', () => {
    expect(seasonFromDate('2026-01-01')).toBe(2025);
    expect(seasonFromDate('2026-06-30')).toBe(2025);
  });
});

describe('matchSeason', () => {
  it('prefers the synced season field', () => {
    expect(matchSeason({ season: 2025, rawMatchDate: '2026-08-15' })).toBe(2025);
  });

  it('derives from date when season is null (manual matches)', () => {
    expect(matchSeason({ season: null, rawMatchDate: '2026-03-15' })).toBe(2025);
    expect(matchSeason({ season: null, rawMatchDate: '2026-08-15' })).toBe(2026);
  });
});

describe('formatSeason', () => {
  it('formats start year as full season label', () => {
    expect(formatSeason(2025)).toBe('2025/2026');
  });
});

describe('seasonDateRange', () => {
  it('spans 1st July to 30th June', () => {
    expect(seasonDateRange(2026)).toEqual(['2026-07-01', '2027-06-30']);
  });
});
