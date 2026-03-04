import type { Standing } from '@/lib/types';
import type { StrapiRawStanding } from '../types';
import { mapMedia } from './shared';

export function mapStanding(raw: StrapiRawStanding): Standing {
  return {
    position: raw.position,
    teamName: raw.team?.name ?? '',
    teamLogo: mapMedia(raw.team?.logo),
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
