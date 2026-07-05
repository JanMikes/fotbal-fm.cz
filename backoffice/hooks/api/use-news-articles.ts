'use client';

/**
 * React hooks for news article API operations.
 */

import { useCallback } from 'react';
import { useMutation } from './useMutation';
import { NewsArticle } from '@/types/news-article';

/**
 * Variables for creating a news article
 */
export interface CreateNewsArticleVariables {
  title: string;
  description: string;
  /** Full ISO datetime of publication */
  date: string;
  video?: string;
  categoryIds: string[];
  /** Existing Strapi upload id to use as main photo */
  mainPhotoId?: number;
  /** Existing Strapi upload ids to attach to the gallery */
  galleryIds?: number[];
  /** Existing Strapi upload ids to attach as documents */
  fileIds?: number[];
  /** Newly selected photos to upload */
  gallery: FileList | null;
}

interface NewsArticleMutationResponse {
  article: NewsArticle;
}

/**
 * Hook for creating a news article
 */
export function useCreateNewsArticle(options?: {
  onSuccess?: (data: NewsArticleMutationResponse, warnings?: string[]) => void;
  onError?: (error: string) => void;
}) {
  const transformVariables = useCallback(
    (variables: CreateNewsArticleVariables): FormData => {
      const formData = new FormData();

      formData.append('title', variables.title);
      formData.append('description', variables.description);
      formData.append('date', variables.date);
      formData.append('categoryIds', JSON.stringify(variables.categoryIds));

      if (variables.video) {
        formData.append('video', variables.video);
      }
      if (variables.mainPhotoId) {
        formData.append('mainPhotoId', String(variables.mainPhotoId));
      }
      if (variables.galleryIds && variables.galleryIds.length > 0) {
        formData.append('galleryIds', JSON.stringify(variables.galleryIds));
      }
      if (variables.fileIds && variables.fileIds.length > 0) {
        formData.append('fileIds', JSON.stringify(variables.fileIds));
      }

      if (variables.gallery) {
        Array.from(variables.gallery).forEach((file) => {
          formData.append('gallery', file);
        });
      }

      return formData;
    },
    []
  );

  return useMutation<NewsArticleMutationResponse, CreateNewsArticleVariables>({
    endpoint: '/api/news-articles/create',
    method: 'POST',
    transformVariables,
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    fetchOptions: {
      timeout: 120000, // 2 minutes for file uploads
    },
  });
}
