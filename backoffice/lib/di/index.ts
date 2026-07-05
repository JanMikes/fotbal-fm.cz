/**
 * Dependency Injection module.
 * Re-exports container functions for convenient imports.
 */

export {
  // Singleton repository getters (service-to-service)
  getTeamRepository,
  getMatchRepository,
  getEventRepository,
  getTournamentRepository,
  getCommentRepository,
  getUserRepository,
  getNewsArticleRepository,

  // User-authenticated repository factories
  createUserMatchRepository,
  createUserEventRepository,
  createUserTournamentRepository,
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
