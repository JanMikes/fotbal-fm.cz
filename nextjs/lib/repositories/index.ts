/**
 * Repository layer.
 * Re-exports all repositories for convenient imports.
 */

// Base types
export type {
  FindOptions,
  PaginatedResult,
  UploadStatus,
  UploadResults,
  Repository,
  RepositoryWithUploads,
  UserFilterOptions,
} from './base';

// Entity repositories
export { MatchResultRepository } from './match-result.repository';
export { EventRepository } from './event.repository';
export { TournamentRepository } from './tournament.repository';
export { TournamentMatchRepository } from './tournament-match.repository';
export { CommentRepository, type CommentableEntity } from './comment.repository';
export {
  UserRepository,
  type LoginResult,
  type RegisterData,
  type UpdateProfileData,
} from './user.repository';
