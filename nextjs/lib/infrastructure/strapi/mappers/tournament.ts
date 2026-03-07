/**
 * Tournament mapper.
 * Transforms raw Strapi tournament data into domain Tournament type.
 */

import { z } from 'zod/v4';
import { Tournament, TournamentPlayer } from '@/types/tournament';
import { Category } from '@/types/category';
import { strapiRawCategorySchema, strapiRawUserInfoSchema, strapiRawMediaSchema } from '../types';
import {
  mapMediaToImages,
  mapUserInfo,
  extractUserId,
  nullToUndefined,
} from './shared';
import { safeMapMatches } from './match';
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
  dateFrom: z.string().nullable().optional(),
  dateTo: z.string().nullable().optional(),
  categories: z.array(strapiRawCategorySchema).nullable().optional(),
  imagesUrl: z.string().nullable().optional(),
  photos: z.array(strapiRawMediaSchema).nullable().optional(),
  players: z.array(tournamentPlayerSchema).nullable().optional(),
  matches: z.array(z.unknown()).nullable().optional(),
  author: z.union([
    strapiRawUserInfoSchema,
    z.object({ data: strapiRawUserInfoSchema.nullable().optional() }),
  ]).nullable().optional(),
  modifiedBy: z.union([
    strapiRawUserInfoSchema,
    z.object({ data: strapiRawUserInfoSchema.nullable().optional() }),
  ]).nullable().optional(),
  facrId: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  categoryLetter: z.string().nullable().optional(),
  level: z.number().nullable().optional(),
  group: z.string().nullable().optional(),
  competitionType: z.string().nullable().optional(),
  season: z.number().nullable().optional(),
  organizingBody: z.string().nullable().optional(),
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
    sortOrder: c.sortOrder ?? 0,
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
    const rawObj = raw as Record<string, unknown>;
    console.error('[mapTournament] Validation failed for tournament id=%s documentId=%s. Errors:', rawObj?.id, rawObj?.documentId, JSON.stringify(parseResult.error.issues, null, 2));
    throw new ValidationError(
      'Neplatná data turnaje ze Strapi',
      { zodErrors: parseResult.error.issues }
    );
  }

  const data = parseResult.data;

  // Map matches
  const matchesRaw = data.matches || [];
  const matches = safeMapMatches(matchesRaw);

  return {
    id: data.documentId,
    name: data.name,
    description: nullToUndefined(data.description),
    location: nullToUndefined(data.location),
    dateFrom: nullToUndefined(data.dateFrom),
    dateTo: nullToUndefined(data.dateTo),
    categories: mapCategories(data.categories),
    photos: mapMediaToImages(data.photos),
    imagesUrl: nullToUndefined(data.imagesUrl),
    players: mapPlayers(data.players),
    matches,
    authorId: extractUserId(data.author) ?? 0,
    author: mapUserInfo(data.author),
    modifiedBy: mapUserInfo(data.modifiedBy),
    facrId: nullToUndefined(data.facrId),
    code: nullToUndefined(data.code),
    categoryLetter: nullToUndefined(data.categoryLetter),
    level: data.level ?? undefined,
    group: nullToUndefined(data.group),
    competitionType: nullToUndefined(data.competitionType),
    season: data.season ?? undefined,
    organizingBody: nullToUndefined(data.organizingBody),
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
  } catch {
    // Error already logged by mapTournament
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
