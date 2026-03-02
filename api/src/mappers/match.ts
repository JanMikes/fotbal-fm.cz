import type { StrapiRawMatch } from '../types/strapi.js';
import { mapCategories, mapTeam } from './shared.js';

export function mapMatch(raw: StrapiRawMatch) {
  return {
    documentId: raw.documentId,
    homeTeam: mapTeam(raw.homeTeam),
    awayTeam: mapTeam(raw.awayTeam),
    homeScore: raw.homeScore ?? null,
    awayScore: raw.awayScore ?? null,
    matchDate: raw.matchDate,
    matchTime: raw.matchTime ?? null,
    venue: raw.venue ?? null,
    round: raw.round ?? null,
    competitionName: raw.competitionName ?? null,
    tournamentName: raw.tournament?.name ?? null,
    status: (raw.homeScore !== null ? 'finished' : 'upcoming') as 'upcoming' | 'finished',
    categories: mapCategories(raw.categories),
  };
}
