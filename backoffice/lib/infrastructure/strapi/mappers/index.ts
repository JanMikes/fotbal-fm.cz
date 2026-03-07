/**
 * Strapi response mappers.
 * Re-exports all mapper functions for convenient imports.
 */

// Shared utilities
export {
  transformImageUrl,
  transformImageFormats,
  mapRawMediaToImage,
  mapRawMediaToFile,
  mapMediaToImages,
  mapMediaToFiles,
  mapUserInfo,
  extractUserId,
  nullToUndefined,
  emptyToUndefined,
} from './shared';

// Entity mappers
export {
  mapMatch,
  mapMatches,
  safeMapMatch,
  safeMapMatches,
} from './match';

export {
  mapEvent,
  mapEvents,
  safeMapEvent,
  safeMapEvents,
} from './event';

export {
  mapTournament,
  mapTournaments,
  safeMapTournament,
  safeMapTournaments,
} from './tournament';

export {
  mapComment,
  mapComments,
  safeMapComment,
  safeMapComments,
} from './comment';

export {
  mapUser,
  safeMapUser,
} from './user';
