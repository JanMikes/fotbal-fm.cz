/**
 * API route middleware utilities.
 * Provides authentication checking, error handling, request logging, and Sentry context.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSession } from '@/lib/session';
import { SessionData } from '@/types/session';
import {
  apiError,
  handleApiError,
  ApiErrors,
  ApiSuccessResponse,
  ApiErrorResponse,
} from './response';
import { AppError, ErrorCode } from '@/lib/core/errors';
import {
  buildRequestContext,
  logFormDataSubmission,
  logJsonSubmission,
  setSentryFormContext,
  setSentryJsonContext,
  logErrorWithContext,
  captureErrorWithContext,
  type RequestLogContext,
} from './logging';

/**
 * Session context provided to authenticated handlers
 */
export interface AuthContext {
  session: SessionData;
  userId: number;
  jwt: string;
}

/**
 * Extended auth context with pre-parsed FormData
 * IMPORTANT: For routes with file uploads, FormData must be parsed BEFORE getSession()
 * due to a Next.js production issue where cookies() locks the request body
 */
export interface AuthContextWithFormData extends AuthContext {
  formData: FormData;
}

/**
 * Extended auth context with pre-parsed JSON body
 */
export interface AuthContextWithJson extends AuthContext {
  body: unknown;
}

/**
 * Handler function type for authenticated routes
 */
export type AuthenticatedHandler<T = unknown> = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse<ApiSuccessResponse<T> | ApiErrorResponse>>;

/**
 * Handler function type for authenticated routes with FormData
 */
export type AuthenticatedFormDataHandler<T = unknown> = (
  request: NextRequest,
  context: AuthContextWithFormData
) => Promise<NextResponse<ApiSuccessResponse<T> | ApiErrorResponse>>;

/**
 * Handler function type for authenticated routes with JSON body
 */
export type AuthenticatedJsonHandler<T = unknown> = (
  request: NextRequest,
  context: AuthContextWithJson
) => Promise<NextResponse<ApiSuccessResponse<T> | ApiErrorResponse>>;

/**
 * Handler function type for public routes
 */
export type PublicHandler<T = unknown> = (
  request: NextRequest
) => Promise<NextResponse<ApiSuccessResponse<T> | ApiErrorResponse>>;

/**
 * Handler function type for public routes with JSON body
 */
export type PublicJsonHandler<T = unknown> = (
  request: NextRequest,
  body: unknown
) => Promise<NextResponse<ApiSuccessResponse<T> | ApiErrorResponse>>;

/**
 * Wrap a handler with authentication check
 * Automatically handles session validation and error responses
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>
): (request: NextRequest) => Promise<NextResponse<ApiSuccessResponse<T> | ApiErrorResponse>> {
  return async (request: NextRequest) => {
    const handlerName = 'withAuth';
    let logContext: RequestLogContext | undefined;

    try {
      // Get session
      const session = await getSession();

      // Check authentication
      if (!session.isLoggedIn || !session.jwt || !session.userId) {
        return ApiErrors.unauthorized();
      }

      // Build log context
      logContext = buildRequestContext(request, session.userId, session.email);

      // Set Sentry user context
      Sentry.setUser({
        id: String(session.userId),
        email: session.email,
      });

      // Add request context to Sentry
      Sentry.setContext('request', {
        requestId: logContext.requestId,
        url: request.url,
        method: request.method,
        path: logContext.path,
        userId: session.userId,
        handler: handlerName,
      });

      // Create auth context
      const authContext: AuthContext = {
        session: {
          userId: session.userId,
          email: session.email,
          jwt: session.jwt,
          isLoggedIn: session.isLoggedIn,
        },
        userId: session.userId,
        jwt: session.jwt,
      };

      // Call the handler
      return await handler(request, authContext);
    } catch (error) {
      // Build context if not already built
      if (!logContext) {
        logContext = buildRequestContext(request);
      }

      // Log error to stdout
      logErrorWithContext(logContext, error, handlerName);

      // Capture to Sentry
      captureErrorWithContext(logContext, error, handlerName);

      return handleApiError(error);
    }
  };
}

/**
 * Wrap a handler with authentication check for JSON body routes
 * Parses JSON body and logs it to stdout and Sentry
 */
export function withAuthJson<T = unknown>(
  handler: AuthenticatedJsonHandler<T>
): (request: NextRequest) => Promise<NextResponse<ApiSuccessResponse<T> | ApiErrorResponse>> {
  return async (request: NextRequest) => {
    const handlerName = 'withAuthJson';
    let logContext: RequestLogContext | undefined;
    let body: unknown;

    try {
      // Parse JSON body first
      body = await request.json();

      // Get session
      const session = await getSession();

      // Check authentication
      if (!session.isLoggedIn || !session.jwt || !session.userId) {
        return ApiErrors.unauthorized();
      }

      // Build log context
      logContext = buildRequestContext(request, session.userId, session.email);

      // Log submission to stdout
      logJsonSubmission(logContext, body, handlerName);

      // Set Sentry context with body data
      setSentryJsonContext(logContext, body, handlerName);

      // Create auth context with body
      const authContext: AuthContextWithJson = {
        session: {
          userId: session.userId,
          email: session.email,
          jwt: session.jwt,
          isLoggedIn: session.isLoggedIn,
        },
        userId: session.userId,
        jwt: session.jwt,
        body,
      };

      // Call the handler
      return await handler(request, authContext);
    } catch (error) {
      // Build context if not already built
      if (!logContext) {
        logContext = buildRequestContext(request);
      }

      // Log error to stdout with body data
      logErrorWithContext(
        logContext,
        error,
        handlerName,
        body !== undefined ? { type: 'json', data: body } : undefined
      );

      // Capture to Sentry with body data
      captureErrorWithContext(
        logContext,
        error,
        handlerName,
        body !== undefined ? { type: 'json', data: body } : undefined
      );

      return handleApiError(error);
    }
  };
}

