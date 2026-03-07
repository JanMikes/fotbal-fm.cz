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
export { TeamRepository, type Team } from './team.repository';
export { MatchRepository } from './match.repository';
export { EventRepository } from './event.repository';
export { TournamentRepository } from './tournament.repository';
export { CommentRepository, type CommentableEntity } from './comment.repository';
export { CategoryRepository } from './category.repository';
export {
  UserRepository,
  type LoginResult,
  type RegisterData,
  type UpdateProfileData,
} from './user.repository';
