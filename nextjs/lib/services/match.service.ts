/**
 * Match Service.
 * Handles business logic for match operations.
 */

import * as Sentry from '@sentry/nextjs';
import { Match, CreateMatchRequest } from '@/types/match';
import { MatchRepository, UploadResults } from '@/lib/repositories';
import { Result, ok, err } from '@/lib/core/result';
import { AppError, NotFoundError, ErrorCode } from '@/lib/core/errors';
import { createUserMatchRepository } from '@/lib/di';
import { NotificationService, getNotificationService } from './notification.service';

/**
 * Result of a create/update operation with file uploads
 */
export interface MatchWithUploads {
  match: Match;
  uploadWarnings: string[];
}

/**
 * Convert upload results to warning messages
 */
function buildUploadWarnings(uploads: UploadResults): string[] {
  const warnings: string[] = [];

  if (uploads.images && !uploads.images.success) {
    warnings.push(uploads.images.error ?? 'Nepodařilo se nahrát obrázky');
  }
  if (uploads.files && !uploads.files.success) {
    warnings.push(uploads.files.error ?? 'Nepodařilo se nahrát přílohy');
  }

  return warnings;
}

export class MatchService {
  private readonly notificationService: NotificationService;

  constructor(
    private readonly repository: MatchRepository,
    notificationService?: NotificationService
  ) {
    this.notificationService = notificationService ?? getNotificationService();
  }

  /**
   * Create a service instance authenticated with user's JWT
   */
  static forUser(jwt: string): MatchService {
    return new MatchService(createUserMatchRepository(jwt));
  }

  /**
   * Get a match by ID
   */
  async getById(id: string): Promise<Result<Match, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting match by ID',
        level: 'info',
        data: { id },
      });

      const match = await this.repository.findById(id);

      if (!match) {
        return err(new NotFoundError(`Zápas s ID ${id} nebyl nalezen`));
      }

      return ok(match);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchService', method: 'getById' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání zápasu',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all matches for a user
   */
  async getByUser(userId: number): Promise<Result<Match[], AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting matches for user',
        level: 'info',
        data: { userId },
      });

      const matches = await this.repository.findByUser(userId);
      return ok(matches);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchService', method: 'getByUser' },
        extra: { userId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání zápasů',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all matches with optional user filter and additional filters
   */
  async getAll(userId?: number, filters?: Record<string, unknown>): Promise<Result<Match[], AppError>> {
    try {
      const matches = await this.repository.findAll({ userId, filters });
      return ok(matches);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchService', method: 'getAll' },
        extra: { userId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání zápasů',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all matches with minimal data for dashboard/calendar
   */
  async getAllSummary(limit?: number): Promise<Result<Match[], AppError>> {
    try {
      const matches = await this.repository.findAllSummary({ limit });
      return ok(matches);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchService', method: 'getAllSummary' },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání zápasů',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Create a new match with file uploads
   */
  async create(
    data: CreateMatchRequest,
    files: { images?: File[]; files?: File[] }
  ): Promise<Result<MatchWithUploads, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Creating match',
        level: 'info',
        data: {
          homeTeam: data.homeTeam,
          awayTeam: data.awayTeam,
          hasImages: !!files.images?.length,
          hasFiles: !!files.files?.length,
        },
      });

      const { match, uploadResults } = await this.repository.createWithFiles(
        data,
        files
      );

      const uploadWarnings = buildUploadWarnings(uploadResults);

      if (uploadWarnings.length > 0) {
        Sentry.captureMessage('Match created with upload warnings', {
          level: 'warning',
          extra: {
            matchId: match.id,
            warnings: uploadWarnings,
          },
        });
      }

      // Send notification (non-blocking)
      this.notificationService.notifyMatchCreated(match);

      return ok({ match, uploadWarnings });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchService', method: 'create' },
        extra: {
          dataKeys: Object.keys(data),
          hasImages: !!files.images?.length,
          hasFiles: !!files.files?.length,
        },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při vytváření zápasu',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Update an existing match with file uploads
   */
  async update(
    id: string,
    data: Partial<CreateMatchRequest>,
    files?: { images?: File[]; files?: File[] }
  ): Promise<Result<MatchWithUploads, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Updating match',
        level: 'info',
        data: {
          id,
          updatedFields: Object.keys(data),
          hasNewImages: !!files?.images?.length,
          hasNewFiles: !!files?.files?.length,
        },
      });

      const { match, uploadResults } = await this.repository.updateWithFiles(
        id,
        data,
        files
      );

      const uploadWarnings = buildUploadWarnings(uploadResults);

      if (uploadWarnings.length > 0) {
        Sentry.captureMessage('Match updated with upload warnings', {
          level: 'warning',
          extra: {
            matchId: id,
            warnings: uploadWarnings,
          },
        });
      }

      // Send notification (non-blocking)
      this.notificationService.notifyMatchUpdated(match);

      return ok({ match, uploadWarnings });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchService', method: 'update' },
        extra: { id, dataKeys: Object.keys(data) },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při aktualizaci zápasu',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Delete a match
   */
  async delete(id: string): Promise<Result<void, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Deleting match',
        level: 'info',
        data: { id },
      });

      await this.repository.delete(id);
      return ok(undefined);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchService', method: 'delete' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při mazání zápasu',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }
}
