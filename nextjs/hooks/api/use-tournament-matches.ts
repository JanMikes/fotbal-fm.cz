'use client';

/**
 * React hooks for tournament matches API operations.
 */

import { useCallback } from 'react';
import { useMutation } from './useMutation';
import { TournamentMatch } from '@/types/tournament-match';
import { TournamentMatchFormData } from '@/lib/validation';

/**
 * Variables for creating a tournament match
 */
interface CreateTournamentMatchVariables {
  data: TournamentMatchFormData;
}

/**
 * Variables for updating a tournament match
 */
interface UpdateTournamentMatchVariables {
  data: TournamentMatchFormData;
}

/**
 * Response data from create/update operations
 */
interface TournamentMatchMutationResponse {
  match: TournamentMatch;
}

/**
 * Hook for creating a new tournament match
 */
export function useCreateTournamentMatch(options?: {
  onSuccess?: (data: TournamentMatchMutationResponse, warnings?: string[]) => void;
  onError?: (error: string) => void;
}) {
  return useMutation<TournamentMatchMutationResponse, CreateTournamentMatchVariables>({
    endpoint: '/api/tournament-matches/create',
    method: 'POST',
    transformVariables: (variables) => JSON.stringify(variables.data),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/**
 * Hook for updating an existing tournament match
 */
export function useUpdateTournamentMatch(
  recordId: string,
  options?: {
    onSuccess?: (data: TournamentMatchMutationResponse, warnings?: string[]) => void;
    onError?: (error: string) => void;
  }
) {
  return useMutation<TournamentMatchMutationResponse, UpdateTournamentMatchVariables>({
    endpoint: `/api/tournament-matches/${recordId}`,
    method: 'PUT',
    transformVariables: (variables) => JSON.stringify(variables.data),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/**
 * Hook for deleting a tournament match
 */
export function useDeleteTournamentMatch(options?: {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}) {
  const deleteTournamentMatch = useCallback(
    async (recordId: string) => {
      const response = await fetch(`/api/tournament-matches/${recordId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        const error = result.error || 'Nepodařilo se smazat turnajový zápas';
        options?.onError?.(error);
        return { success: false, error };
      }

      options?.onSuccess?.();
      return { success: true };
    },
    [options]
  );

  return { deleteTournamentMatch };
}
