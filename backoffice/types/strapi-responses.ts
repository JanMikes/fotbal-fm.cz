/**
 * Strapi API response type definitions
 * These types define the structure of responses from the Strapi CMS
 */

/**
 * Generic Strapi data wrapper
 * Strapi wraps all resources in a data object with id and attributes
 * In Strapi 5, documentId is the primary identifier
 */
export interface StrapiDataWrapper<T> {
  id: number;
  documentId?: string;
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
 * Match attributes from Strapi
 */
export interface StrapiMatchAttributes {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  matchReport?: string;
  matchDate: string;
  images?: StrapiMedia;
  userId: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

/**
 * Full Strapi match response
 */
export type StrapiMatchData = StrapiDataWrapper<StrapiMatchAttributes>;

/**
 * Strapi match collection response
 */
export type StrapiMatchesCollectionResponse = StrapiCollectionResponse<StrapiMatchAttributes>;

/**
 * Strapi match single response
 */
export type StrapiMatchSingleResponse = StrapiSingleResponse<StrapiMatchAttributes>;
