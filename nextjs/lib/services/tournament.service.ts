/**
 * Tournament Service.
 * Handles business logic for tournament operations.
 */

import * as Sentry from '@sentry/nextjs';
import { Tournament, CreateTournamentRequest } from '@/types/tournament';
import { TournamentRepository, UploadResults } from '@/lib/repositories';
import { Result, ok, err } from '@/lib/core/result';
import { AppError, NotFoundError, ErrorCode } from '@/lib/core/errors';
import { createUserTournamentRepository } from '@/lib/di';
import { NotificationService, getNotificationService } from './notification.service';

/**
 * Result of a create/update operation with file uploads
 */
export interface TournamentWithUploads {
  tournament: Tournament;
  uploadWarnings: string[];
}

/**
 * Convert upload results to warning messages
 */
function buildUploadWarnings(uploads: UploadResults): string[] {
  const warnings: string[] = [];

  if (uploads.photos && !uploads.photos.success) {
    warnings.push(uploads.photos.error ?? 'Nepodařilo se nahrát fotografie');
  }

  return warnings;
}

export class TournamentService {
  private readonly notificationService: NotificationService;

  constructor(
    private readonly repository: TournamentRepository,
    notificationService?: NotificationService
  ) {
    this.notificationService = notificationService ?? getNotificationService();
  }

  /**
   * Create a service instance authenticated with user's JWT
   */
  static forUser(jwt: string): TournamentService {
    return new TournamentService(createUserTournamentRepository(jwt));
  }

  /**
   * Get a tournament by ID
   */
  async getById(id: string): Promise<Result<Tournament, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting tournament by ID',
        level: 'info',
        data: { id },
      });

      const tournament = await this.repository.findById(id);

      if (!tournament) {
        return err(new NotFoundError(`Turnaj s ID ${id} nebyl nalezen`));
      }

      return ok(tournament);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentService', method: 'getById' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all tournaments for a user
   */
  async getByUser(userId: number): Promise<Result<Tournament[], AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting tournaments for user',
        level: 'info',
        data: { userId },
      });

      const tournaments = await this.repository.findByUser(userId);
      return ok(tournaments);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentService', method: 'getByUser' },
        extra: { userId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání turnajů',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all tournaments with optional user filter
   */
  async getAll(userId?: number): Promise<Result<Tournament[], AppError>> {
    try {
      const tournaments = await this.repository.findAll({ userId });
      return ok(tournaments);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentService', method: 'getAll' },
        extra: { userId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání turnajů',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all tournaments for dropdown selection
   */
  async getAllForDropdown(): Promise<Result<Tournament[], AppError>> {
    try {
      const tournaments = await this.repository.findAllForDropdown();
      return ok(tournaments);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentService', method: 'getAllForDropdown' },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání turnajů',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Create a new tournament with file uploads
   */
  async create(
    data: CreateTournamentRequest,
    files: { photos?: File[] }
  ): Promise<Result<TournamentWithUploads, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Creating tournament',
        level: 'info',
        data: {
          name: data.name,
          categoriesCount: data.categories?.length || 0,
          hasPhotos: !!files.photos?.length,
        },
      });

      const { tournament, uploadResults } = await this.repository.createWithFiles(
        data,
        files
      );

      const uploadWarnings = buildUploadWarnings(uploadResults);

      if (uploadWarnings.length > 0) {
        Sentry.captureMessage('Tournament created with upload warnings', {
          level: 'warning',
          extra: {
            tournamentId: tournament.id,
            warnings: uploadWarnings,
          },
        });
      }

      // Send notification (non-blocking)
      // matchCount is 0 here as matches are created separately in API route
      this.notificationService.notifyTournamentCreated(tournament, 0);

      return ok({ tournament, uploadWarnings });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentService', method: 'create' },
        extra: {
          dataKeys: Object.keys(data),
          hasPhotos: !!files.photos?.length,
        },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při vytváření turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Update an existing tournament with file uploads
   */
  async update(
    id: string,
    data: Partial<CreateTournamentRequest>,
    files?: { photos?: File[] }
  ): Promise<Result<TournamentWithUploads, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Updating tournament',
        level: 'info',
        data: {
          id,
          updatedFields: Object.keys(data),
          hasNewPhotos: !!files?.photos?.length,
        },
      });

      const { tournament, uploadResults } = await this.repository.updateWithFiles(
        id,
        data,
        files
      );

      const uploadWarnings = buildUploadWarnings(uploadResults);

      if (uploadWarnings.length > 0) {
        Sentry.captureMessage('Tournament updated with upload warnings', {
          level: 'warning',
          extra: {
            tournamentId: id,
            warnings: uploadWarnings,
          },
        });
      }

      // Send notification (non-blocking)
      this.notificationService.notifyTournamentUpdated(tournament, 0);

      return ok({ tournament, uploadWarnings });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentService', method: 'update' },
        extra: { id, dataKeys: Object.keys(data) },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při aktualizaci turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Delete a tournament
   */
  async delete(id: string): Promise<Result<void, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Deleting tournament',
        level: 'info',
        data: { id },
      });

      await this.repository.delete(id);
      return ok(undefined);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentService', method: 'delete' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při mazání turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }
}
