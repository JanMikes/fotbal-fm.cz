import type { StrapiRawStanding } from '../types/strapi.js';
import { mapTeam } from './shared.js';

export function mapStanding(raw: StrapiRawStanding) {
  return {
    position: raw.position,
    team: mapTeam(raw.team),
    matchesPlayed: raw.matchesPlayed,
    wins: raw.wins,
    draws: raw.draws,
    losses: raw.losses,
    goalsFor: raw.goalsFor,
    goalsAgainst: raw.goalsAgainst,
    points: raw.points,
    tournamentName: raw.tournament?.name ?? null,
  };
}
