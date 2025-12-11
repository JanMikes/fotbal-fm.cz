/**
 * Standardized API response utilities.
 * Provides consistent response formatting for all API routes.
 */

import { NextResponse } from 'next/server';
import { AppError, ErrorCode, getErrorMessage, isAppError } from '@/lib/core/errors';

/**
 * Standard success response structure
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  warnings?: string[];
}

/**
 * Standard error response structure
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: ErrorCode;
  details?: unknown;
}

/**
 * Create a success response
 */
export function apiSuccess<T>(
  data: T,
  options?: {
    status?: number;
    warnings?: string[];
    headers?: Record<string, string>;
  }
): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  if (options?.warnings && options.warnings.length > 0) {
    body.warnings = options.warnings;
  }

  return NextResponse.json(body, {
    status: options?.status ?? 200,
    headers: options?.headers,
  });
}

/**
 * Create an error response
 */
export function apiError(
  message: string,
  options?: {
    status?: number;
    code?: ErrorCode;
    details?: unknown;
    headers?: Record<string, string>;
  }
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    success: false,
    error: message,
  };

  if (options?.code) {
    body.code = options.code;
  }

  if (options?.details) {
    body.details = options.details;
  }

  return NextResponse.json(body, {
    status: options?.status ?? 500,
    headers: options?.headers,
  });
}

/**
 * Create an error response from an AppError
 */
export function apiErrorFromAppError(
  error: AppError,
  headers?: Record<string, string>
): NextResponse<ApiErrorResponse> {
  return apiError(error.message, {
    status: error.statusCode,
    code: error.code,
    details: error.details,
    headers,
  });
}

/**
 * Handle unknown errors and convert to API response
 */
export function handleApiError(
  error: unknown,
  headers?: Record<string, string>
): NextResponse<ApiErrorResponse> {
  // Handle AppError instances
  if (isAppError(error)) {
    return apiErrorFromAppError(error, headers);
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    return apiError(error.message, {
      status: 500,
      code: ErrorCode.UNKNOWN_ERROR,
      headers,
    });
  }

  // Handle unknown errors
  return apiError(getErrorMessage(error), {
    status: 500,
    code: ErrorCode.UNKNOWN_ERROR,
    headers,
  });
}

/**
 * Common error responses
 */
export const ApiErrors = {
  unauthorized: (message = 'Nejste přihlášeni') =>
    apiError(message, { status: 401, code: ErrorCode.UNAUTHORIZED }),

  forbidden: (message = 'Nemáte oprávnění k této akci') =>
    apiError(message, { status: 403, code: ErrorCode.FORBIDDEN }),

  notFound: (message = 'Záznam nebyl nalezen') =>
    apiError(message, { status: 404, code: ErrorCode.NOT_FOUND }),

  badRequest: (message: string, details?: unknown) =>
    apiError(message, { status: 400, code: ErrorCode.VALIDATION_FAILED, details }),

  serverError: (message = 'Nastala neočekávaná chyba') =>
    apiError(message, { status: 500, code: ErrorCode.INTERNAL_ERROR }),

  validationFailed: (message: string, details?: unknown) =>
    apiError(message, { status: 400, code: ErrorCode.VALIDATION_FAILED, details }),
};
