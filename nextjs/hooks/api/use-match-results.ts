'use client';

/**
 * React hooks for match results API operations.
 */

import { useCallback } from 'react';
import { useMutation } from './useMutation';
import { MatchResult } from '@/types/match-result';
import { MatchResultFormData } from '@/lib/validation';

/**
 * Variables for creating a match result
 */
interface CreateMatchResultVariables {
  data: MatchResultFormData;
  images: FileList | null;
  files: FileList | null;
}

/**
 * Variables for updating a match result
 */
interface UpdateMatchResultVariables {
  data: MatchResultFormData;
  images: FileList | null;
  files: FileList | null;
}

/**
 * Response data from create/update operations
 */
interface MatchResultMutationResponse {
  matchResult: MatchResult;
}

/**
 * Hook for creating a new match result
 */
export function useCreateMatchResult(options?: {
  onSuccess?: (data: MatchResultMutationResponse, warnings?: string[]) => void;
  onError?: (error: string) => void;
}) {
  const transformVariables = useCallback(
    (variables: CreateMatchResultVariables): FormData => {
      const formData = new FormData();
      const { data, images, files } = variables;

      // Add form fields
      formData.append('homeTeam', data.homeTeam);
      formData.append('awayTeam', data.awayTeam);
      formData.append('homeScore', data.homeScore.toString());
      formData.append('awayScore', data.awayScore.toString());
      formData.append('category', data.category);
      formData.append('matchDate', data.matchDate);

      if (data.homeGoalscorers) {
        formData.append('homeGoalscorers', data.homeGoalscorers);
      }
      if (data.awayGoalscorers) {
        formData.append('awayGoalscorers', data.awayGoalscorers);
      }
      if (data.matchReport) {
        formData.append('matchReport', data.matchReport);
      }
      if (data.imagesUrl) {
        formData.append('imagesUrl', data.imagesUrl);
      }

      // Add images
      if (images) {
        Array.from(images).forEach((image) => {
          formData.append('images', image);
        });
      }

      // Add files
      if (files) {
        Array.from(files).forEach((file) => {
          formData.append('files', file);
        });
      }

      return formData;
    },
    []
  );

  return useMutation<MatchResultMutationResponse, CreateMatchResultVariables>({
    endpoint: '/api/match-results/create',
    method: 'POST',
    transformVariables,
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    fetchOptions: {
      timeout: 120000, // 2 minutes for file uploads
    },
  });
}

/**
 * Hook for updating an existing match result
 */
export function useUpdateMatchResult(
  recordId: string,
  options?: {
    onSuccess?: (data: MatchResultMutationResponse, warnings?: string[]) => void;
    onError?: (error: string) => void;
  }
) {
  const transformVariables = useCallback(
    (variables: UpdateMatchResultVariables): FormData => {
      const formData = new FormData();
      const { data, images, files } = variables;

      // Add form fields
      formData.append('homeTeam', data.homeTeam);
      formData.append('awayTeam', data.awayTeam);
      formData.append('homeScore', data.homeScore.toString());
      formData.append('awayScore', data.awayScore.toString());
      formData.append('category', data.category);
      formData.append('matchDate', data.matchDate);

      if (data.homeGoalscorers) {
        formData.append('homeGoalscorers', data.homeGoalscorers);
      }
      if (data.awayGoalscorers) {
        formData.append('awayGoalscorers', data.awayGoalscorers);
      }
      if (data.matchReport) {
        formData.append('matchReport', data.matchReport);
      }
      if (data.imagesUrl) {
        formData.append('imagesUrl', data.imagesUrl);
      }

      // Add images
      if (images) {
        Array.from(images).forEach((image) => {
          formData.append('images', image);
        });
      }

      // Add files
      if (files) {
        Array.from(files).forEach((file) => {
          formData.append('files', file);
        });
      }

      return formData;
    },
    []
  );

  return useMutation<MatchResultMutationResponse, UpdateMatchResultVariables>({
    endpoint: `/api/match-results/${recordId}`,
    method: 'PUT',
    transformVariables,
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    fetchOptions: {
      timeout: 120000, // 2 minutes for file uploads
    },
  });
}

/**
 * Hook for deleting a match result
 */
export function useDeleteMatchResult(options?: {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}) {
  const mutation = useMutation<void, { recordId: string }>({
    endpoint: '', // Will be set dynamically
    method: 'DELETE',
    onError: options?.onError,
  });

  // Override mutate to handle dynamic endpoint
  const deleteMatchResult = useCallback(
    async (recordId: string) => {
      const response = await fetch(`/api/match-results/${recordId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        const error = result.error || 'Nepodařilo se smazat výsledek zápasu';
        options?.onError?.(error);
        return { success: false, error };
      }

      options?.onSuccess?.();
      return { success: true };
    },
    [options]
  );

  return {
    ...mutation,
    deleteMatchResult,
  };
}
