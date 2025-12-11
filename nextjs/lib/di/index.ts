/**
 * Dependency Injection module.
 * Re-exports container functions for convenient imports.
 */

export {
  // Singleton repository getters (service-to-service)
  getMatchResultRepository,
  getEventRepository,
  getTournamentRepository,
  getTournamentMatchRepository,
  getCommentRepository,
  getUserRepository,

  // User-authenticated repository factories
  createUserMatchResultRepository,
  createUserEventRepository,
  createUserTournamentRepository,
  createUserTournamentMatchRepository,
  createUserCommentRepository,
  createUserUserRepository,

  // Container factories
  createServiceContainer,
  createUserContainer,

  // Testing utilities
  resetContainer,

  // Types
  type Container,
} from './container';
