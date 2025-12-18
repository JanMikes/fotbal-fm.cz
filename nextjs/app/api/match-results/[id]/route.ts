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
import { MatchResultService } from '@/lib/services';
import { matchResultApiSchema } from '@/lib/validation';

export const GET = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  // Extract ID from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  addApiBreadcrumb('Getting match result', { id });

  const service = MatchResultService.forUser(jwt);
  const result = await service.getById(id);

  if (!result.success) {
    if (result.error.code === 'NOT_FOUND') {
      return ApiErrors.notFound(result.error.message);
    }
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ matchResult: result.data });
});

export const PUT = withAuthFormData(async (
  request: NextRequest,
  { userId, jwt, formData }
) => {
  // Extract ID from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  addApiBreadcrumb('Updating match result', { id, userId });

  setFormContext('MatchResultForm', {
    mode: 'edit',
    entityId: id,
    fields: [...formData.keys()],
    hasFiles: formData.has('images') || formData.has('files'),
  });

  const service = MatchResultService.forUser(jwt);

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
  };

  const validationResult = matchResultApiSchema.safeParse(matchData);

  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  // Extract files from form data
  const images = getFiles(formData, 'images');
  const files = getFiles(formData, 'files');

  // Update the match result
  const updateResult = await service.update(id, validationResult.data, { images, files });

  if (!updateResult.success) {
    return ApiErrors.serverError(updateResult.error.message);
  }

  return apiSuccess(
    { matchResult: updateResult.data.matchResult },
    { warnings: updateResult.data.uploadWarnings }
  );
});
