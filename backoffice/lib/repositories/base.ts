/**
 * Base repository interfaces and types.
 * Defines the contract for all repository implementations.
 */

import { Result } from '@/lib/core/result';
import { AppError } from '@/lib/core/errors';

/**
 * Options for finding entities
 */
export interface FindOptions {
  /** Page number (1-based) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Sort field and direction (e.g., 'createdAt:desc') */
  sort?: string | string[];
  /** Filter conditions */
  filters?: Record<string, unknown>;
  /** Fields to populate (relations) */
  populate?: string | string[] | Record<string, unknown>;
}

/**
 * Result of a paginated query
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
}

/**
 * Result of a file upload operation
 */
export interface UploadStatus {
  success: boolean;
  error?: string;
}

/**
 * Combined upload results for entities with multiple file fields
 */
export interface UploadResults {
  [field: string]: UploadStatus;
}

/**
 * Generic repository interface
 * Defines the standard CRUD operations for all entities
 */
export interface Repository<T, CreateDTO, UpdateDTO = Partial<CreateDTO>> {
  /**
   * Find an entity by its ID
   */
  findById(id: string, options?: FindOptions): Promise<T | null>;

  /**
   * Find all entities matching the given criteria
   */
  findAll(options?: FindOptions): Promise<T[]>;

  /**
   * Find entities with pagination
   */
  findPaginated(options?: FindOptions): Promise<PaginatedResult<T>>;

  /**
   * Create a new entity
   */
  create(data: CreateDTO): Promise<T>;

  /**
   * Update an existing entity
   */
  update(id: string, data: UpdateDTO): Promise<T>;

  /**
   * Delete an entity
   */
  delete(id: string): Promise<void>;
}

/**
 * Repository with file upload support
 */
export interface RepositoryWithUploads<T, CreateDTO, UpdateDTO = Partial<CreateDTO>>
  extends Repository<T, CreateDTO, UpdateDTO> {
  /**
   * Upload files to an existing entity
   */
  uploadFiles(
    id: string,
    files: Record<string, File[]>
  ): Promise<UploadResults>;
}

/**
 * Base options for filtering by user
 */
export interface UserFilterOptions extends FindOptions {
  /** Filter by author/user ID */
  userId?: number;
}
