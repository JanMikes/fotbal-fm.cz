/**
 * Strapi infrastructure module.
 * Provides a clean interface for communicating with Strapi CMS.
 */

// Client
export {
  StrapiClient,
  getStrapiClient,
  getUserStrapiClient,
} from './client';
export type { StrapiClientConfig } from './client';

// Types
export type {
  StrapiPagination,
  StrapiSingleResponse,
  StrapiCollectionResponse,
  StrapiErrorResponse,
  StrapiRawMedia,
  StrapiRawMediaFormat,
  StrapiRawUserInfo,
  StrapiRawMatchResult,
  StrapiRawEvent,
  StrapiRawTournament,
  StrapiRawTournamentMatch,
  StrapiRawTournamentPlayer,
  StrapiRawComment,
  StrapiRawUser,
  UploadResult,
  EntityUploadResults,
  StrapiQueryOptions,
} from './types';

export { buildStrapiQueryString } from './types';

// Mappers
export * from './mappers';