/**
 * Wrap a handler with authentication check for FormData routes
 * CRITICAL: This parses FormData BEFORE getSession() to avoid the Next.js production bug
 * where cookies() locks the request body when dealing with large uploads
 */
export function withAuthFormData<T = unknown>(
  handler: AuthenticatedFormDataHandler<T>
): (request: NextRequest) => Promise<NextResponse<ApiSuccessResponse<T> | ApiErrorResponse>> {
  return async (request: NextRequest) => {
    const handlerName = 'withAuthFormData';
    let logContext: RequestLogContext | undefined;
    let formData: FormData | undefined;

    try {
      // CRITICAL: Must parse formData FIRST before calling getSession()
      // Even with middleware skipping API routes, getSession() uses cookies()
      // which locks the request body in production when dealing with large uploads
      formData = await request.formData();

      // Get session AFTER parsing formData
      const session = await getSession();

      // Check authentication
      if (!session.isLoggedIn || !session.jwt || !session.userId) {
        return ApiErrors.unauthorized();
      }

      // Build log context
      logContext = buildRequestContext(request, session.userId, session.email);

      // Log submission to stdout
      logFormDataSubmission(logContext, formData, handlerName);

      // Set Sentry context with form data
      setSentryFormContext(logContext, formData, handlerName);

      // Create auth context with formData
      const authContext: AuthContextWithFormData = {
        session: {
          userId: session.userId,
          email: session.email,
          jwt: session.jwt,
          isLoggedIn: session.isLoggedIn,
        },
        userId: session.userId,
        jwt: session.jwt,
        formData,
      };

      // Call the handler
      return await handler(request, authContext);
    } catch (error) {
      // Build context if not already built
      if (!logContext) {
        logContext = buildRequestContext(request);
      }

      // Log error to stdout with form data
      logErrorWithContext(
        logContext,
        error,
        handlerName,
        formData ? { type: 'form', data: formData } : undefined
      );

      // Capture to Sentry with form data
      captureErrorWithContext(
        logContext,
        error,
        handlerName,
        formData ? { type: 'form', data: formData } : undefined
      );

      return handleApiError(error);
    }
  };
}

/**
 * Wrap a public handler with error handling
 */
export function withErrorHandling<T = unknown>(
  handler: PublicHandler<T>
): (request: NextRequest) => Promise<NextResponse<ApiSuccessResponse<T> | ApiErrorResponse>> {
  return async (request: NextRequest) => {
    const handlerName = 'withErrorHandling';
    const logContext = buildRequestContext(request);

    try {
      // Add request context to Sentry
      Sentry.setContext('request', {
        requestId: logContext.requestId,
        url: request.url,
        method: request.method,
        path: logContext.path,
        handler: handlerName,
      });

      return await handler(request);
    } catch (error) {
      // Log error to stdout
      logErrorWithContext(logContext, error, handlerName);

      // Capture to Sentry
      captureErrorWithContext(logContext, error, handlerName);

      return handleApiError(error);
    }
  };
}

/**
 * Wrap a public handler with JSON body parsing and logging
 */
export function withJsonBody<T = unknown>(
  handler: PublicJsonHandler<T>
): (request: NextRequest) => Promise<NextResponse<ApiSuccessResponse<T> | ApiErrorResponse>> {
  return async (request: NextRequest) => {
    const handlerName = 'withJsonBody';
    const logContext = buildRequestContext(request);
    let body: unknown;

    try {
      // Parse JSON body
      body = await request.json();

      // Log submission to stdout
      logJsonSubmission(logContext, body, handlerName);

      // Set Sentry context with body data
      setSentryJsonContext(logContext, body, handlerName);

      return await handler(request, body);
    } catch (error) {
      // Log error to stdout with body data
      logErrorWithContext(
        logContext,
        error,
        handlerName,
        body !== undefined ? { type: 'json', data: body } : undefined
      );

      // Capture to Sentry with body data
      captureErrorWithContext(
        logContext,
        error,
        handlerName,
        body !== undefined ? { type: 'json', data: body } : undefined
      );

      return handleApiError(error);
    }
  };
}

/**
 * Add Sentry breadcrumb for API operation
 */
export function addApiBreadcrumb(
  operation: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'api',
    message: operation,
    level: 'info',
    data,
  });
}

/**
 * Set form context for Sentry error tracking
 * @deprecated Use setSentryFormContext from logging module instead
 */
export function setFormContext(
  formName: string,
  data: {
    mode?: 'create' | 'edit';
    entityId?: string;
    fields?: string[];
    hasFiles?: boolean;
  }
): void {
  Sentry.setContext('form', {
    name: formName,
    ...data,
  });
}
