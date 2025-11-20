/**
 * Strapi API response type definitions
 * These types define the structure of responses from the Strapi CMS
 */

/**
 * Generic Strapi data wrapper
 * Strapi wraps all resources in a data object with id and attributes
 */
export interface StrapiDataWrapper<T> {
  id: number;
  attributes: T;
}

/**
 * Strapi collection response (array of items)
 */
export interface StrapiCollectionResponse<T> {
  data: StrapiDataWrapper<T>[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

/**
 * Strapi single item response
 */
export interface StrapiSingleResponse<T> {
  data: StrapiDataWrapper<T> | null;
  meta?: Record<string, unknown>;
}

/**
 * Strapi media/file attributes
 */
export interface StrapiMediaAttributes {
  name: string;
  alternativeText?: string;
  caption?: string;
  width?: number;
  height?: number;
  formats?: {
    thumbnail?: StrapiMediaFormat;
    small?: StrapiMediaFormat;
    medium?: StrapiMediaFormat;
    large?: StrapiMediaFormat;
  };
  hash: string;
  ext: string;
  mime: string;
  size: number;
  url: string;
  previewUrl?: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export interface StrapiMediaFormat {
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

/**
 * Strapi media response (can be single or collection)
 */
export interface StrapiMedia {
  data: StrapiDataWrapper<StrapiMediaAttributes> | StrapiDataWrapper<StrapiMediaAttributes>[] | null;
}

/**
 * Match result attributes from Strapi
 */
export interface StrapiMatchResultAttributes {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  matchReport?: string;
  images?: StrapiMedia;
  userId: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

/**
 * Full Strapi match result response
 */
export type StrapiMatchResultData = StrapiDataWrapper<StrapiMatchResultAttributes>;

/**
 * Strapi match result collection response
 */
export type StrapiMatchResultsCollectionResponse = StrapiCollectionResponse<StrapiMatchResultAttributes>;

/**
 * Strapi match result single response
 */
export type StrapiMatchResultSingleResponse = StrapiSingleResponse<StrapiMatchResultAttributes>;
