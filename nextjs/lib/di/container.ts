/**
 * Dependency Injection Container.
 * Provides factory functions for creating service and repository instances.
 * Uses lazy initialization for singleton instances.
 */

import { StrapiClient, getStrapiClient, getUserStrapiClient } from '@/lib/infrastructure/strapi';
import {
  MatchResultRepository,
  EventRepository,
  TournamentRepository,
  TournamentMatchRepository,
  CommentRepository,
  UserRepository,
} from '@/lib/repositories';

// =============================================================================
// Singleton Instances (Service-to-Service with API Token)
// =============================================================================

let matchResultRepository: MatchResultRepository | null = null;
let eventRepository: EventRepository | null = null;
let tournamentRepository: TournamentRepository | null = null;
let tournamentMatchRepository: TournamentMatchRepository | null = null;
let commentRepository: CommentRepository | null = null;
let userRepository: UserRepository | null = null;

/**
 * Get the match result repository (singleton)
 */
export function getMatchResultRepository(): MatchResultRepository {
  if (!matchResultRepository) {
    matchResultRepository = new MatchResultRepository(getStrapiClient());
  }
  return matchResultRepository;
}

/**
 * Get the event repository (singleton)
 */
export function getEventRepository(): EventRepository {
  if (!eventRepository) {
    eventRepository = new EventRepository(getStrapiClient());
  }
  return eventRepository;
}

/**
 * Get the tournament repository (singleton)
 */
export function getTournamentRepository(): TournamentRepository {
  if (!tournamentRepository) {
    tournamentRepository = new TournamentRepository(getStrapiClient());
  }
  return tournamentRepository;
}

/**
 * Get the tournament match repository (singleton)
 */
export function getTournamentMatchRepository(): TournamentMatchRepository {
  if (!tournamentMatchRepository) {
    tournamentMatchRepository = new TournamentMatchRepository(getStrapiClient());
  }
  return tournamentMatchRepository;
}

/**
 * Get the comment repository (singleton)
 */
export function getCommentRepository(): CommentRepository {
  if (!commentRepository) {
    commentRepository = new CommentRepository(getStrapiClient());
  }
  return commentRepository;
}

/**
 * Get the user repository (singleton)
 */
export function getUserRepository(): UserRepository {
  if (!userRepository) {
    userRepository = new UserRepository(getStrapiClient());
  }
  return userRepository;
}

// =============================================================================
// User-Authenticated Instances (Per-Request)
// =============================================================================

/**
 * Create a match result repository authenticated with user's JWT
 */
export function createUserMatchResultRepository(jwt: string): MatchResultRepository {
  return new MatchResultRepository(getUserStrapiClient(jwt));
}

/**
 * Create an event repository authenticated with user's JWT
 */
export function createUserEventRepository(jwt: string): EventRepository {
  return new EventRepository(getUserStrapiClient(jwt));
}

/**
 * Create a tournament repository authenticated with user's JWT
 */
export function createUserTournamentRepository(jwt: string): TournamentRepository {
  return new TournamentRepository(getUserStrapiClient(jwt));
}

/**
 * Create a tournament match repository authenticated with user's JWT
 */
export function createUserTournamentMatchRepository(jwt: string): TournamentMatchRepository {
  return new TournamentMatchRepository(getUserStrapiClient(jwt));
}

/**
 * Create a comment repository authenticated with user's JWT
 */
export function createUserCommentRepository(jwt: string): CommentRepository {
  return new CommentRepository(getUserStrapiClient(jwt));
}

/**
 * Create a user repository authenticated with user's JWT
 */
export function createUserUserRepository(jwt: string): UserRepository {
  return new UserRepository(getUserStrapiClient(jwt));
}

// =============================================================================
// Container Interface (for testing and advanced use cases)
// =============================================================================

/**
 * Container interface for dependency injection
 */
export interface Container {
  strapiClient: StrapiClient;
  matchResultRepository: MatchResultRepository;
  eventRepository: EventRepository;
  tournamentRepository: TournamentRepository;
  tournamentMatchRepository: TournamentMatchRepository;
  commentRepository: CommentRepository;
  userRepository: UserRepository;
}

/**
 * Create a container with service-to-service authentication
 */
export function createServiceContainer(): Container {
  const client = getStrapiClient();
  return {
    strapiClient: client,
    matchResultRepository: new MatchResultRepository(client),
    eventRepository: new EventRepository(client),
    tournamentRepository: new TournamentRepository(client),
    tournamentMatchRepository: new TournamentMatchRepository(client),
    commentRepository: new CommentRepository(client),
    userRepository: new UserRepository(client),
  };
}

/**
 * Create a container authenticated with user's JWT
 */
export function createUserContainer(jwt: string): Container {
  const client = getUserStrapiClient(jwt);
  return {
    strapiClient: client,
    matchResultRepository: new MatchResultRepository(client),
    eventRepository: new EventRepository(client),
    tournamentRepository: new TournamentRepository(client),
    tournamentMatchRepository: new TournamentMatchRepository(client),
    commentRepository: new CommentRepository(client),
    userRepository: new UserRepository(client),
  };
}

// =============================================================================
// Testing Utilities
// =============================================================================

/**
 * Reset all singleton instances (for testing)
 */
export function resetContainer(): void {
  matchResultRepository = null;
  eventRepository = null;
  tournamentRepository = null;
  tournamentMatchRepository = null;
  commentRepository = null;
  userRepository = null;
}
