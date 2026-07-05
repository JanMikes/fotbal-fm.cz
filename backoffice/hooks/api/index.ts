/**
 * API hooks for React components.
 * Provides type-safe hooks for all API operations with consistent error handling.
 */

// Core hooks
export { useMutation } from './useMutation';
export type { MutationState, MutationResult, ApiResponse, FetchOptions } from './types';

// Matches
export {
  useCreateMatch,
  useUpdateMatch,
  useDeleteMatch,
} from './use-matches';

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

// Auth
export {
  useLogin,
  useForgotPassword,
  useResetPassword,
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

// News articles
export { useCreateNewsArticle } from './use-news-articles';
