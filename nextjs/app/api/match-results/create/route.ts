import { NextRequest } from 'next/server';
import {
  withAuthFormData,
  apiSuccess,
  ApiErrors,
  getStringField,
  getFiles,
  addApiBreadcrumb,
  setFormContext,
} from '@/lib/api';
import { MatchResultService } from '@/lib/services';
import { matchResultApiSchema } from '@/lib/validation';

export const POST = withAuthFormData(async (request, { userId, jwt, formData }) => {
  addApiBreadcrumb('Creating match result', {
    userId,
    formFields: [...formData.keys()],
  });

  setFormContext('MatchResultForm', {
    mode: 'create',
    fields: [...formData.keys()],
    hasFiles: formData.has('images') || formData.has('files'),
  });

  // Extract form fields
  const matchData = {
    homeTeam: getStringField(formData, 'homeTeam'),
    awayTeam: getStringField(formData, 'awayTeam'),
    homeScore: getStringField(formData, 'homeScore'),
    awayScore: getStringField(formData, 'awayScore'),
    homeGoalscorers: getStringField(formData, 'homeGoalscorers'),
    awayGoalscorers: getStringField(formData, 'awayGoalscorers'),
    matchReport: getStringField(formData, 'matchReport'),
    category: getStringField(formData, 'category'),
    matchDate: getStringField(formData, 'matchDate'),
    imagesUrl: getStringField(formData, 'imagesUrl'),
  };

  // Validate the data
  const validationResult = matchResultApiSchema.safeParse(matchData);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return ApiErrors.validationFailed(firstError.message);
  }

  // Extract files from form data
  const images = getFiles(formData, 'images');
  const files = getFiles(formData, 'files');

  // Use the service to create match result
  const service = MatchResultService.forUser(jwt);
  const result = await service.create(
    {
      ...validationResult.data,
      imagesUrl: validationResult.data.imagesUrl || undefined,
      author: userId,
    },
    { images, files }
  );

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess(
    { matchResult: result.data.matchResult },
    { warnings: result.data.uploadWarnings }
  );
});
