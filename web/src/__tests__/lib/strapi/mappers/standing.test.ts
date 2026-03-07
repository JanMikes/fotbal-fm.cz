import { describe, it, expect } from 'vitest';
import { mapStanding } from '../../../../lib/strapi/mappers/standing';

function makeRawStanding(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    documentId: 'standing-1',
    position: 3,
    team: { id: 1, documentId: 'team-1', name: 'FK Frýdek-Místek' },
    matchesPlayed: 15,
    wins: 10,
    draws: 3,
    losses: 2,
    goalsFor: 30,
    goalsAgainst: 12,
    points: 33,
    competitionCode: 'A1A',
    season: 2025,
    tournament: null,
    categories: null,
    ...overrides,
  };
}

describe('mapStanding', () => {
  it('maps all fields from raw standing', () => {
    const result = mapStanding(makeRawStanding());

    expect(result.position).toBe(3);
    expect(result.teamName).toBe('FK Frýdek-Místek');
    expect(result.matchesPlayed).toBe(15);
    expect(result.wins).toBe(10);
    expect(result.draws).toBe(3);
    expect(result.losses).toBe(2);
    expect(result.goalsFor).toBe(30);
    expect(result.goalsAgainst).toBe(12);
    expect(result.points).toBe(33);
    expect(result.tournamentName).toBeNull();
  });

  it('extracts team name from relation object', () => {
    const result = mapStanding(makeRawStanding({
      team: { id: 5, documentId: 'team-5', name: 'Baník Ostrava' },
    }));
    expect(result.teamName).toBe('Baník Ostrava');
  });

  it('defaults teamName to empty string when team is null', () => {
    const result = mapStanding(makeRawStanding({ team: null }));
    expect(result.teamName).toBe('');
  });

  it('maps tournament name when present', () => {
    const result = mapStanding(makeRawStanding({
      tournament: { id: 1, documentId: 'tourn-1', name: 'Divize E' },
    }));
    expect(result.tournamentName).toBe('Divize E');
  });
});
