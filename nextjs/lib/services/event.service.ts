/**
 * Event Service.
 * Handles business logic for event operations.
 */

import * as Sentry from '@sentry/nextjs';
import { Event, CreateEventRequest } from '@/types/event';
import { EventRepository, UploadResults } from '@/lib/repositories';
import { Result, ok, err } from '@/lib/core/result';
import { AppError, NotFoundError, ErrorCode } from '@/lib/core/errors';
import { createUserEventRepository } from '@/lib/di';
import { NotificationService, getNotificationService } from './notification.service';

/**
 * Result of a create/update operation with file uploads
 */
export interface EventWithUploads {
  event: Event;
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
  if (uploads.files && !uploads.files.success) {
    warnings.push(uploads.files.error ?? 'Nepodařilo se nahrát přílohy');
  }

  return warnings;
}

export class EventService {
  private readonly notificationService: NotificationService;

  constructor(
    private readonly repository: EventRepository,
    notificationService?: NotificationService
  ) {
    this.notificationService = notificationService ?? getNotificationService();
  }

  /**
   * Create a service instance authenticated with user's JWT
   */
  static forUser(jwt: string): EventService {
    return new EventService(createUserEventRepository(jwt));
  }

  /**
   * Get an event by ID
   */
  async getById(id: string): Promise<Result<Event, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting event by ID',
        level: 'info',
        data: { id },
      });

      const event = await this.repository.findById(id);

      if (!event) {
        return err(new NotFoundError(`Událost s ID ${id} nebyla nalezena`));
      }

      return ok(event);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'EventService', method: 'getById' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání události',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all events for a user
   */
  async getByUser(userId: number): Promise<Result<Event[], AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting events for user',
        level: 'info',
        data: { userId },
      });

      const events = await this.repository.findByUser(userId);
      return ok(events);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'EventService', method: 'getByUser' },
        extra: { userId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání událostí',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all events with optional user filter
   */
  async getAll(userId?: number): Promise<Result<Event[], AppError>> {
    try {
      const events = await this.repository.findAll({ userId });
      return ok(events);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'EventService', method: 'getAll' },
        extra: { userId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání událostí',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Create a new event with file uploads
   */
  async create(
    data: CreateEventRequest,
    files: { photos?: File[]; files?: File[] }
  ): Promise<Result<EventWithUploads, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Creating event',
        level: 'info',
        data: {
          name: data.name,
          eventType: data.eventType,
          hasPhotos: !!files.photos?.length,
          hasFiles: !!files.files?.length,
        },
      });

      const { event, uploadResults } = await this.repository.createWithFiles(
        data,
        files
      );

      const uploadWarnings = buildUploadWarnings(uploadResults);

      if (uploadWarnings.length > 0) {
        Sentry.captureMessage('Event created with upload warnings', {
          level: 'warning',
          extra: {
            eventId: event.id,
            warnings: uploadWarnings,
          },
        });
      }

      // Send notification (non-blocking)
      this.notificationService.notifyEventCreated(event);

      return ok({ event, uploadWarnings });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'EventService', method: 'create' },
        extra: {
          dataKeys: Object.keys(data),
          hasPhotos: !!files.photos?.length,
          hasFiles: !!files.files?.length,
        },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při vytváření události',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Update an existing event with file uploads
   */
  async update(
    id: string,
    data: Partial<CreateEventRequest>,
    files?: { photos?: File[]; files?: File[] }
  ): Promise<Result<EventWithUploads, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Updating event',
        level: 'info',
        data: {
          id,
          updatedFields: Object.keys(data),
          hasNewPhotos: !!files?.photos?.length,
          hasNewFiles: !!files?.files?.length,
        },
      });

      const { event, uploadResults } = await this.repository.updateWithFiles(
        id,
        data,
        files
      );

      const uploadWarnings = buildUploadWarnings(uploadResults);

      if (uploadWarnings.length > 0) {
        Sentry.captureMessage('Event updated with upload warnings', {
          level: 'warning',
          extra: {
            eventId: id,
            warnings: uploadWarnings,
          },
        });
      }

      // Send notification (non-blocking)
      this.notificationService.notifyEventUpdated(event);

      return ok({ event, uploadWarnings });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'EventService', method: 'update' },
        extra: { id, dataKeys: Object.keys(data) },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při aktualizaci události',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Delete an event
   */
  async delete(id: string): Promise<Result<void, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Deleting event',
        level: 'info',
        data: { id },
      });

      await this.repository.delete(id);
      return ok(undefined);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'EventService', method: 'delete' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při mazání události',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }
}
