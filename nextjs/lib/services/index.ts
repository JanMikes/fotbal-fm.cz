/**
 * Services module.
 * Re-exports all service classes and related types.
 */

// Match Result Service
export {
  MatchResultService,
  type MatchResultWithUploads,
} from './match-result.service';

// Event Service
export {
  EventService,
  type EventWithUploads,
} from './event.service';

// Tournament Service
export {
  TournamentService,
  type TournamentWithUploads,
} from './tournament.service';

// Tournament Match Service
export { TournamentMatchService } from './tournament-match.service';

// Auth Service
export {
  AuthService,
  getAuthService,
  type LoginCredentials,
  type RegistrationData,
  type ProfileUpdateData,
  type AuthResult,
} from './auth.service';

// Notification Service
export {
  NotificationService,
  getNotificationService,
} from './notification.service';

// Comment Service
export {
  CommentService,
  type CreateCommentData,
} from './comment.service';
