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
  notifyMatchResultCreated as baseNotifyMatchResultCreated,
  notifyMatchResultUpdated as baseNotifyMatchResultUpdated,
  notifyEventCreated as baseNotifyEventCreated,
  notifyEventUpdated as baseNotifyEventUpdated,
  notifyCommentAdded as baseNotifyCommentAdded,
} from '@/lib/notifications';

import type { Tournament } from '@/types/tournament';
import type { Event } from '@/types/event';
import type { MatchResult } from '@/types/match-result';
import type { Comment } from '@/types/comment';
import type { User } from '@/types/user';

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
  notifyMatchResultCreated(matchResult: MatchResult): void {
    try {
      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Sending match result created notification',
        level: 'info',
        data: {
          matchResultId: matchResult.id,
          match: `${matchResult.homeTeam} vs ${matchResult.awayTeam}`,
        },
      });

      baseNotifyMatchResultCreated(matchResult);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'NotificationService', method: 'notifyMatchResultCreated' },
        extra: { matchResultId: matchResult.id },
      });
    }
  }

  /**
   * Notify about match result update
   */
  notifyMatchResultUpdated(matchResult: MatchResult): void {
    try {
      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Sending match result updated notification',
        level: 'info',
        data: {
          matchResultId: matchResult.id,
          match: `${matchResult.homeTeam} vs ${matchResult.awayTeam}`,
        },
      });

      baseNotifyMatchResultUpdated(matchResult);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'NotificationService', method: 'notifyMatchResultUpdated' },
        extra: { matchResultId: matchResult.id },
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
    entityType: 'matchResult' | 'tournament' | 'event',
    entityName: string,
    entityAuthorEmail?: string
  ): void {
    try {
      Sentry.addBreadcrumb({
        category: 'notification',
        message: 'Sending comment added notification',
        level: 'info',
        data: { commentId: comment.id, entityType, entityName, hasEntityAuthorEmail: !!entityAuthorEmail },
      });

      baseNotifyCommentAdded(comment, entityType, entityName, entityAuthorEmail);
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
