/**
 * Match mapper.
 * Transforms raw Strapi match data into domain Match type.
 */

import { z } from 'zod/v4';
import { Match } from '@/types/match';
import { Category } from '@/types/category';
import { strapiRawMatchSchema, strapiRawCategorySchema } from '../types';
import {
  mapMediaToImages,
  mapMediaToFiles,
  mapUserInfo,
  extractUserId,
  nullToUndefined,
} from './shared';
import { ValidationError } from '@/lib/core/errors';

/**
 * Map raw Strapi categories to domain Category array
 */
function mapCategories(categories: z.infer<typeof strapiRawCategorySchema>[] | null | undefined): Category[] {
  if (!categories || !Array.isArray(categories)) {
    return [];
  }

  return categories.map((c) => ({
    id: c.documentId,
    name: c.name,
    slug: c.slug,
    sortOrder: c.sortOrder ?? 0,
  }));
}

/**
 * Extract tournament info from various response structures
 */
function extractTournament(
  tournament: unknown
): { id?: string; name?: string } {
  if (!tournament || typeof tournament !== 'object') return {};

  // Handle nested structure: { data: { documentId, name } }
  if ('data' in tournament) {
    const data = (tournament as { data?: { documentId?: string; name?: string } | null }).data;
    return { id: data?.documentId, name: data?.name };
  }

  // Handle flattened structure: { documentId, name }
  const t = tournament as { documentId?: string; name?: string };
  return { id: t.documentId, name: t.name };
}

/**
 * Map raw Strapi match to domain Match
 */
export function mapMatch(raw: unknown): Match {
  // Validate raw data structure
  const parseResult = strapiRawMatchSchema.safeParse(raw);

  if (!parseResult.success) {
    // Log detailed error information for debugging
    console.error('[mapMatch] Validation failed. Errors:', JSON.stringify(parseResult.error.issues, null, 2));
    console.error('[mapMatch] Raw data received:', JSON.stringify(raw, null, 2));
    throw new ValidationError(
      'Neplatná data zápasu ze Strapi',
      { zodErrors: parseResult.error.issues, raw }
    );
  }

  const data = parseResult.data;
  const tournamentInfo = extractTournament(data.tournament);

  return {
    id: data.documentId,
    homeTeam: data.homeTeam,
    awayTeam: data.awayTeam,
    homeScore: data.homeScore,
    awayScore: data.awayScore,
    homeGoalscorers: nullToUndefined(data.homeGoalscorers),
    awayGoalscorers: nullToUndefined(data.awayGoalscorers),
    matchReport: nullToUndefined(data.matchReport),
    categories: mapCategories(data.categories),
    matchDate: data.matchDate ?? data.createdAt.split('T')[0],
    imagesUrl: nullToUndefined(data.imagesUrl),
    images: mapMediaToImages(data.images),
    files: mapMediaToFiles(data.files),
    authorId: extractUserId(data.author) ?? 0,
    author: mapUserInfo(data.author),
    modifiedBy: mapUserInfo(data.lastModifiedBy),
    facrId: nullToUndefined(data.facrId),
    round: data.round ?? undefined,
    venue: nullToUndefined(data.venue),
    matchTime: nullToUndefined(data.matchTime),
    competitionName: nullToUndefined(data.competitionName),
    competitionCode: nullToUndefined(data.competitionCode),
    season: data.season ?? undefined,
    period: nullToUndefined(data.period),
    organizingBody: nullToUndefined(data.organizingBody),
    tournamentId: tournamentInfo.id,
    tournamentName: tournamentInfo.name,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Map array of raw Strapi matches
 */
export function mapMatches(rawArray: unknown[]): Match[] {
  return rawArray.map(mapMatch);
}

/**
 * Safe mapper that returns null on failure instead of throwing
 * Useful for partial data recovery
 */
export function safeMapMatch(raw: unknown): Match | null {
  try {
    return mapMatch(raw);
  } catch (error) {
    console.error('[safeMapMatch] Failed to map match:', error);
    return null;
  }
}

/**
 * Map array with safe fallback - filters out invalid items
 */
export function safeMapMatches(rawArray: unknown[]): Match[] {
  return rawArray
    .map(safeMapMatch)
    .filter((item): item is Match => item !== null);
}
