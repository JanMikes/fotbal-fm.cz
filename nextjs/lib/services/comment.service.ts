/**
 * Comment Service.
 * Handles comment business logic including creating, fetching, and entity-specific operations.
 */

import * as Sentry from '@sentry/nextjs';
import { Comment, CreateCommentRequest } from '@/types/comment';
import { Result, ok, err } from '@/lib/core/result';
import { AppError, ErrorCode } from '@/lib/core/errors';
import { getUserStrapiClient } from '@/lib/infrastructure/strapi';
import {
  CommentRepository,
  CommentableEntity,
} from '@/lib/repositories/comment.repository';
import { NotificationService, getNotificationService } from './notification.service';
import { MatchResultService } from './match-result.service';
import { TournamentService } from './tournament.service';
import { EventService } from './event.service';
import { getAuthService } from './auth.service';

export interface CreateCommentData {
  content: string;
  matchResult?: string;
  tournament?: string;
  event?: string;
  parentComment?: string;
}

export class CommentService {
  private readonly repository: CommentRepository;
  private readonly notificationService: NotificationService;

  constructor(
    repository: CommentRepository,
    notificationService?: NotificationService
  ) {
    this.repository = repository;
    this.notificationService = notificationService ?? getNotificationService();
  }

  /**
   * Create a service instance for an authenticated user
   */
  static forUser(jwt: string): CommentService {
    const client = getUserStrapiClient(jwt);
    const repository = new CommentRepository(client);
    return new CommentService(repository);
  }

  /**
   * Get comment by ID
   */
  async getById(id: string): Promise<Result<Comment, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting comment by ID',
        level: 'info',
        data: { id },
      });

      const comment = await this.repository.findById(id);

      if (!comment) {
        return err(new AppError('Komentář nenalezen', ErrorCode.NOT_FOUND, 404));
      }

      return ok(comment);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'CommentService', method: 'getById' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání komentáře',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get comments for a specific entity
   */
  async getByEntity(
    entityType: CommentableEntity,
    entityId: string
  ): Promise<Result<Comment[], AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting comments for entity',
        level: 'info',
        data: { entityType, entityId },
      });

      const comments = await this.repository.findByEntity(entityType, entityId);
      return ok(comments);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'CommentService', method: 'getByEntity' },
        extra: { entityType, entityId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání komentářů',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Create a new comment
   */
  async create(
    jwt: string,
    userId: number,
    data: CreateCommentData
  ): Promise<Result<Comment, AppError>> {
    try {
      // Validate that exactly one entity type is specified
      const { matchResult, tournament, event } = data;
      const entityCount = [matchResult, tournament, event].filter(Boolean).length;

      if (entityCount !== 1) {
        return err(new AppError(
          'Komentář musí patřit právě k jedné entitě',
          ErrorCode.VALIDATION_FAILED,
          400
        ));
      }

      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Creating comment',
        level: 'info',
        data: {
          entityType: matchResult ? 'matchResult' : tournament ? 'tournament' : 'event',
          entityId: matchResult || tournament || event,
        },
      });

      // Create the comment
      const commentData: CreateCommentRequest = {
        content: data.content,
        author: userId,
        ...(matchResult && { matchResult }),
        ...(tournament && { tournament }),
        ...(event && { event }),
        ...(data.parentComment && { parentComment: data.parentComment }),
      };

      const comment = await this.repository.create(commentData);

      // Send notification (non-blocking)
      this.sendNotification(jwt, comment, matchResult, tournament, event);

      return ok(comment);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'CommentService', method: 'create' },
        extra: { userId, data },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při vytváření komentáře',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Delete a comment
   */
  async delete(id: string): Promise<Result<void, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Deleting comment',
        level: 'info',
        data: { id },
      });

      await this.repository.delete(id);
      return ok(undefined);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'CommentService', method: 'delete' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při mazání komentáře',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Send notification about new comment (non-blocking)
   */
  private async sendNotification(
    jwt: string,
    comment: Comment,
    matchResult?: string,
    tournament?: string,
    event?: string
  ): Promise<void> {
    try {
      // Get author info
      const authService = getAuthService();
      const userResult = await authService.getCurrentUser(jwt);

      if (!userResult.success) {
        return;
      }

      const commentAuthorId = userResult.data.id;
      const commentWithAuthor = {
        ...comment,
        author: {
          id: commentAuthorId,
          firstName: userResult.data.firstName,
          lastName: userResult.data.lastName,
        },
      };

      let entityType: 'matchResult' | 'tournament' | 'event';
      let entityName = '';
      let entityAuthorEmail: string | undefined;
      let entityAuthorId: number | undefined;

      if (matchResult) {
        entityType = 'matchResult';
        const service = MatchResultService.forUser(jwt);
        const result = await service.getById(matchResult);
        if (result.success) {
          entityName = `${result.data.homeTeam} vs ${result.data.awayTeam} (${result.data.homeScore}:${result.data.awayScore})`;
          entityAuthorEmail = result.data.author?.email;
          entityAuthorId = result.data.author?.id;
        }
      } else if (tournament) {
        entityType = 'tournament';
        const service = TournamentService.forUser(jwt);
        const result = await service.getById(tournament);
        if (result.success) {
          entityName = result.data.name;
          entityAuthorEmail = result.data.author?.email;
          entityAuthorId = result.data.author?.id;
        }
      } else {
        entityType = 'event';
        const service = EventService.forUser(jwt);
        const result = await service.getById(event!);
        if (result.success) {
          entityName = result.data.name;
          entityAuthorEmail = result.data.author?.email;
          entityAuthorId = result.data.author?.id;
        }
      }

      if (!entityName) {
        entityName = `ID: ${matchResult || tournament || event}`;
      }

      // Don't notify entity author if they are the comment author (avoid self-notification)
      const shouldNotifyEntityAuthor = entityAuthorEmail && entityAuthorId !== commentAuthorId;

      this.notificationService.notifyCommentAdded(
        commentWithAuthor,
        entityType,
        entityName,
        shouldNotifyEntityAuthor ? entityAuthorEmail : undefined
      );
    } catch (error) {
      // Log but don't fail - comment was already created
      Sentry.captureException(error, {
        tags: { service: 'CommentService', method: 'sendNotification' },
        level: 'warning',
      });
    }
  }
}
