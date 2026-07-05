/**
 * Services module.
 * Re-exports all service classes and related types.
 */

// Match Service
export {
  MatchService,
  type MatchWithUploads,
} from './match.service';

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

// News Article Service
export {
  NewsArticleService,
  type NewsArticleWithUploads,
} from './news-article.service';
