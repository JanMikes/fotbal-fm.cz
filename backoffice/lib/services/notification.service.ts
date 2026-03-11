/**
 * Notification Service.
 * Handles sending notifications for various events.
 * Re-exports existing notification functions from lib/notifications.ts
 * with added Sentry logging and error handling.
 */

import * as Sentry from '@sentry/nextjs';
import {
  notifyUserRegistered as baseNotifyUserRegistered,
  notifyTournamentCreated as baseNotifyTournamentCreated,
  notifyTournamentUpdated as baseNotifyTournamentUpdated,
  notifyMatchCreated as baseNotifyMatchCreated,
  notifyMatchUpdated as baseNotifyMatchUpdated,
  notifyEventCreated as baseNotifyEventCreated,
  notifyEventUpdated as baseNotifyEventUpdated,
  notifyCommentAdded as baseNotifyCommentAdded,
} from '@/lib/notifications';

import type { Tournament } from '@/types/tournament';
import type { Event } from '@/types/event';
import type { Match } from '@/types/match';
import type { Comment } from '@/types/comment';
import type { User } from '@/types/user';
import type { Category } from '@/types/category';

/**
 * Notification Service class for structured notification handling
 */
export class NotificationService {
  /**
   * Notify about new user registration
   */
  notifyUserRegistered(user: User): void {
    try {
      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Sending user registration notification',
        level: 'info',
        data: { userId: user.id, email: user.email },
      });

      baseNotifyUserRegistered(user);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'NotificationService', method: 'notifyUserRegistered' },
        extra: { userId: user.id },
      });
      // Don't throw - notifications should not break the main flow
    }
  }

  /**
   * Notify about tournament creation
   */
  notifyTournamentCreated(tournament: Tournament, matchCount: number): void {
    try {
      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Sending tournament created notification',
        level: 'info',
        data: { tournamentId: tournament.id, name: tournament.name, matchCount },
      });

      baseNotifyTournamentCreated(tournament, matchCount);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'NotificationService', method: 'notifyTournamentCreated' },
        extra: { tournamentId: tournament.id },
      });
    }
  }

  /**
   * Notify about tournament update
   */
  notifyTournamentUpdated(tournament: Tournament, matchCount: number): void {
    try {
      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Sending tournament updated notification',
        level: 'info',
        data: { tournamentId: tournament.id, name: tournament.name, matchCount },
      });

      baseNotifyTournamentUpdated(tournament, matchCount);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'NotificationService', method: 'notifyTournamentUpdated' },
        extra: { tournamentId: tournament.id },
      });
    }
  }

  /**
   * Notify about match result creation
   */
  notifyMatchCreated(match: Match): void {
    try {
      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Sending match created notification',
        level: 'info',
        data: {
          matchId: match.id,
          match: `${match.homeTeam} vs ${match.awayTeam}`,
        },
      });

      baseNotifyMatchCreated(match);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'NotificationService', method: 'notifyMatchCreated' },
        extra: { matchId: match.id },
      });
    }
  }

  /**
   * Notify about match update
   */
  notifyMatchUpdated(match: Match): void {
    try {
      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Sending match updated notification',
        level: 'info',
        data: {
          matchId: match.id,
          match: `${match.homeTeam} vs ${match.awayTeam}`,
        },
      });

      baseNotifyMatchUpdated(match);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'NotificationService', method: 'notifyMatchUpdated' },
        extra: { matchId: match.id },
      });
    }
  }

  /**
   * Notify about event creation
   */
  notifyEventCreated(event: Event): void {
    try {
      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Sending event created notification',
        level: 'info',
        data: { eventId: event.id, name: event.name },
      });

      baseNotifyEventCreated(event);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'NotificationService', method: 'notifyEventCreated' },
        extra: { eventId: event.id },
      });
    }
  }

  /**
   * Notify about event update
   */
  notifyEventUpdated(event: Event): void {
    try {
      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Sending event updated notification',
        level: 'info',
        data: { eventId: event.id, name: event.name },
      });

      baseNotifyEventUpdated(event);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'NotificationService', method: 'notifyEventUpdated' },
        extra: { eventId: event.id },
      });
    }
  }

  /**
   * Notify about new comment
   * @param entityAuthorEmail - Optional email of the entity author to also notify
   */
  notifyCommentAdded(
    comment: Comment,
    entityType: 'match' | 'tournament' | 'event',
    entityName: string,
    entityId: string,
    entityAuthorEmail?: string,
    categories?: Category[]
  ): void {
    try {
      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Sending comment added notification',
        level: 'info',
        data: { commentId: comment.id, entityType, entityName, entityId, hasEntityAuthorEmail: !!entityAuthorEmail },
      });

      baseNotifyCommentAdded(comment, entityType, entityName, entityId, entityAuthorEmail, categories);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'NotificationService', method: 'notifyCommentAdded' },
        extra: { commentId: comment.id, entityType },
      });
    }
  }
}

// Singleton instance
let notificationServiceInstance: NotificationService | null = null;

/**
 * Get the notification service singleton
 */
export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}
