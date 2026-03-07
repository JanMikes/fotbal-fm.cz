/**
 * Common types for API hooks.
 */

import { ErrorCode } from '@/lib/core/errors';

/**
 * API response structure for success
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  warnings?: string[];
}

/**
 * API response structure for error
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: ErrorCode;
  details?: unknown;
}

/**
 * Union type for API responses
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Mutation state for create/update operations
 */
export interface MutationState<T = unknown> {
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Error message if the mutation failed */
  error: string | null;
  /** Warnings from the mutation (e.g., partial upload failures) */
  warnings: string[] | null;
  /** The data returned from a successful mutation */
  data: T | null;
}

/**
 * Result of a mutation operation
 */
export interface MutationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

/**
 * Options for fetch operations
 */
export interface FetchOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom headers to include */
  headers?: Record<string, string>;
}
