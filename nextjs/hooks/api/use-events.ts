'use client';

/**
 * React hooks for events API operations.
 */

import { useCallback } from 'react';
import { useMutation } from './useMutation';
import { Event } from '@/types/event';
import { EventFormData } from '@/lib/validation';

/**
 * Variables for creating an event
 */
interface CreateEventVariables {
  data: EventFormData;
  images: FileList | null;
  files: FileList | null;
}

/**
 * Variables for updating an event
 */
interface UpdateEventVariables {
  data: EventFormData;
  images: FileList | null;
  files: FileList | null;
}

/**
 * Response data from create/update operations
 */
interface EventMutationResponse {
  event: Event;
}

/**
 * Hook for creating a new event
 */
export function useCreateEvent(options?: {
  onSuccess?: (data: EventMutationResponse, warnings?: string[]) => void;
  onError?: (error: string) => void;
}) {
  const transformVariables = useCallback(
    (variables: CreateEventVariables): FormData => {
      const formData = new FormData();
      const { data, images, files } = variables;

      // Add form fields - match schema field names
      formData.append('name', data.name);
      formData.append('eventType', data.eventType);
      formData.append('dateFrom', data.dateFrom);

      if (data.dateTo) {
        formData.append('dateTo', data.dateTo);
      }
      if (data.publishDate) {
        formData.append('publishDate', data.publishDate);
      }
      if (data.eventTime) {
        formData.append('eventTime', data.eventTime);
      }
      if (data.eventTimeTo) {
        formData.append('eventTimeTo', data.eventTimeTo);
      }
      if (data.description) {
        formData.append('description', data.description);
      }
      if (data.requiresPhotographer !== undefined) {
        formData.append('requiresPhotographer', String(data.requiresPhotographer));
      }
      if (data.categoryIds && data.categoryIds.length > 0) {
        formData.append('categoryIds', JSON.stringify(data.categoryIds));
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

  return useMutation<EventMutationResponse, CreateEventVariables>({
    endpoint: '/api/events/create',
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
 * Hook for updating an existing event
 */
export function useUpdateEvent(
  recordId: string,
  options?: {
    onSuccess?: (data: EventMutationResponse, warnings?: string[]) => void;
    onError?: (error: string) => void;
  }
) {
  const transformVariables = useCallback(
    (variables: UpdateEventVariables): FormData => {
      const formData = new FormData();
      const { data, images, files } = variables;

      // Add form fields
      formData.append('name', data.name);
      formData.append('eventType', data.eventType);
      formData.append('dateFrom', data.dateFrom);

      if (data.dateTo) {
        formData.append('dateTo', data.dateTo);
      }
      if (data.publishDate) {
        formData.append('publishDate', data.publishDate);
      }
      if (data.eventTime) {
        formData.append('eventTime', data.eventTime);
      }
      if (data.eventTimeTo) {
        formData.append('eventTimeTo', data.eventTimeTo);
      }
      if (data.description) {
        formData.append('description', data.description);
      }
      if (data.requiresPhotographer !== undefined) {
        formData.append('requiresPhotographer', String(data.requiresPhotographer));
      }
      if (data.categoryIds && data.categoryIds.length > 0) {
        formData.append('categoryIds', JSON.stringify(data.categoryIds));
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

  return useMutation<EventMutationResponse, UpdateEventVariables>({
    endpoint: `/api/events/${recordId}`,
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
 * Hook for deleting an event
 */
export function useDeleteEvent(options?: {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}) {
  const deleteEvent = useCallback(
    async (recordId: string) => {
      const response = await fetch(`/api/events/${recordId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        const error = result.error || 'Nepodařilo se smazat událost';
        options?.onError?.(error);
        return { success: false, error };
      }

      options?.onSuccess?.();
      return { success: true };
    },
    [options]
  );

  return { deleteEvent };
}
