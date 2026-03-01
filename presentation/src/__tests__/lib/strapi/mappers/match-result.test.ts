import { describe, it, expect } from 'vitest';
import { mapMatchResult } from '../../../../lib/strapi/mappers/match-result';

function makeRawMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    documentId: 'match-1',
    homeTeam: 'FK Frýdek-Místek',
    awayTeam: 'Baník Ostrava',
    homeScore: 2,
    awayScore: 1,
    matchDate: '2025-03-15',
    matchTime: '17:00',
    venue: 'Stadion',
    round: 5,
    competitionName: 'Divize',
    competitionCode: 'DIV-E',
    season: 2025,
    period: 'jaro',
    organizingBody: 'FAČR',
    facrId: 'facr-123',
    categories: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('mapMatchResult', () => {
  it('maps finished match (both scores present)', () => {
    const result = mapMatchResult(makeRawMatch());

    expect(result.id).toBe(1);
    expect(result.homeTeam).toBe('FK Frýdek-Místek');
    expect(result.awayTeam).toBe('Baník Ostrava');
    expect(result.homeScore).toBe(2);
    expect(result.awayScore).toBe(1);
    expect(result.status).toBe('finished');
    expect(result.competitionName).toBe('Divize');
  });

  it('maps upcoming match (null scores)', () => {
    const result = mapMatchResult(makeRawMatch({
      homeScore: null,
      awayScore: null,
    }));

    expect(result.status).toBe('upcoming');
    expect(result.homeScore).toBeNull();
    expect(result.awayScore).toBeNull();
  });

  it('formats Czech date correctly for Saturday', () => {
    // 2025-03-15 is a Saturday
    const result = mapMatchResult(makeRawMatch({ matchDate: '2025-03-15' }));
    expect(result.matchDate).toBe('So 15. 3.');
  });

  it('formats Czech date correctly for Monday', () => {
    // 2025-03-17 is a Monday
    const result = mapMatchResult(makeRawMatch({ matchDate: '2025-03-17' }));
    expect(result.matchDate).toBe('Po 17. 3.');
  });

  it('defaults matchTime to empty string', () => {
    const result = mapMatchResult(makeRawMatch({ matchTime: null }));
    expect(result.matchTime).toBe('');
  });

  it('defaults venue to empty string', () => {
    const result = mapMatchResult(makeRawMatch({ venue: null }));
    expect(result.venue).toBe('');
  });

  it('defaults competitionName to empty string', () => {
    const result = mapMatchResult(makeRawMatch({ competitionName: null }));
    expect(result.competitionName).toBe('');
  });
});
