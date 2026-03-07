/**
 * Robust HTTP client with timeout, error handling, and Sentry integration.
 * This is the foundation for all external API communication.
 */

import * as Sentry from '@sentry/nextjs';
import {
  AppError,
  NetworkError,
  TimeoutError,
  ErrorCode,
} from './errors';

export interface HttpClientConfig {
  baseUrl: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  /** Skip adding Sentry breadcrumbs for this request */
  skipBreadcrumb?: boolean;
}

interface HttpClientRequestOptions extends RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
}

/**
 * HTTP client with built-in timeout, error handling, and observability.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultTimeout = config.timeout ?? 30000; // 30 seconds default
    this.defaultHeaders = config.defaultHeaders ?? {};
  }

  /**
   * Make an HTTP request with timeout and error handling
   */
  async request<T>(
    endpoint: string,
    options: HttpClientRequestOptions
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    const timeout = options.timeout ?? this.defaultTimeout;
    const headers = this.buildHeaders(options.headers);

    // Add Sentry breadcrumb
    if (!options.skipBreadcrumb) {
      Sentry.addBreadcrumb({
        category: 'http',
        message: `${options.method} ${endpoint}`,
        level: 'info',
        data: {
          url,
          method: options.method,
          hasBody: !!options.body,
        },
      });
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response body
      const data = await this.parseResponse<T>(response);

      // Handle non-OK responses
      if (!response.ok) {
        throw this.createErrorFromResponse(response.status, data);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError();
      }

      // Re-throw AppError instances
      if (error instanceof AppError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Nepodařilo se připojit k serveru', {
          originalError: error.message,
        });
      }

      // Unknown error
      throw new NetworkError('Chyba při komunikaci se serverem', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Make a GET request
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * Make a PUT request
   */
  async put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Make a PATCH request
   */
  async patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  /**
   * Upload files using FormData
   */
  async upload<T>(
    endpoint: string,
    formData: FormData,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    const timeout = options?.timeout ?? this.defaultTimeout;

    // Don't set Content-Type - browser will set it with boundary for FormData
    const headers: Record<string, string> = { ...this.defaultHeaders };
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }
    // Remove Content-Type so browser can set it with proper boundary
    delete headers['Content-Type'];

    // Add Sentry breadcrumb
    if (!options?.skipBreadcrumb) {
      Sentry.addBreadcrumb({
        category: 'http',
        message: `UPLOAD ${endpoint}`,
        level: 'info',
        data: {
          url,
          formDataKeys: [...formData.keys()],
        },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await this.parseResponse<T>(response);

      if (!response.ok) {
        throw this.createErrorFromResponse(response.status, data);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError('Nahrávání souborů vypršelo');
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new NetworkError('Chyba při nahrávání souborů', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Build full URL from endpoint
   */
  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${cleanEndpoint}`;
  }

  /**
   * Build headers for request
   */
  private buildHeaders(
    customHeaders?: Record<string, string>
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
      ...customHeaders,
    };
  }

  /**
   * Safely parse response body as JSON
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const text = await response.text();

    if (!text) {
      return null as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      // If response is not JSON, throw with response text
      throw new AppError(
        'Neplatná odpověď serveru',
        ErrorCode.STRAPI_ERROR,
        response.status,
        { responseText: text.slice(0, 500) }
      );
    }
  }

  /**
   * Create appropriate error from response status and data
   */
  private createErrorFromResponse(status: number, data: unknown): AppError {
    const message = this.extractErrorMessage(data);

    // Map status codes to error types
    if (status === 401) {
      return new AppError(
        message || 'Nejste přihlášeni',
        ErrorCode.UNAUTHORIZED,
        401,
        data
      );
    }

    if (status === 403) {
      return new AppError(
        message || 'Nemáte oprávnění k této akci',
        ErrorCode.FORBIDDEN,
        403,
        data
      );
    }

    if (status === 404) {
      return new AppError(
        message || 'Záznam nebyl nalezen',
        ErrorCode.NOT_FOUND,
        404,
        data
      );
    }

    if (status >= 400 && status < 500) {
      return new AppError(
        message || 'Neplatný požadavek',
        ErrorCode.VALIDATION_FAILED,
        status,
        data
      );
    }

    if (status >= 500) {
      return new AppError(
        message || 'Chyba serveru, zkuste to prosím později',
        ErrorCode.STRAPI_ERROR,
        status,
        data
      );
    }

    return new AppError(
      message || 'Neznámá chyba',
      ErrorCode.UNKNOWN_ERROR,
      status,
      data
    );
  }

  /**
   * Extract error message from response data
   */
  private extractErrorMessage(data: unknown): string | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    // Strapi error format: { error: { message: "..." } }
    if ('error' in data && typeof data.error === 'object' && data.error) {
      const strapiError = data.error as Record<string, unknown>;
      if (typeof strapiError.message === 'string') {
        return strapiError.message;
      }
    }

    // Generic error format: { message: "..." }
    if ('message' in data && typeof data.message === 'string') {
      return data.message;
    }

    // Array of errors: { errors: [{ message: "..." }] }
    if ('errors' in data && Array.isArray(data.errors) && data.errors.length > 0) {
      const firstError = data.errors[0];
      if (typeof firstError === 'object' && firstError && 'message' in firstError) {
        return String(firstError.message);
      }
    }

    return null;
  }
}

/**
 * Create an HTTP client with authorization header
 */
export function createAuthenticatedClient(
  config: HttpClientConfig,
  token: string
): HttpClient {
  return new HttpClient({
    ...config,
    defaultHeaders: {
      ...config.defaultHeaders,
      Authorization: `Bearer ${token}`,
    },
  });
}
