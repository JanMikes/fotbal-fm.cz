import { NextRequest } from 'next/server';
import {
  withAuth,
  withAuthFormData,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
  setFormContext,
  getStringField,
  getFiles,
} from '@/lib/api';
import { MatchService } from '@/lib/services';
import { matchApiSchema } from '@/lib/validation';

export const GET = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  // Extract ID from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  addApiBreadcrumb('Getting match', { id });

  const service = MatchService.forUser(jwt);
  const result = await service.getById(id);

  if (!result.success) {
    if (result.error.code === 'NOT_FOUND') {
      return ApiErrors.notFound(result.error.message);
    }
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ match: result.data });
});

export const PUT = withAuthFormData(async (
  request: NextRequest,
  { userId, jwt, formData }
) => {
  // Extract ID from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  addApiBreadcrumb('Updating match', { id, userId });

  setFormContext('MatchForm', {
    mode: 'edit',
    entityId: id,
    fields: [...formData.keys()],
    hasFiles: formData.has('images') || formData.has('files'),
  });

  const service = MatchService.forUser(jwt);

  // Parse categories from JSON
  const categoryIdsJson = getStringField(formData, 'categoryIds');
  let categories: string[] = [];
  if (categoryIdsJson) {
    try {
      categories = JSON.parse(categoryIdsJson);
    } catch {
      return ApiErrors.validationFailed('Neplatný formát kategorií');
    }
  }

  // Extract form fields
  const matchData = {
    homeTeam: getStringField(formData, 'homeTeam'),
    awayTeam: getStringField(formData, 'awayTeam'),
    homeScore: getStringField(formData, 'homeScore'),
    awayScore: getStringField(formData, 'awayScore'),
    homeGoalscorers: getStringField(formData, 'homeGoalscorers'),
    awayGoalscorers: getStringField(formData, 'awayGoalscorers'),
    matchReport: getStringField(formData, 'matchReport'),
    categories,
    matchDate: getStringField(formData, 'matchDate'),
    imagesUrl: getStringField(formData, 'imagesUrl'),
    tournament: getStringField(formData, 'tournament'),
  };

  const validationResult = matchApiSchema.safeParse(matchData);

  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  // Extract files from form data
  const images = getFiles(formData, 'images');
  const files = getFiles(formData, 'files');

  // Update the match
  const updateResult = await service.update(id, {
    ...validationResult.data,
    tournament: validationResult.data.tournament || undefined,
  }, { images, files });

  if (!updateResult.success) {
    return ApiErrors.serverError(updateResult.error.message);
  }

  return apiSuccess(
    { match: updateResult.data.match },
    { warnings: updateResult.data.uploadWarnings }
  );
});

export const DELETE = withAuth(async (
  request: NextRequest,
  { userId, jwt }
) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  addApiBreadcrumb('Deleting match', { id, userId });

  const service = MatchService.forUser(jwt);

  const deleteResult = await service.delete(id);

  if (!deleteResult.success) {
    return ApiErrors.serverError(deleteResult.error.message);
  }

  return apiSuccess({ deleted: true });
});
