/**
 * Strapi API client.
 * Provides a robust interface for communicating with Strapi CMS.
 */

import * as Sentry from '@sentry/nextjs';
import { HttpClient, createAuthenticatedClient } from '@/lib/core/http-client';
import {
  AppError,
  NetworkError,
  StrapiError,
  UploadError,
  ErrorCode,
} from '@/lib/core/errors';
import {
  StrapiSingleResponse,
  StrapiCollectionResponse,
  StrapiQueryOptions,
  StrapiRawMedia,
  UploadResult,
  buildStrapiQueryString,
} from './types';
import { config } from '@/lib/config';

export interface StrapiClientConfig {
  baseUrl?: string;
  apiToken?: string;
  timeout?: number;
}

/**
 * Strapi API client with built-in error handling and observability.
 */
export class StrapiClient {
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor(clientConfig?: StrapiClientConfig) {
    this.baseUrl = clientConfig?.baseUrl ?? config.STRAPI_URL;
    this.apiToken = clientConfig?.apiToken ?? config.STRAPI_API_TOKEN;

    this.httpClient = new HttpClient({
      baseUrl: this.baseUrl,
      timeout: clientConfig?.timeout ?? 30000,
      defaultHeaders: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    });
  }

  /**
   * Create a client authenticated with a user's JWT token
   */
  withUserAuth(jwt: string): StrapiClient {
    const client = new StrapiClient({
      baseUrl: this.baseUrl,
      timeout: 30000,
    });
    // Override the HTTP client with user authentication
    (client as unknown as { httpClient: HttpClient }).httpClient = createAuthenticatedClient(
      { baseUrl: this.baseUrl, timeout: 30000 },
      jwt
    );
    return client;
  }

  /**
   * Fetch a single entity by ID
   */
  async findOne<T>(
    contentType: string,
    id: string | number,
    options?: StrapiQueryOptions
  ): Promise<T | null> {
    const queryString = options ? buildStrapiQueryString(options) : '';
    const endpoint = `/api/${contentType}/${id}${queryString}`;

    try {
      const response = await this.httpClient.get<StrapiSingleResponse<T>>(endpoint);
      return response.data;
    } catch (error) {
      this.handleError(error, `findOne ${contentType}/${id}`);
    }
  }

  /**
   * Fetch multiple entities
   */
  async findMany<T>(
    contentType: string,
    options?: StrapiQueryOptions
  ): Promise<{ data: T[]; pagination?: { page: number; pageSize: number; pageCount: number; total: number } }> {
    const queryString = options ? buildStrapiQueryString(options) : '';
    const endpoint = `/api/${contentType}${queryString}`;

    try {
      const response = await this.httpClient.get<StrapiCollectionResponse<T>>(endpoint);

      return {
        data: response.data,
        pagination: response.meta?.pagination,
      };
    } catch (error) {
      this.handleError(error, `findMany ${contentType}`);
    }
  }

  /**
   * Create a new entity
   */
  async create<T>(
    contentType: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const endpoint = `/api/${contentType}`;

    try {
      const response = await this.httpClient.post<StrapiSingleResponse<T>>(endpoint, { data });

      if (!response.data) {
        throw new StrapiError(
          `Failed to create ${contentType}: no data returned`,
          500
        );
      }

      return response.data;
    } catch (error) {
      this.handleError(error, `create ${contentType}`);
    }
  }

  /**
   * Update an existing entity
   */
  async update<T>(
    contentType: string,
    id: string | number,
    data: Record<string, unknown>
  ): Promise<T> {
    const endpoint = `/api/${contentType}/${id}`;

    try {
      const response = await this.httpClient.put<StrapiSingleResponse<T>>(endpoint, { data });

      if (!response.data) {
        throw new StrapiError(
          `Failed to update ${contentType}/${id}: no data returned`,
          500
        );
      }

      return response.data;
    } catch (error) {
      this.handleError(error, `update ${contentType}/${id}`);
    }
  }

  /**
   * Delete an entity
   */
  async delete(contentType: string, id: string | number): Promise<void> {
    const endpoint = `/api/${contentType}/${id}`;

    try {
      await this.httpClient.delete(endpoint);
    } catch (error) {
      this.handleError(error, `delete ${contentType}/${id}`);
    }
  }

