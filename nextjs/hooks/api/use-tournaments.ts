'use client';

/**
 * React hooks for tournaments API operations.
 */

import { useCallback } from 'react';
import { useMutation } from './useMutation';
import { Tournament } from '@/types/tournament';
import { TournamentFormData } from '@/lib/validation';

/**
 * Variables for creating a tournament
 */
interface CreateTournamentVariables {
  data: TournamentFormData;
  images: FileList | null;
  files: FileList | null;
}

/**
 * Variables for updating a tournament
 */
interface UpdateTournamentVariables {
  data: TournamentFormData;
  images: FileList | null;
  files: FileList | null;
}

/**
 * Response data from create/update operations
 */
interface TournamentMutationResponse {
  tournament: Tournament;
}

/**
 * Hook for creating a new tournament
 */
export function useCreateTournament(options?: {
  onSuccess?: (data: TournamentMutationResponse, warnings?: string[]) => void;
  onError?: (error: string) => void;
}) {
  const transformVariables = useCallback(
    (variables: CreateTournamentVariables): FormData => {
      const formData = new FormData();
      const { data, images, files } = variables;

      // Add form fields - match schema field names
      formData.append('name', data.name);
      formData.append('dateFrom', data.dateFrom);
      formData.append('category', data.category);

      if (data.dateTo) {
        formData.append('dateTo', data.dateTo);
      }
      if (data.description) {
        formData.append('description', data.description);
      }
      if (data.location) {
        formData.append('location', data.location);
      }
      if (data.imagesUrl) {
        formData.append('imagesUrl', data.imagesUrl);
      }
      if (data.matches && data.matches.length > 0) {
        formData.append('matches', JSON.stringify(data.matches));
      }
      if (data.players && data.players.length > 0) {
        formData.append('players', JSON.stringify(data.players));
      }

      // Add photos (images field maps to 'photos' in Strapi)
      if (images) {
        Array.from(images).forEach((image) => {
          formData.append('photos', image);
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

  return useMutation<TournamentMutationResponse, CreateTournamentVariables>({
    endpoint: '/api/tournaments/create',
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
 * Hook for updating an existing tournament
 */
export function useUpdateTournament(
  recordId: string,
  options?: {
    onSuccess?: (data: TournamentMutationResponse, warnings?: string[]) => void;
    onError?: (error: string) => void;
  }
) {
  const transformVariables = useCallback(
    (variables: UpdateTournamentVariables): FormData => {
      const formData = new FormData();
      const { data, images, files } = variables;

      // Add form fields
      formData.append('name', data.name);
      formData.append('dateFrom', data.dateFrom);
      formData.append('category', data.category);

      if (data.dateTo) {
        formData.append('dateTo', data.dateTo);
      }
      if (data.description) {
        formData.append('description', data.description);
      }
      if (data.location) {
        formData.append('location', data.location);
      }
      if (data.imagesUrl) {
        formData.append('imagesUrl', data.imagesUrl);
      }
      if (data.matches && data.matches.length > 0) {
        formData.append('matches', JSON.stringify(data.matches));
      }
      if (data.players && data.players.length > 0) {
        formData.append('players', JSON.stringify(data.players));
      }

      // Add photos
      if (images) {
        Array.from(images).forEach((image) => {
          formData.append('photos', image);
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

  return useMutation<TournamentMutationResponse, UpdateTournamentVariables>({
    endpoint: `/api/tournaments/${recordId}`,
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
 * Hook for deleting a tournament
 */
export function useDeleteTournament(options?: {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}) {
  const deleteTournament = useCallback(
    async (recordId: string) => {
      const response = await fetch(`/api/tournaments/${recordId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        const error = result.error || 'Nepodařilo se smazat turnaj';
        options?.onError?.(error);
        return { success: false, error };
      }

      options?.onSuccess?.();
      return { success: true };
    },
    [options]
  );

  return { deleteTournament };
}
