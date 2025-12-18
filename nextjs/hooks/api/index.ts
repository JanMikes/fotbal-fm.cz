/**
 * API hooks for React components.
 * Provides type-safe hooks for all API operations with consistent error handling.
 */

// Core hooks
export { useMutation } from './useMutation';
export type { MutationState, MutationResult, ApiResponse, FetchOptions } from './types';

// Match results
export {
  useCreateMatchResult,
  useUpdateMatchResult,
  useDeleteMatchResult,
} from './use-match-results';

// Events
export {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from './use-events';

// Tournaments
export {
  useCreateTournament,
  useUpdateTournament,
  useDeleteTournament,
} from './use-tournaments';

// Tournament matches
export {
  useCreateTournamentMatch,
  useUpdateTournamentMatch,
  useDeleteTournamentMatch,
} from './use-tournament-matches';

// Auth
export {
  useLogin,
  useRegister,
  useUpdateProfile,
  useChangePassword,
  useLogout,
} from './use-auth';

// Comments
export {
  useCreateComment,
  useDeleteComment,
} from './use-comments';

// Categories
export { useCategories } from './use-categories';
