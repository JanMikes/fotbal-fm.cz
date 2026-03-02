import { describe, it, expect } from 'vitest';
import { mapMatch } from '../../../../lib/strapi/mappers/match';

function makeRawMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    documentId: 'match-1',
    homeTeam: { id: 1, documentId: 'team-1', name: 'FK Frýdek-Místek' },
    awayTeam: { id: 2, documentId: 'team-2', name: 'Baník Ostrava' },
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
    tournament: null,
    categories: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('mapMatch', () => {
  it('maps finished match (both scores present)', () => {
    const result = mapMatch(makeRawMatch());

    expect(result.id).toBe(1);
    expect(result.homeTeam).toBe('FK Frýdek-Místek');
    expect(result.awayTeam).toBe('Baník Ostrava');
    expect(result.homeScore).toBe(2);
    expect(result.awayScore).toBe(1);
    expect(result.status).toBe('finished');
    expect(result.competitionName).toBe('Divize');
    expect(result.tournamentName).toBeNull();
  });

  it('maps upcoming match (null scores)', () => {
    const result = mapMatch(makeRawMatch({
      homeScore: null,
      awayScore: null,
    }));

    expect(result.status).toBe('upcoming');
    expect(result.homeScore).toBeNull();
    expect(result.awayScore).toBeNull();
  });

  it('formats Czech date correctly for Saturday', () => {
    // 2025-03-15 is a Saturday
    const result = mapMatch(makeRawMatch({ matchDate: '2025-03-15' }));
    expect(result.matchDate).toBe('So 15. 3.');
  });

  it('formats Czech date correctly for Monday', () => {
    // 2025-03-17 is a Monday
    const result = mapMatch(makeRawMatch({ matchDate: '2025-03-17' }));
    expect(result.matchDate).toBe('Po 17. 3.');
  });

  it('defaults matchTime to empty string', () => {
    const result = mapMatch(makeRawMatch({ matchTime: null }));
    expect(result.matchTime).toBe('');
  });

  it('defaults venue to empty string', () => {
    const result = mapMatch(makeRawMatch({ venue: null }));
    expect(result.venue).toBe('');
  });

  it('defaults competitionName to empty string', () => {
    const result = mapMatch(makeRawMatch({ competitionName: null }));
    expect(result.competitionName).toBe('');
  });

  it('maps tournament name when present', () => {
    const result = mapMatch(makeRawMatch({
      tournament: { id: 1, documentId: 'tourn-1', name: 'Zimní turnaj' },
    }));
    expect(result.tournamentName).toBe('Zimní turnaj');
  });
});
