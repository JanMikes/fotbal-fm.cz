/**
 * Dependency Injection Container.
 * Provides factory functions for creating service and repository instances.
 * Uses lazy initialization for singleton instances.
 */

import { StrapiClient, getStrapiClient, getUserStrapiClient } from '@/lib/infrastructure/strapi';
import {
  TeamRepository,
  MatchRepository,
  EventRepository,
  TournamentRepository,
  CommentRepository,
  UserRepository,
} from '@/lib/repositories';

// =============================================================================
// Singleton Instances (Service-to-Service with API Token)
// =============================================================================

let teamRepository: TeamRepository | null = null;
let matchRepository: MatchRepository | null = null;
let eventRepository: EventRepository | null = null;
let tournamentRepository: TournamentRepository | null = null;
let commentRepository: CommentRepository | null = null;
let userRepository: UserRepository | null = null;

/**
 * Get the team repository (singleton)
 */
export function getTeamRepository(): TeamRepository {
  if (!teamRepository) {
    teamRepository = new TeamRepository(getStrapiClient());
  }
  return teamRepository;
}

/**
 * Get the match repository (singleton)
 */
export function getMatchRepository(): MatchRepository {
  if (!matchRepository) {
    matchRepository = new MatchRepository(getStrapiClient());
  }
  return matchRepository;
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
 * Create a match repository authenticated with user's JWT
 */
export function createUserMatchRepository(jwt: string): MatchRepository {
  return new MatchRepository(getUserStrapiClient(jwt));
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
  teamRepository: TeamRepository;
  matchRepository: MatchRepository;
  eventRepository: EventRepository;
  tournamentRepository: TournamentRepository;
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
    teamRepository: new TeamRepository(client),
    matchRepository: new MatchRepository(client),
    eventRepository: new EventRepository(client),
    tournamentRepository: new TournamentRepository(client),
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
    teamRepository: new TeamRepository(client),
    matchRepository: new MatchRepository(client),
    eventRepository: new EventRepository(client),
    tournamentRepository: new TournamentRepository(client),
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
  matchRepository = null;
  eventRepository = null;
  tournamentRepository = null;
  commentRepository = null;
  userRepository = null;
}
