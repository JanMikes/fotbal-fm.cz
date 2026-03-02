import { NextRequest } from 'next/server';
import {
  withErrorHandling,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { TeamRepository } from '@/lib/repositories';

export const GET = withErrorHandling(async (_request: NextRequest) => {
  addApiBreadcrumb('Listing teams', {});

  try {
    const repository = new TeamRepository();
    const teams = await repository.findAll();

    return apiSuccess({ teams });
  } catch (error) {
    console.error('[Teams API] Error fetching teams:', error);
    return ApiErrors.serverError('Nepodařilo se načíst týmy');
  }
});
