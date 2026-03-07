'use client';

/**
 * Generic mutation hook for API operations.
 * Provides a consistent interface for create/update/delete operations.
 */

import { useState, useRef, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import type { MutationState, MutationResult, ApiResponse, FetchOptions } from './types';

/**
 * Options for the useMutation hook
 */
interface UseMutationOptions<TData, TVariables> {
  /** The API endpoint to call */
  endpoint: string;
  /** HTTP method (default: POST) */
  method?: 'POST' | 'PUT' | 'DELETE';
  /** Transform variables before sending (useful for FormData) */
  transformVariables?: (variables: TVariables) => FormData | string | Record<string, unknown>;
  /** Callback on success */
  onSuccess?: (data: TData, warnings?: string[]) => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Fetch options */
  fetchOptions?: FetchOptions;
}

/**
 * Return type for the useMutation hook
 */
interface UseMutationReturn<TData, TVariables> extends MutationState<TData> {
  /** Execute the mutation */
  mutate: (variables: TVariables) => Promise<MutationResult<TData>>;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * A generic mutation hook for API operations.
 * Handles loading states, errors, warnings, and prevents double-submissions.
 */
export function useMutation<TData = unknown, TVariables = unknown>({
  endpoint,
  method = 'POST',
  transformVariables,
  onSuccess,
  onError,
  fetchOptions = {},
}: UseMutationOptions<TData, TVariables>): UseMutationReturn<TData, TVariables> {
  const [state, setState] = useState<MutationState<TData>>({
    isLoading: false,
    error: null,
    warnings: null,
    data: null,
  });

  // Ref to prevent double-submissions
  const isSubmittingRef = useRef(false);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      warnings: null,
      data: null,
    });
  }, []);

  const mutate = useCallback(
    async (variables: TVariables): Promise<MutationResult<TData>> => {
      // Prevent double-submission
      if (isSubmittingRef.current) {
        return { success: false, error: 'Operace již probíhá' };
      }

      isSubmittingRef.current = true;
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        warnings: null,
      }));

      try {
        // Add Sentry breadcrumb for the request
        Sentry.addBreadcrumb({
          category: 'mutation',
          message: `${method} ${endpoint}`,
          level: 'info',
          data: {
            endpoint,
            method,
          },
        });

        // Transform variables if transformer provided
        const body = transformVariables ? transformVariables(variables) : variables;

        // Determine content type and body format
        let requestBody: FormData | string;
        let headers: Record<string, string> = { ...fetchOptions.headers };

        if (body instanceof FormData) {
          requestBody = body;
          // Don't set Content-Type for FormData - browser will set it with boundary
        } else if (typeof body === 'string') {
          requestBody = body;
          headers['Content-Type'] = 'application/json';
        } else {
          requestBody = JSON.stringify(body);
          headers['Content-Type'] = 'application/json';
        }

        // Setup abort controller for timeout
        const controller = new AbortController();
        const timeout = fetchOptions.timeout ?? 60000; // 60 second default for uploads
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(endpoint, {
          method,
          headers,
          body: requestBody,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Parse response
        let result: ApiResponse<TData>;
        try {
          result = await response.json();
        } catch {
          throw new Error('Neplatná odpověď serveru');
        }

        if (!result.success) {
          const error = result.error || 'Nastala neočekávaná chyba';
          setState({
            isLoading: false,
            error,
            warnings: null,
            data: null,
          });
          onError?.(error);
          return { success: false, error };
        }

        // Success
        const warnings = result.warnings ?? null;
        setState({
          isLoading: false,
          error: null,
          warnings,
          data: result.data,
        });
        onSuccess?.(result.data, warnings ?? undefined);
        return { success: true, data: result.data, warnings: warnings ?? undefined };
      } catch (err) {
        let error: string;

        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            error = 'Požadavek vypršel, zkuste to znovu';
          } else {
            error = err.message;
          }
        } else {
          error = 'Nastala neočekávaná chyba';
        }

        // Log error to Sentry with context
        Sentry.captureException(err, {
          tags: {
            type: 'mutation_error',
            endpoint,
            method,
          },
          extra: {
            error,
          },
        });

        setState({
          isLoading: false,
          error,
          warnings: null,
          data: null,
        });
        onError?.(error);
        return { success: false, error };
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [endpoint, method, transformVariables, onSuccess, onError, fetchOptions]
  );

  return {
    ...state,
    mutate,
    reset,
  };
}
