import { NextRequest } from 'next/server';
import {
  withAuthFormData,
  apiSuccess,
  apiErrorFromAppError,
  ApiErrors,
  getStringField,
  getFiles,
  addApiBreadcrumb,
  setFormContext,
} from '@/lib/api';
import { MatchService } from '@/lib/services';
import { matchApiSchema } from '@/lib/validation';

export const POST = withAuthFormData(async (request, { userId, jwt, formData }) => {
  addApiBreadcrumb('Creating match', {
    userId,
    formFields: [...formData.keys()],
  });

  setFormContext('MatchForm', {
    mode: 'create',
    fields: [...formData.keys()],
    hasFiles: formData.has('images') || formData.has('files'),
  });

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
    lineup: getStringField(formData, 'lineup'),
    categories,
    matchDate: getStringField(formData, 'matchDate'),
    imagesUrl: getStringField(formData, 'imagesUrl'),
    tournament: getStringField(formData, 'tournament'),
  };

  // Validate the data
  const validationResult = matchApiSchema.safeParse(matchData);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return ApiErrors.validationFailed(firstError.message);
  }

  // Extract files from form data
  const images = getFiles(formData, 'images');
  const files = getFiles(formData, 'files');

  // Use the service to create match
  const service = MatchService.forUser(jwt);
  const result = await service.create(
    {
      ...validationResult.data,
      imagesUrl: validationResult.data.imagesUrl || undefined,
      tournament: validationResult.data.tournament || undefined,
      author: userId,
    },
    { images, files }
  );

  if (!result.success) {
    return apiErrorFromAppError(result.error);
  }

  return apiSuccess(
    { match: result.data.match },
    { warnings: result.data.uploadWarnings }
  );
});
