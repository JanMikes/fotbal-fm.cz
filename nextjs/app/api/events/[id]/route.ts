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
import { EventService } from '@/lib/services';
import { eventApiSchema, normalizeTimeForStrapi } from '@/lib/validation';

export const GET = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  // Extract ID from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  addApiBreadcrumb('Getting event', { id });

  const service = EventService.forUser(jwt);
  const result = await service.getById(id);

  if (!result.success) {
    if (result.error.code === 'NOT_FOUND') {
      return ApiErrors.notFound(result.error.message);
    }
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ event: result.data });
});

export const PUT = withAuthFormData(async (
  request: NextRequest,
  { userId, jwt, formData }
) => {
  // Extract ID from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  addApiBreadcrumb('Updating event', { id, userId });

  setFormContext('EventForm', {
    mode: 'edit',
    entityId: id,
    fields: [...formData.keys()],
    hasFiles: formData.has('photos') || formData.has('files'),
  });

  const service = EventService.forUser(jwt);

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

  // Extract form fields
  const eventData = {
    name: getStringField(formData, 'name'),
    eventType: getStringField(formData, 'eventType'),
    dateFrom: getStringField(formData, 'dateFrom'),
    dateTo: getStringField(formData, 'dateTo'),
    publishDate: getStringField(formData, 'publishDate'),
    eventTime: normalizeTimeForStrapi(getStringField(formData, 'eventTime')),
    eventTimeTo: normalizeTimeForStrapi(getStringField(formData, 'eventTimeTo')),
    description: getStringField(formData, 'description'),
    requiresPhotographer: getStringField(formData, 'requiresPhotographer'),
  };

  const validationResult = eventApiSchema.safeParse(eventData);

  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  // Extract files from form data
  const photos = getFiles(formData, 'photos');
  const files = getFiles(formData, 'files');

  // Update the event
  const updateResult = await service.update(id, validationResult.data, { photos, files });

  if (!updateResult.success) {
    return ApiErrors.serverError(updateResult.error.message);
  }

  return apiSuccess(
    { event: updateResult.data.event },
    { warnings: updateResult.data.uploadWarnings }
  );
});
