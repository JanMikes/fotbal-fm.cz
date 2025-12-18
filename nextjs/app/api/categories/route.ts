import { NextRequest } from 'next/server';
import {
  withErrorHandling,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { CategoryRepository } from '@/lib/repositories';

export const GET = withErrorHandling(async (request: NextRequest) => {
  addApiBreadcrumb('Listing categories', {});

  try {
    const repository = new CategoryRepository();
    const categories = await repository.findAll();

    return apiSuccess({ categories });
  } catch (error) {
    console.error('[Categories API] Error fetching categories:', error);
    return ApiErrors.serverError('Nepodařilo se načíst kategorie');
  }
});
