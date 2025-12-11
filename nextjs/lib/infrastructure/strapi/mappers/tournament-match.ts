/**
 * Tournament match mapper.
 * Transforms raw Strapi tournament match data into domain TournamentMatch type.
 */

import { z } from 'zod';
import { TournamentMatch } from '@/types/tournament-match';
import { StrapiRawTournamentMatch, strapiRawUserInfoSchema } from '../types';
import {
  mapUserInfo,
  extractUserId,
  nullToUndefined,
} from './shared';
import { ValidationError } from '@/lib/core/errors';

/**
 * Zod schema for tournament match validation
 */
const strapiRawTournamentMatchSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  homeScore: z.number(),
  awayScore: z.number(),
  homeGoalscorers: z.string().nullable().optional(),
  awayGoalscorers: z.string().nullable().optional(),
  tournament: z.union([
    z.object({ id: z.number(), documentId: z.string().optional() }),
    z.object({ data: z.object({ id: z.number(), documentId: z.string().optional() }).nullable().optional() }),
  ]).nullable().optional(),
  author: z.union([
    strapiRawUserInfoSchema,
    z.object({ data: strapiRawUserInfoSchema.nullable().optional() }),
  ]).nullable().optional(),
  modifiedBy: z.union([
    strapiRawUserInfoSchema,
    z.object({ data: strapiRawUserInfoSchema.nullable().optional() }),
  ]).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Extract tournament ID from various response structures
 */
function extractTournamentId(
  tournament: StrapiRawTournamentMatch['tournament']
): number | undefined {
  if (!tournament) return undefined;

  // Handle nested structure: { data: { id } }
  if ('data' in tournament) {
    return tournament.data?.id;
  }

  // Handle flattened structure: { id }
  if ('id' in tournament) {
    return tournament.id;
  }

  return undefined;
}

/**
 * Map raw Strapi tournament match to domain TournamentMatch
 */
export function mapTournamentMatch(raw: unknown): TournamentMatch {
  // Validate raw data structure
  const parseResult = strapiRawTournamentMatchSchema.safeParse(raw);

  if (!parseResult.success) {
    console.error('[mapTournamentMatch] Validation failed:', parseResult.error.issues);
    throw new ValidationError(
      'Neplatná data turnajového zápasu ze Strapi',
      { zodErrors: parseResult.error.issues, raw }
    );
  }

  const data = parseResult.data;

  return {
    id: data.documentId,
    homeTeam: data.homeTeam,
    awayTeam: data.awayTeam,
    homeScore: data.homeScore,
    awayScore: data.awayScore,
    homeGoalscorers: nullToUndefined(data.homeGoalscorers),
    awayGoalscorers: nullToUndefined(data.awayGoalscorers),
    tournamentId: extractTournamentId(data.tournament) ?? 0,
    authorId: extractUserId(data.author) ?? 0,
    author: mapUserInfo(data.author),
    modifiedBy: mapUserInfo(data.modifiedBy),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Map array of raw Strapi tournament matches
 */
export function mapTournamentMatches(rawArray: unknown[]): TournamentMatch[] {
  return rawArray.map(mapTournamentMatch);
}

/**
 * Safe mapper that returns null on failure instead of throwing
 */
export function safeMapTournamentMatch(raw: unknown): TournamentMatch | null {
  try {
    return mapTournamentMatch(raw);
  } catch (error) {
    console.error('[safeMapTournamentMatch] Failed to map tournament match:', error);
    return null;
  }
}

/**
 * Map array with safe fallback - filters out invalid items
 */
export function safeMapTournamentMatches(rawArray: unknown[]): TournamentMatch[] {
  return rawArray
    .map(safeMapTournamentMatch)
    .filter((item): item is TournamentMatch => item !== null);
}
