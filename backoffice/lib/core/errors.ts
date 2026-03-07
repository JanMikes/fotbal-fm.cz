/**
 * Custom error classes for the application.
 * These provide structured error handling with error codes and HTTP status codes.
 */

export enum ErrorCode {
  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',

  // Authentication/Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  // Network/External service errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  STRAPI_ERROR = 'STRAPI_ERROR',

  // File handling errors
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',

  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Base application error class.
 * All custom errors should extend this class.
 */
export class AppError extends Error {
  public readonly timestamp: Date;

  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to a plain object for logging or API response
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

/**
 * Validation error - thrown when input data fails validation
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.VALIDATION_FAILED, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error - thrown when user is not authenticated
 */
export class AuthError extends AppError {
  constructor(
    message: string = 'Nejste přihlášeni',
    code: ErrorCode = ErrorCode.UNAUTHORIZED
  ) {
    super(message, code, 401);
    this.name = 'AuthError';
  }
}

/**
 * Forbidden error - thrown when user lacks permission
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Nemáte oprávnění k této akci') {
    super(message, ErrorCode.FORBIDDEN, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Not found error - thrown when a resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Záznam nebyl nalezen') {
    super(message, ErrorCode.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Network error - thrown when external service communication fails
 */
export class NetworkError extends AppError {
  constructor(
    message: string = 'Chyba připojení k serveru',
    details?: unknown
  ) {
    super(message, ErrorCode.NETWORK_ERROR, 503, details);
    this.name = 'NetworkError';
  }
}

/**
 * Timeout error - thrown when request times out
 */
export class TimeoutError extends AppError {
  constructor(message: string = 'Požadavek vypršel, zkuste to znovu') {
    super(message, ErrorCode.TIMEOUT, 504);
    this.name = 'TimeoutError';
  }
}

/**
 * Strapi-specific error - thrown when Strapi API returns an error
 */
export class StrapiError extends AppError {
  constructor(
    message: string,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message, ErrorCode.STRAPI_ERROR, statusCode, details);
    this.name = 'StrapiError';
  }
}

/**
 * Upload error - thrown when file upload fails
 */
export class UploadError extends AppError {
  constructor(
    message: string = 'Nahrávání souborů selhalo',
    details?: unknown
  ) {
    super(message, ErrorCode.UPLOAD_FAILED, 500, details);
    this.name = 'UploadError';
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Extract a user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Nastala neočekávaná chyba';
}

/**
 * Convert any error to an AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    return new AppError(
      error.message,
      ErrorCode.UNKNOWN_ERROR,
      500,
      { originalError: error.name, stack: error.stack }
    );
  }
  return new AppError(
    getErrorMessage(error),
    ErrorCode.UNKNOWN_ERROR,
    500,
    { originalError: error }
  );
}
