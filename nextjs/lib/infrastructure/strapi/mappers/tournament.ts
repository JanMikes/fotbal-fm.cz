/**
 * Tournament mapper.
 * Transforms raw Strapi tournament data into domain Tournament type.
 */

import { z } from 'zod';
import { Tournament, TournamentPlayer } from '@/types/tournament';
import { Category } from '@/types/category';
import { TournamentMatch } from '@/types/tournament-match';
import { StrapiRawTournament, StrapiRawCategory, strapiRawUserInfoSchema, strapiRawMediaSchema, strapiRawCategorySchema } from '../types';
import {
  mapMediaToImages,
  mapUserInfo,
  extractUserId,
  nullToUndefined,
} from './shared';
import { mapTournamentMatch, safeMapTournamentMatches } from './tournament-match';
import { ValidationError } from '@/lib/core/errors';

/**
 * Zod schema for tournament player
 */
const tournamentPlayerSchema = z.object({
  id: z.number().optional(),
  title: z.string(),
  playerName: z.string(),
});

/**
 * Zod schema for tournament validation
 */
const strapiRawTournamentSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  dateFrom: z.string(),
  dateTo: z.string().nullable().optional(),
  categories: z.array(strapiRawCategorySchema).nullable().optional(),
  imagesUrl: z.string().nullable().optional(),
  photos: z.array(strapiRawMediaSchema).nullable().optional(),
  players: z.array(tournamentPlayerSchema).nullable().optional(),
  tournamentMatches: z.array(z.unknown()).nullable().optional(),
  tournament_matches: z.array(z.unknown()).nullable().optional(),
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
 * Map tournament players
 */
function mapPlayers(players: z.infer<typeof tournamentPlayerSchema>[] | null | undefined): TournamentPlayer[] {
  if (!players || !Array.isArray(players)) {
    return [];
  }

  return players.map((p) => ({
    id: p.id,
    title: p.title,
    playerName: p.playerName,
  }));
}

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
    sortOrder: c.sortOrder,
  }));
}

/**
 * Map raw Strapi tournament to domain Tournament
 */
export function mapTournament(raw: unknown): Tournament {
  // Defensive check for undefined input
  if (!raw) {
    throw new ValidationError(
      'Neplatná data turnaje: prázdná data',
      { raw }
    );
  }

  // Validate raw data structure
  const parseResult = strapiRawTournamentSchema.safeParse(raw);

  if (!parseResult.success) {
    console.error('[mapTournament] Validation failed:', parseResult.error.issues);
    throw new ValidationError(
      'Neplatná data turnaje ze Strapi',
      { zodErrors: parseResult.error.issues, raw }
    );
  }

  const data = parseResult.data;

  // Map tournament matches - can come from either field name
  const matchesRaw = data.tournamentMatches || data.tournament_matches || [];
  const matches = safeMapTournamentMatches(matchesRaw);

  return {
    id: data.documentId,
    name: data.name,
    description: nullToUndefined(data.description),
    location: nullToUndefined(data.location),
    dateFrom: data.dateFrom,
    dateTo: nullToUndefined(data.dateTo),
    categories: mapCategories(data.categories),
    photos: mapMediaToImages(data.photos),
    imagesUrl: nullToUndefined(data.imagesUrl),
    players: mapPlayers(data.players),
    matches,
    authorId: extractUserId(data.author) ?? 0,
    author: mapUserInfo(data.author),
    modifiedBy: mapUserInfo(data.modifiedBy),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Map array of raw Strapi tournaments
 */
export function mapTournaments(rawArray: unknown[]): Tournament[] {
  return rawArray.map(mapTournament);
}

/**
 * Safe mapper that returns null on failure instead of throwing
 */
export function safeMapTournament(raw: unknown): Tournament | null {
  try {
    return mapTournament(raw);
  } catch (error) {
    console.error('[safeMapTournament] Failed to map tournament:', error);
    return null;
  }
}

/**
 * Map array with safe fallback - filters out invalid items
 */
export function safeMapTournaments(rawArray: unknown[]): Tournament[] {
  return rawArray
    .map(safeMapTournament)
    .filter((item): item is Tournament => item !== null);
}
