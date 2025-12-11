/**
 * Event repository.
 * Handles all data access operations for events.
 */

import { Event, CreateEventRequest } from '@/types/event';
import { StrapiClient, StrapiRawEvent, mapEvent, mapEvents } from '@/lib/infrastructure/strapi';
import {
  RepositoryWithUploads,
  FindOptions,
  PaginatedResult,
  UploadResults,
  UserFilterOptions,
} from './base';
import { NotFoundError } from '@/lib/core/errors';

const CONTENT_TYPE = 'events';
const STRAPI_REF = 'api::event.event';

/**
 * Build Strapi query options from find options
 */
function buildQueryOptions(options?: UserFilterOptions) {
  const queryOptions: {
    populate?: string;
    sort?: string | string[];
    pagination?: { page?: number; pageSize?: number; limit?: number };
    filters?: Record<string, unknown>;
  } = {
    populate: '*',
  };

  if (options?.sort) {
    queryOptions.sort = options.sort;
  } else {
    queryOptions.sort = 'createdAt:desc';
  }

  if (options?.page || options?.pageSize) {
    queryOptions.pagination = {
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  if (options?.userId) {
    queryOptions.filters = {
      author: { id: { $eq: options.userId } },
    };
  }

  if (options?.filters) {
    queryOptions.filters = {
      ...queryOptions.filters,
      ...options.filters,
    };
  }

  return queryOptions;
}

export class EventRepository implements RepositoryWithUploads<
  Event,
  CreateEventRequest
> {
  constructor(private readonly client: StrapiClient) {}

  async findById(id: string, options?: FindOptions): Promise<Event | null> {
    const queryOptions = {
      populate: options?.populate ?? '*',
    };

    const raw = await this.client.findOne<StrapiRawEvent>(
      CONTENT_TYPE,
      id,
      queryOptions
    );

    if (!raw) {
      return null;
    }

    return mapEvent(raw);
  }

  async findAll(options?: UserFilterOptions): Promise<Event[]> {
    const queryOptions = buildQueryOptions(options);
    queryOptions.pagination = { limit: 100 };

    const result = await this.client.findMany<StrapiRawEvent>(
      CONTENT_TYPE,
      queryOptions
    );

    return mapEvents(result.data);
  }

  async findPaginated(options?: UserFilterOptions): Promise<PaginatedResult<Event>> {
    const queryOptions = buildQueryOptions(options);

    const result = await this.client.findMany<StrapiRawEvent>(
      CONTENT_TYPE,
      queryOptions
    );

    return {
      data: mapEvents(result.data),
      pagination: result.pagination ?? {
        page: 1,
        pageSize: result.data.length,
        pageCount: 1,
        total: result.data.length,
      },
    };
  }

  async findByUser(userId: number, options?: FindOptions): Promise<Event[]> {
    return this.findAll({ ...options, userId });
  }

  async create(data: CreateEventRequest): Promise<Event> {
    const raw = await this.client.create<StrapiRawEvent>(
      CONTENT_TYPE,
      data as unknown as Record<string, unknown>
    );

    return mapEvent(raw);
  }

  async update(id: string, data: Partial<CreateEventRequest>): Promise<Event> {
    const raw = await this.client.update<StrapiRawEvent>(
      CONTENT_TYPE,
      id,
      data as unknown as Record<string, unknown>
    );

    return mapEvent(raw);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(CONTENT_TYPE, id);
  }

  async uploadFiles(
    id: string,
    files: Record<string, File[]>
  ): Promise<UploadResults> {
    const results: UploadResults = {};

    const entity = await this.client.findOne<StrapiRawEvent>(CONTENT_TYPE, id);
    if (!entity) {
      throw new NotFoundError(`Událost s ID ${id} nebyla nalezena`);
    }
    const numericId = (entity as { id: number }).id;

    // Upload photos
    if (files.photos && files.photos.length > 0) {
      const uploadResult = await this.client.uploadToEntity(
        files.photos,
        STRAPI_REF,
        numericId,
        'photos'
      );
      results.photos = {
        success: uploadResult.success,
        error: uploadResult.error,
      };
    }

    // Upload files
    if (files.files && files.files.length > 0) {
      const uploadResult = await this.client.uploadToEntity(
        files.files,
        STRAPI_REF,
        numericId,
        'files'
      );
      results.files = {
        success: uploadResult.success,
        error: uploadResult.error,
      };
    }

    return results;
  }

  async createWithFiles(
    data: CreateEventRequest,
    files: { photos?: File[]; files?: File[] }
  ): Promise<{ event: Event; uploadResults: UploadResults }> {
    const event = await this.create(data);

    const filesToUpload: Record<string, File[]> = {};
    if (files.photos && files.photos.length > 0) {
      filesToUpload.photos = files.photos;
    }
    if (files.files && files.files.length > 0) {
      filesToUpload.files = files.files;
    }

    let uploadResults: UploadResults = {};
    if (Object.keys(filesToUpload).length > 0) {
      uploadResults = await this.uploadFiles(event.id, filesToUpload);
    }

    const updated = await this.findById(event.id);

    return {
      event: updated ?? event,
      uploadResults,
    };
  }

  async updateWithFiles(
    id: string,
    data: Partial<CreateEventRequest>,
    files?: { photos?: File[]; files?: File[] }
  ): Promise<{ event: Event; uploadResults: UploadResults }> {
    const event = await this.update(id, data);

    const filesToUpload: Record<string, File[]> = {};
    if (files?.photos && files.photos.length > 0) {
      filesToUpload.photos = files.photos;
    }
    if (files?.files && files.files.length > 0) {
      filesToUpload.files = files.files;
    }

    let uploadResults: UploadResults = {};
    if (Object.keys(filesToUpload).length > 0) {
      uploadResults = await this.uploadFiles(id, filesToUpload);
    }

    const updated = await this.findById(id);

    return {
      event: updated ?? event,
      uploadResults,
    };
  }
}
