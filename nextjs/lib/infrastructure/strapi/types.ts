/**
 * Strapi API type definitions.
 * These types represent the raw response structures from Strapi 5 CMS.
 */

import { z } from 'zod/v4';

// =============================================================================
// Re-export shared types from @fotbal-fm/strapi-client
// =============================================================================

export type {
  StrapiPagination,
  StrapiSingleResponse,
  StrapiCollectionResponse,
  StrapiErrorResponse,
  StrapiRawCategory,
  StrapiQueryOptions,
} from '@fotbal-fm/strapi-client';

export { buildStrapiQueryString } from '@fotbal-fm/strapi-client';

// =============================================================================
// Raw Strapi Entity Types (nextjs-specific, as returned from API)
// =============================================================================

/**
 * Raw media format attributes from Strapi
 */
export interface StrapiRawMediaFormat {
  name: string;
  hash: string;
  ext: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  path: string | null;
  url: string;
}

export interface StrapiRawMedia {
  id: number;
  documentId?: string;
  name: string;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number;
  height?: number;
  formats?: {
    thumbnail?: StrapiRawMediaFormat;
    small?: StrapiRawMediaFormat;
    medium?: StrapiRawMediaFormat;
    large?: StrapiRawMediaFormat;
  };
  hash?: string;
  ext: string;
  mime: string;
  size: number;
  url: string;
  previewUrl?: string | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw user info from Strapi (for author/modifiedBy relations)
 */
export interface StrapiRawUserInfo {
  id: number;
  documentId?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
}

/**
 * Raw team from Strapi (relation)
 */
export interface StrapiRawTeam {
  id: number;
  documentId: string;
  name: string;
  logo?: StrapiRawMedia | null;
}

/**
 * Raw match from Strapi (unified match type)
 */
export interface StrapiRawMatch {
  id: number;
  documentId: string;
  homeTeam: StrapiRawTeam | null;
  awayTeam: StrapiRawTeam | null;
  homeScore: number | null;
  awayScore: number | null;
  homeGoalscorers?: string | null;
  awayGoalscorers?: string | null;
  matchReport?: string | null;
  lineup?: string | null;
  categories?: import('@fotbal-fm/strapi-client').StrapiRawCategory[] | null;
  matchDate?: string | null;
  imagesUrl?: string | null;
  images?: StrapiRawMedia[];
  files?: StrapiRawMedia[];
  author?: StrapiRawUserInfo | { data?: StrapiRawUserInfo };
  lastModifiedBy?: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null };
  facrId?: string | null;
  round?: number | null;
  venue?: string | null;
  matchTime?: string | null;
  competitionName?: string | null;
  competitionCode?: string | null;
  season?: number | null;
  period?: string | null;
  organizingBody?: string | null;
  tournament?: { id: number; documentId?: string; name?: string } | { data?: { id: number; documentId?: string; name?: string } | null } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw event from Strapi
 */
export interface StrapiRawEvent {
  id: number;
  documentId: string;
  name: string;
  eventType: string;
  dateFrom: string;
  dateTo?: string | null;
  publishDate?: string | null;
  eventTime?: string | null;
  eventTimeTo?: string | null;
  description?: string | null;
  requiresPhotographer?: boolean;
  categories?: import('@fotbal-fm/strapi-client').StrapiRawCategory[] | null;
  photos?: StrapiRawMedia[];
  files?: StrapiRawMedia[];
  author?: StrapiRawUserInfo | { data?: StrapiRawUserInfo };
  modifiedBy?: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null };
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw tournament player component
 */
export interface StrapiRawTournamentPlayer {
  id?: number;
  title: string;
  playerName: string;
}

/**
 * Raw tournament from Strapi
 */
export interface StrapiRawTournament {
  id: number;
  documentId: string;
  name: string;
  description?: string | null;
  location?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  categories?: import('@fotbal-fm/strapi-client').StrapiRawCategory[] | null;
  imagesUrl?: string | null;
  photos?: StrapiRawMedia[] | null;
  players?: StrapiRawTournamentPlayer[] | null;
  matches?: StrapiRawMatch[] | null;
  author?: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null } | null;
  modifiedBy?: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null } | null;
  facrId?: string | null;
  code?: string | null;
  categoryLetter?: string | null;
  level?: number | null;
  group?: string | null;
  competitionType?: string | null;
  season?: number | null;
  organizingBody?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw comment from Strapi
 */
export interface StrapiRawComment {
  id: number;
  documentId: string;
  content: string;
  author?: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null } | null;
  parentComment?: { documentId?: string } | { data?: { documentId?: string } | null } | null;
  replies?: StrapiRawComment[] | { data?: StrapiRawComment[] | null } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw user from Strapi (full user object)
 */
