'use client';

import useSWR from 'swr';
import { Category } from '@/types/category';

interface CategoriesResponse {
  success: boolean;
  data: {
    categories: Category[];
  };
}

const fetcher = async (url: string): Promise<Category[]> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch categories');
  }

  const json: CategoriesResponse = await response.json();

  if (!json.success) {
    throw new Error('Failed to fetch categories');
  }

  return json.data.categories;
};

export function useCategories() {
  const { data, error, isLoading } = useSWR<Category[]>(
    '/api/categories',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  return {
    categories: data ?? [],
    isLoading,
    error,
  };
}
