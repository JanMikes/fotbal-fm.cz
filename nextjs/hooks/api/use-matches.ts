'use client';

/**
 * React hooks for match API operations.
 */

import { useCallback } from 'react';
import { useMutation } from './useMutation';
import { Match } from '@/types/match';
import { MatchFormData } from '@/lib/validation';

/**
 * Variables for creating a match
 */
interface CreateMatchVariables {
  data: MatchFormData;
  images: FileList | null;
  files: FileList | null;
}

/**
 * Variables for updating a match
 */
interface UpdateMatchVariables {
  data: MatchFormData;
  images: FileList | null;
  files: FileList | null;
}

/**
 * Response data from create/update operations
 */
interface MatchMutationResponse {
  match: Match;
}

/**
 * Hook for creating a new match
 */
export function useCreateMatch(options?: {
  onSuccess?: (data: MatchMutationResponse, warnings?: string[]) => void;
  onError?: (error: string) => void;
}) {
  const transformVariables = useCallback(
    (variables: CreateMatchVariables): FormData => {
      const formData = new FormData();
      const { data, images, files } = variables;

      // Add form fields
      formData.append('homeTeam', data.homeTeam);
      formData.append('awayTeam', data.awayTeam);
      formData.append('homeScore', data.homeScore.toString());
      formData.append('awayScore', data.awayScore.toString());
      formData.append('categoryIds', JSON.stringify(data.categoryIds));
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
      if (data.tournament) {
        formData.append('tournament', data.tournament);
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

  return useMutation<MatchMutationResponse, CreateMatchVariables>({
    endpoint: '/api/matches/create',
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
 * Hook for updating an existing match
 */
export function useUpdateMatch(
  recordId: string,
  options?: {
    onSuccess?: (data: MatchMutationResponse, warnings?: string[]) => void;
    onError?: (error: string) => void;
  }
) {
  const transformVariables = useCallback(
    (variables: UpdateMatchVariables): FormData => {
      const formData = new FormData();
      const { data, images, files } = variables;

      // Add form fields
      formData.append('homeTeam', data.homeTeam);
      formData.append('awayTeam', data.awayTeam);
      formData.append('homeScore', data.homeScore.toString());
      formData.append('awayScore', data.awayScore.toString());
      formData.append('categoryIds', JSON.stringify(data.categoryIds));
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
      if (data.tournament) {
        formData.append('tournament', data.tournament);
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

  return useMutation<MatchMutationResponse, UpdateMatchVariables>({
    endpoint: `/api/matches/${recordId}`,
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
 * Hook for deleting a match
 */
export function useDeleteMatch(options?: {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}) {
  const deleteMatch = useCallback(
    async (recordId: string) => {
      const response = await fetch(`/api/matches/${recordId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        const error = result.error || 'Nepodařilo se smazat zápas';
        options?.onError?.(error);
        return { success: false, error };
      }

      options?.onSuccess?.();
      return { success: true };
    },
    [options]
  );

  return { deleteMatch };
}
