/**
 * Comment repository.
 * Handles all data access operations for comments.
 */

import { Comment, CreateCommentRequest } from '@/types/comment';
import { StrapiClient, StrapiRawComment, mapComment, mapComments } from '@/lib/infrastructure/strapi';
import {
  Repository,
  FindOptions,
  PaginatedResult,
} from './base';

const CONTENT_TYPE = 'comments';

/**
 * Entity types that can have comments
 */
export type CommentableEntity = 'matchResult' | 'tournament' | 'event';

/**
 * Build Strapi query options for comments
 */
function buildQueryOptions(
  entityType: CommentableEntity,
  entityId: string,
  options?: FindOptions
) {
  // Build populate for author with specific fields (to avoid "Invalid key role" error)
  const authorPopulate = {
    author: {
      fields: ['id', 'documentId', 'firstname', 'lastname'],
    },
    replies: {
      populate: {
        author: {
          fields: ['id', 'documentId', 'firstname', 'lastname'],
        },
      },
    },
  };

  const queryOptions: {
    populate?: Record<string, unknown>;
    sort?: string | string[];
    pagination?: { page?: number; pageSize?: number; limit?: number };
    filters?: Record<string, unknown>;
  } = {
    populate: authorPopulate,
    sort: options?.sort ?? 'createdAt:desc',
  };

  if (options?.page || options?.pageSize) {
    queryOptions.pagination = {
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  // Filter by entity (using documentId for Strapi 5)
  queryOptions.filters = {
    [entityType]: { documentId: { $eq: entityId } },
    // Only get top-level comments (no parent)
    parentComment: { id: { $null: true } },
  };

  if (options?.filters) {
    queryOptions.filters = {
      ...queryOptions.filters,
      ...options.filters,
    };
  }

  return queryOptions;
}

export class CommentRepository implements Repository<
  Comment,
  CreateCommentRequest
> {
  constructor(private readonly client: StrapiClient) {}

  async findById(id: string, options?: FindOptions): Promise<Comment | null> {
    const queryOptions = {
      populate: options?.populate ?? {
        author: {
          fields: ['id', 'documentId', 'firstname', 'lastname'],
        },
        replies: {
          populate: {
            author: {
              fields: ['id', 'documentId', 'firstname', 'lastname'],
            },
          },
        },
      },
    };

    const raw = await this.client.findOne<StrapiRawComment>(
      CONTENT_TYPE,
      id,
      queryOptions
    );

    if (!raw) {
      return null;
    }

    return mapComment(raw);
  }

  async findAll(options?: FindOptions): Promise<Comment[]> {
    const queryOptions = {
      populate: {
        author: {
          fields: ['id', 'documentId', 'firstname', 'lastname'],
        },
      },
      sort: options?.sort ?? 'createdAt:desc',
      pagination: { limit: 100 },
    };

    const result = await this.client.findMany<StrapiRawComment>(
      CONTENT_TYPE,
      queryOptions
    );

    return mapComments(result.data);
  }

  async findPaginated(options?: FindOptions): Promise<PaginatedResult<Comment>> {
    const queryOptions = {
      populate: {
        author: {
          fields: ['id', 'documentId', 'firstname', 'lastname'],
        },
      },
      sort: options?.sort ?? 'createdAt:desc',
      pagination: options?.page || options?.pageSize
        ? { page: options.page, pageSize: options.pageSize }
        : undefined,
    };

    const result = await this.client.findMany<StrapiRawComment>(
      CONTENT_TYPE,
      queryOptions
    );

    return {
      data: mapComments(result.data),
      pagination: result.pagination ?? {
        page: 1,
        pageSize: result.data.length,
        pageCount: 1,
        total: result.data.length,
      },
    };
  }

  /**
   * Find comments for a specific entity (match result, tournament, or event)
   */
  async findByEntity(
    entityType: CommentableEntity,
    entityId: string,
    options?: FindOptions
  ): Promise<Comment[]> {
    const queryOptions = buildQueryOptions(entityType, entityId, options);
    queryOptions.pagination = { limit: 100 };

    const result = await this.client.findMany<StrapiRawComment>(
      CONTENT_TYPE,
      queryOptions
    );

    return mapComments(result.data);
  }

  async create(data: CreateCommentRequest): Promise<Comment> {
    const raw = await this.client.create<StrapiRawComment>(
      CONTENT_TYPE,
      data as unknown as Record<string, unknown>
    );

    return mapComment(raw);
  }

  async update(id: string, data: Partial<CreateCommentRequest>): Promise<Comment> {
    const raw = await this.client.update<StrapiRawComment>(
      CONTENT_TYPE,
      id,
      data as unknown as Record<string, unknown>
    );

    return mapComment(raw);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(CONTENT_TYPE, id);
  }
}
