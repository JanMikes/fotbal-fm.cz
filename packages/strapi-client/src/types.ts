/**
 * Shared Strapi API type definitions.
 * These types represent common response structures from Strapi 5 CMS
 * used across multiple applications in the monorepo.
 */

export interface StrapiPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export interface StrapiCollectionResponse<T> {
  data: T[];
  meta?: {
    pagination?: StrapiPagination;
  };
}

export interface StrapiSingleResponse<T> {
  data: T | null;
  meta?: Record<string, unknown>;
}

export interface StrapiErrorResponse {
  error: {
    status: number;
    name: string;
    message: string;
    details?: unknown;
  };
}

export interface StrapiRawMedia {
  id: number;
  documentId?: string;
  url: string;
  alternativeText?: string | null;
  width?: number;
  height?: number;
  formats?: Record<string, unknown> | null;
}

export interface StrapiRawCategory {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

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
