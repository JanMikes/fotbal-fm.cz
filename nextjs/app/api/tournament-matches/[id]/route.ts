import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
  setFormContext,
} from '@/lib/api';
import { TournamentMatchService } from '@/lib/services';
import { tournamentMatchApiSchema } from '@/lib/validation';

export const GET = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  // Extract ID from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  addApiBreadcrumb('Getting tournament match', { id });

  const service = TournamentMatchService.forUser(jwt);
  const result = await service.getById(id);

  if (!result.success) {
    if (result.error.code === 'NOT_FOUND') {
      return ApiErrors.notFound(result.error.message);
    }
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ tournamentMatch: result.data });
});

export const PUT = withAuth(async (
  request: NextRequest,
  { userId, jwt }
) => {
  // Extract ID from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  addApiBreadcrumb('Updating tournament match', { id, userId });

  setFormContext('TournamentMatchForm', {
    mode: 'edit',
    entityId: id,
  });

  const service = TournamentMatchService.forUser(jwt);

  // Check ownership
  const existingResult = await service.getById(id);
  if (!existingResult.success) {
    if (existingResult.error.code === 'NOT_FOUND') {
      return ApiErrors.notFound(existingResult.error.message);
    }
    return ApiErrors.serverError(existingResult.error.message);
  }

  if (existingResult.data.authorId !== userId) {
    return ApiErrors.forbidden('Nemáte oprávnění upravit tento záznam');
  }

  // Parse and validate body
  const body = await request.json();
  const validationResult = tournamentMatchApiSchema.safeParse(body);

  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  const updateResult = await service.update(id, validationResult.data);

  if (!updateResult.success) {
    return ApiErrors.serverError(updateResult.error.message);
  }

  return apiSuccess({ tournamentMatch: updateResult.data });
});
