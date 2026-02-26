/**
 * Match result mapper.
 * Transforms raw Strapi match result data into domain MatchResult type.
 */

import { z } from 'zod/v4';
import { MatchResult } from '@/types/match-result';
import { Category } from '@/types/category';
import { StrapiRawMatchResult, StrapiRawCategory, strapiRawMatchResultSchema, strapiRawCategorySchema } from '../types';
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
 * Map raw Strapi match result to domain MatchResult
 */
export function mapMatchResult(raw: unknown): MatchResult {
  // Validate raw data structure
  const parseResult = strapiRawMatchResultSchema.safeParse(raw);

  if (!parseResult.success) {
    // Log detailed error information for debugging
    console.error('[mapMatchResult] Validation failed. Errors:', JSON.stringify(parseResult.error.issues, null, 2));
    console.error('[mapMatchResult] Raw data received:', JSON.stringify(raw, null, 2));
    throw new ValidationError(
      'Neplatná data výsledku zápasu ze Strapi',
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
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Map array of raw Strapi match results
 */
export function mapMatchResults(rawArray: unknown[]): MatchResult[] {
  return rawArray.map(mapMatchResult);
}

/**
 * Safe mapper that returns null on failure instead of throwing
 * Useful for partial data recovery
 */
export function safeMapMatchResult(raw: unknown): MatchResult | null {
  try {
    return mapMatchResult(raw);
  } catch (error) {
    console.error('[safeMapMatchResult] Failed to map match result:', error);
    return null;
  }
}

/**
 * Map array with safe fallback - filters out invalid items
 */
export function safeMapMatchResults(rawArray: unknown[]): MatchResult[] {
  return rawArray
    .map(safeMapMatchResult)
    .filter((item): item is MatchResult => item !== null);
}
