/**
 * Match Result Service.
 * Handles business logic for match result operations.
 */

import * as Sentry from '@sentry/nextjs';
import { MatchResult, CreateMatchResultRequest } from '@/types/match-result';
import { MatchResultRepository, UploadResults, PaginatedResult } from '@/lib/repositories';
import { Result, ok, err } from '@/lib/core/result';
import { AppError, NotFoundError, ErrorCode } from '@/lib/core/errors';
import { createUserMatchResultRepository } from '@/lib/di';

/**
 * Result of a create/update operation with file uploads
 */
export interface MatchResultWithUploads {
  matchResult: MatchResult;
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

export class MatchResultService {
  constructor(private readonly repository: MatchResultRepository) {}

  /**
   * Create a service instance authenticated with user's JWT
   */
  static forUser(jwt: string): MatchResultService {
    return new MatchResultService(createUserMatchResultRepository(jwt));
  }

  /**
   * Get a match result by ID
   */
  async getById(id: string): Promise<Result<MatchResult, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting match result by ID',
        level: 'info',
        data: { id },
      });

      const matchResult = await this.repository.findById(id);

      if (!matchResult) {
        return err(new NotFoundError(`Výsledek zápasu s ID ${id} nebyl nalezen`));
      }

      return ok(matchResult);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchResultService', method: 'getById' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání výsledku zápasu',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all match results for a user
   */
  async getByUser(userId: number): Promise<Result<MatchResult[], AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting match results for user',
        level: 'info',
        data: { userId },
      });

      const matchResults = await this.repository.findByUser(userId);
      return ok(matchResults);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchResultService', method: 'getByUser' },
        extra: { userId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání výsledků zápasů',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all match results with optional user filter
   */
  async getAll(userId?: number): Promise<Result<MatchResult[], AppError>> {
    try {
      const matchResults = await this.repository.findAll({ userId });
      return ok(matchResults);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchResultService', method: 'getAll' },
        extra: { userId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání výsledků zápasů',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Create a new match result with file uploads
   */
  async create(
    data: CreateMatchResultRequest,
    files: { images?: File[]; files?: File[] }
  ): Promise<Result<MatchResultWithUploads, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Creating match result',
        level: 'info',
        data: {
          homeTeam: data.homeTeam,
          awayTeam: data.awayTeam,
          hasImages: !!files.images?.length,
          hasFiles: !!files.files?.length,
        },
      });

      const { matchResult, uploadResults } = await this.repository.createWithFiles(
        data,
        files
      );

      const uploadWarnings = buildUploadWarnings(uploadResults);

      // Log warnings to Sentry if any
      if (uploadWarnings.length > 0) {
        Sentry.captureMessage('Match result created with upload warnings', {
          level: 'warning',
          extra: {
            matchResultId: matchResult.id,
            warnings: uploadWarnings,
          },
        });
      }

      return ok({ matchResult, uploadWarnings });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchResultService', method: 'create' },
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
        'Chyba při vytváření výsledku zápasu',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Update an existing match result with file uploads
   */
  async update(
    id: string,
    data: Partial<CreateMatchResultRequest>,
    files?: { images?: File[]; files?: File[] }
  ): Promise<Result<MatchResultWithUploads, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Updating match result',
        level: 'info',
        data: {
          id,
          updatedFields: Object.keys(data),
          hasNewImages: !!files?.images?.length,
          hasNewFiles: !!files?.files?.length,
        },
      });

      const { matchResult, uploadResults } = await this.repository.updateWithFiles(
        id,
        data,
        files
      );

      const uploadWarnings = buildUploadWarnings(uploadResults);

      if (uploadWarnings.length > 0) {
        Sentry.captureMessage('Match result updated with upload warnings', {
          level: 'warning',
          extra: {
            matchResultId: id,
            warnings: uploadWarnings,
          },
        });
      }

      return ok({ matchResult, uploadWarnings });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchResultService', method: 'update' },
        extra: { id, dataKeys: Object.keys(data) },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při aktualizaci výsledku zápasu',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Delete a match result
   */
  async delete(id: string): Promise<Result<void, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Deleting match result',
        level: 'info',
        data: { id },
      });

      await this.repository.delete(id);
      return ok(undefined);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'MatchResultService', method: 'delete' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při mazání výsledku zápasu',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }
}
