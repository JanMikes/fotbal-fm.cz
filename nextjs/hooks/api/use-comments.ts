'use client';

/**
 * React hooks for comments API operations.
 */

import { useCallback } from 'react';
import { useMutation } from './useMutation';
import { Comment } from '@/types/comment';

/**
 * Entity type for comments
 */
type CommentEntityType = 'matchResult' | 'event' | 'tournament';

/**
 * Variables for creating a comment
 */
interface CreateCommentVariables {
  content: string;
  entityType: CommentEntityType;
  entityId: string;
  parentCommentId?: string;
}

/**
 * Response data from create comment
 */
interface CommentMutationResponse {
  comment: Comment;
}

/**
 * Hook for creating a new comment
 */
export function useCreateComment(options?: {
  onSuccess?: (data: CommentMutationResponse) => void;
  onError?: (error: string) => void;
}) {
  const transformVariables = useCallback(
    (variables: CreateCommentVariables): string => {
      // Build payload with dynamic entity type field
      const payload: Record<string, string | undefined> = {
        content: variables.content,
        [variables.entityType]: variables.entityId,
      };

      if (variables.parentCommentId) {
        payload.parentComment = variables.parentCommentId;
      }

      return JSON.stringify(payload);
    },
    []
  );

  return useMutation<CommentMutationResponse, CreateCommentVariables>({
    endpoint: '/api/comments',
    method: 'POST',
    transformVariables,
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/**
 * Hook for deleting a comment
 */
export function useDeleteComment(options?: {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}) {
  const deleteComment = useCallback(
    async (commentId: string) => {
      const response = await fetch(`/api/comments?id=${commentId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        const error = result.error || 'Nepodařilo se smazat komentář';
        options?.onError?.(error);
        return { success: false, error };
      }

      options?.onSuccess?.();
      return { success: true };
    },
    [options]
  );

  return { deleteComment };
}
