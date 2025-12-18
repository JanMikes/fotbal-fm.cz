/**
 * Strapi API type definitions.
 * These types represent the raw response structures from Strapi 5 CMS.
 */

import { z } from 'zod';

// =============================================================================
// Generic Strapi Response Types
// =============================================================================

/**
 * Strapi pagination metadata
 */
export interface StrapiPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

/**
 * Generic Strapi single response
 */
export interface StrapiSingleResponse<T> {
  data: T | null;
  meta?: Record<string, unknown>;
}

/**
 * Generic Strapi collection response
 */
export interface StrapiCollectionResponse<T> {
  data: T[];
  meta?: {
    pagination?: StrapiPagination;
  };
}

/**
 * Strapi error response structure
 */
export interface StrapiErrorResponse {
  error: {
    status: number;
    name: string;
    message: string;
    details?: unknown;
  };
}

// =============================================================================
// Raw Strapi Entity Types (as returned from API)
// =============================================================================

/**
 * Raw media attributes from Strapi
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
}

/**
 * Raw category from Strapi
 */
export interface StrapiRawCategory {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Raw match result from Strapi (flattened Strapi 5 response)
 */
export interface StrapiRawMatchResult {
  id: number;
  documentId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string | null;
  awayGoalscorers?: string | null;
  matchReport?: string | null;
  categories?: StrapiRawCategory[] | null;
  matchDate?: string | null;
  imagesUrl?: string | null;
  images?: StrapiRawMedia[];
  files?: StrapiRawMedia[];
  author?: StrapiRawUserInfo | { data?: StrapiRawUserInfo };
  lastModifiedBy?: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null };
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
  categories?: StrapiRawCategory[] | null;
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
 * Raw tournament match from Strapi
 */
export interface StrapiRawTournamentMatch {
  id: number;
  documentId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string | null;
  awayGoalscorers?: string | null;
  tournament?: { id: number; documentId?: string } | { data?: { id: number; documentId?: string } | null } | null;
  author?: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null } | null;
  modifiedBy?: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null } | null;
  createdAt: string;
  updatedAt: string;
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
  dateFrom: string;
  dateTo?: string | null;
  categories?: StrapiRawCategory[] | null;
  imagesUrl?: string | null;
  photos?: StrapiRawMedia[] | null;
  players?: StrapiRawTournamentPlayer[] | null;
  tournamentMatches?: StrapiRawTournamentMatch[] | null;
  tournament_matches?: StrapiRawTournamentMatch[] | null;
  author?: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null } | null;
  modifiedBy?: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null } | null;
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
  id: z.number(),
  documentId: z.string().optional(),
  name: z.string(),
  alternativeText: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  formats: z.object({
    thumbnail: z.object({ url: z.string(), width: z.number(), height: z.number() }).optional(),
    small: z.object({ url: z.string(), width: z.number(), height: z.number() }).optional(),
    medium: z.object({ url: z.string(), width: z.number(), height: z.number() }).optional(),
    large: z.object({ url: z.string(), width: z.number(), height: z.number() }).optional(),
  }).nullable().optional(),
  ext: z.string(),
  mime: z.string(),
  size: z.number(),
  url: z.string(),
  previewUrl: z.string().nullable().optional(),
  provider: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Schema for validating raw user info
 */
export const strapiRawUserInfoSchema = z.object({
  id: z.number(),
  documentId: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
});

/**
 * Schema for validating raw category
 */
export const strapiRawCategorySchema = z.object({
  id: z.number(),
  documentId: z.string(),
  name: z.string(),
  slug: z.string(),
  sortOrder: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * Schema for validating raw match result
 */
export const strapiRawMatchResultSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  homeScore: z.number(),
  awayScore: z.number(),
  homeGoalscorers: z.string().nullable().optional(),
  awayGoalscorers: z.string().nullable().optional(),
  matchReport: z.string().nullable().optional(),
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

// =============================================================================
// Query Options
// =============================================================================

/**
 * Options for Strapi queries
 */
export interface StrapiQueryOptions {
  populate?: string | string[] | Record<string, unknown>;
  filters?: Record<string, unknown>;
  sort?: string | string[];
  pagination?: {
    page?: number;
    pageSize?: number;
    limit?: number;
  };
  fields?: string[];
}

/**
 * Build query string from StrapiQueryOptions
 */
export function buildStrapiQueryString(options: StrapiQueryOptions): string {
  const params = new URLSearchParams();

  // Handle populate
  if (options.populate) {
    if (typeof options.populate === 'string') {
      params.append('populate', options.populate);
    } else if (Array.isArray(options.populate)) {
      options.populate.forEach((p, i) => params.append(`populate[${i}]`, p));
    } else {
      // Complex populate object - convert to Strapi format
      const flattenPopulate = (obj: Record<string, unknown>, prefix = 'populate'): void => {
        for (const [key, value] of Object.entries(obj)) {
          if (Array.isArray(value)) {
            // Handle arrays like fields: ['id', 'firstname', 'lastname']
            value.forEach((item, i) => params.append(`${prefix}[${key}][${i}]`, String(item)));
          } else if (typeof value === 'object' && value !== null) {
            flattenPopulate(value as Record<string, unknown>, `${prefix}[${key}]`);
          } else {
            params.append(`${prefix}[${key}]`, String(value));
          }
        }
      };
      flattenPopulate(options.populate);
    }
  }

  // Handle filters
  if (options.filters) {
    const flattenFilters = (obj: Record<string, unknown>, prefix = 'filters'): void => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flattenFilters(value as Record<string, unknown>, `${prefix}[${key}]`);
        } else {
          params.append(`${prefix}[${key}]`, String(value));
        }
      }
    };
    flattenFilters(options.filters);
  }

  // Handle sort
  if (options.sort) {
    if (typeof options.sort === 'string') {
      params.append('sort', options.sort);
    } else {
      options.sort.forEach((s, i) => params.append(`sort[${i}]`, s));
    }
  }

  // Handle pagination
  if (options.pagination) {
    if (options.pagination.page !== undefined) {
      params.append('pagination[page]', String(options.pagination.page));
    }
    if (options.pagination.pageSize !== undefined) {
      params.append('pagination[pageSize]', String(options.pagination.pageSize));
    }
    if (options.pagination.limit !== undefined) {
      params.append('pagination[limit]', String(options.pagination.limit));
    }
  }

  // Handle fields
  if (options.fields) {
    options.fields.forEach((f, i) => params.append(`fields[${i}]`, f));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}