export interface StrapiRawUser {
  id: number;
  documentId?: string;
  username: string;
  email: string;
  firstname?: string;
  lastname?: string;
  jobTitle?: string;
  confirmed: boolean;
  blocked: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

/**
 * Schema for validating raw media from Strapi
 */
export const strapiRawMediaSchema = z.object({
  id: z.number().optional(),
  documentId: z.string().optional(),
  name: z.string().optional(),
  alternativeText: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  formats: z.object({
    thumbnail: z.object({ url: z.string(), width: z.number(), height: z.number() }).optional(),
    small: z.object({ url: z.string(), width: z.number(), height: z.number() }).optional(),
    medium: z.object({ url: z.string(), width: z.number(), height: z.number() }).optional(),
    large: z.object({ url: z.string(), width: z.number(), height: z.number() }).optional(),
  }).nullable().optional(),
  hash: z.string().optional(),
  ext: z.string().optional(),
  mime: z.string().optional(),
  size: z.number().optional(),
  url: z.string(),
  previewUrl: z.string().nullable().optional(),
  provider: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * Schema for validating raw user info
 */
export const strapiRawUserInfoSchema = z.object({
  id: z.number(),
  documentId: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  email: z.string().optional(),
});

/**
 * Schema for validating raw category
 */
export const strapiRawCategorySchema = z.object({
  id: z.number(),
  documentId: z.string(),
  name: z.string(),
  slug: z.string(),
  sortOrder: z.number().optional().nullable(),
  hidden: z.boolean().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * Schema for validating raw team (relation)
 */
export const strapiRawTeamSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  name: z.string(),
  logo: strapiRawMediaSchema.nullable().optional(),
});

/**
 * Schema for validating raw match (unified)
 */
export const strapiRawMatchSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  homeTeam: strapiRawTeamSchema.nullable(),
  awayTeam: strapiRawTeamSchema.nullable(),
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  homeGoalscorers: z.string().nullable().optional(),
  awayGoalscorers: z.string().nullable().optional(),
  matchReport: z.string().nullable().optional(),
  lineup: z.string().nullable().optional(),
  categories: z.array(strapiRawCategorySchema).nullable().optional(),
  matchDate: z.string().nullable().optional(),
  imagesUrl: z.string().nullable().optional(),
  images: z.array(strapiRawMediaSchema).nullable().optional(),
  files: z.array(strapiRawMediaSchema).nullable().optional(),
  author: z.union([
    strapiRawUserInfoSchema,
    z.object({ data: strapiRawUserInfoSchema.nullable().optional() }),
  ]).nullable().optional(),
  lastModifiedBy: z.union([
    strapiRawUserInfoSchema,
    z.object({ data: strapiRawUserInfoSchema.nullable().optional() }),
  ]).nullable().optional(),
  facrId: z.string().nullable().optional(),
  round: z.number().nullable().optional(),
  venue: z.string().nullable().optional(),
  matchTime: z.string().nullable().optional(),
  competitionName: z.string().nullable().optional(),
  competitionCode: z.string().nullable().optional(),
  season: z.number().nullable().optional(),
  period: z.string().nullable().optional(),
  organizingBody: z.string().nullable().optional(),
  tournament: z.union([
    z.object({ id: z.number(), documentId: z.string().optional(), name: z.string().optional() }),
    z.object({ data: z.object({ id: z.number(), documentId: z.string().optional(), name: z.string().optional() }).nullable().optional() }),
  ]).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Schema for validating raw event
 */
export const strapiRawEventSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  name: z.string(),
  eventType: z.string(),
  dateFrom: z.string(),
  dateTo: z.string().nullable().optional(),
  publishDate: z.string().nullable().optional(),
  eventTime: z.string().nullable().optional(),
  eventTimeTo: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  requiresPhotographer: z.boolean().optional(),
  categories: z.array(strapiRawCategorySchema).nullable().optional(),
  photos: z.array(strapiRawMediaSchema).nullable().optional(),
  files: z.array(strapiRawMediaSchema).nullable().optional(),
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

// =============================================================================
// Upload Types
// =============================================================================

/**
 * Result of a file upload operation
 */
export interface UploadResult {
  success: boolean;
  uploadedFiles?: StrapiRawMedia[];
  error?: string;
}

/**
 * Combined upload results for entities with multiple file fields
 */
export interface EntityUploadResults {
  images?: UploadResult;
  files?: UploadResult;
  photos?: UploadResult;
}