  /**
   * Upload files to Strapi and optionally link to an entity
   */
  async upload(
    files: File[],
    options?: {
      ref?: string;
      refId?: number | string;
      field?: string;
    }
  ): Promise<UploadResult> {
    if (files.length === 0) {
      return { success: true, uploadedFiles: [] };
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    if (options?.ref) {
      formData.append('ref', options.ref);
    }
    if (options?.refId !== undefined) {
      formData.append('refId', String(options.refId));
    }
    if (options?.field) {
      formData.append('field', options.field);
    }

    // Add Sentry breadcrumb for upload
    Sentry.addBreadcrumb({
      category: 'strapi',
      message: 'File upload',
      level: 'info',
      data: {
        fileCount: files.length,
        fileNames: files.map(f => f.name),
        ref: options?.ref,
        field: options?.field,
      },
    });

    try {
      const uploadedFiles = await this.httpClient.upload<StrapiRawMedia[]>(
        '/api/upload',
        formData
      );

      return {
        success: true,
        uploadedFiles,
      };
    } catch (error) {
      // Log upload error but don't throw - allow partial success
      console.error('[StrapiClient] Upload failed:', error);

      Sentry.captureException(error, {
        tags: { operation: 'upload' },
        extra: {
          fileCount: files.length,
          ref: options?.ref,
          field: options?.field,
        },
      });

      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Upload files and link them to an existing entity
   * Returns success status and any errors (for partial success handling)
   */
  async uploadToEntity(
    files: File[],
    ref: string,
    refId: number | string,
    field: string
  ): Promise<UploadResult> {
    return this.upload(files, { ref, refId, field });
  }

  /**
   * Authentication: Login with credentials
   */
  async login(
    identifier: string,
    password: string
  ): Promise<{ jwt: string; user: unknown }> {
    try {
      const response = await this.httpClient.post<{ jwt: string; user: unknown }>(
        '/api/auth/local',
        { identifier, password }
      );
      return response;
    } catch (error) {
      this.handleError(error, 'login');
    }
  }

  /**
   * Authentication: Register new user
   */
  async register(
    username: string,
    email: string,
    password: string
  ): Promise<{ jwt: string; user: unknown }> {
    try {
      const response = await this.httpClient.post<{ jwt: string; user: unknown }>(
        '/api/auth/local/register',
        { username, email, password }
      );
      return response;
    } catch (error) {
      this.handleError(error, 'register');
    }
  }

  /**
   * Get current user info
   */
  async getMe(): Promise<unknown> {
    try {
      return await this.httpClient.get('/api/users/me');
    } catch (error) {
      this.handleError(error, 'getMe');
    }
  }

  /**
   * Update user profile
   */
  async updateUser(
    userId: number,
    data: Record<string, unknown>
  ): Promise<unknown> {
    try {
      return await this.httpClient.put(`/api/users/${userId}`, data);
    } catch (error) {
      this.handleError(error, `updateUser ${userId}`);
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      await this.httpClient.post('/api/auth/change-password', {
        currentPassword,
        password: newPassword,
        passwordConfirmation: newPassword,
      });
    } catch (error) {
      this.handleError(error, 'changePassword');
    }
  }

  /**
   * Handle and transform errors from HTTP client
   */
  private handleError(error: unknown, operation: string): never {
    // Add context to Sentry
    Sentry.setContext('strapi_operation', {
      operation,
      baseUrl: this.baseUrl,
    });

    // Re-throw AppError instances
    if (error instanceof AppError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new NetworkError('Nepodařilo se připojit ke Strapi serveru', {
        operation,
        originalError: error.message,
      });
    }

    // Generic error handling
    const message = error instanceof Error
      ? error.message
      : 'Chyba při komunikaci se Strapi';

    throw new StrapiError(message, 500, {
      operation,
      originalError: error,
    });
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let defaultClient: StrapiClient | null = null;

/**
 * Get the default Strapi client instance (service-to-service with API token)
 */
export function getStrapiClient(): StrapiClient {
  if (!defaultClient) {
    defaultClient = new StrapiClient();
  }
  return defaultClient;
}

/**
 * Create a Strapi client authenticated with a user's JWT
 */
export function getUserStrapiClient(jwt: string): StrapiClient {
  return getStrapiClient().withUserAuth(jwt);
}
