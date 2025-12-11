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
import { EventService } from '@/lib/services';
import { eventApiSchema, normalizeTimeForStrapi } from '@/lib/validation';

export const POST = withAuthFormData(async (request, { userId, jwt, formData }) => {
  addApiBreadcrumb('Creating event', {
    userId,
    formFields: [...formData.keys()],
  });

  setFormContext('EventForm', {
    mode: 'create',
    fields: [...formData.keys()],
    hasFiles: formData.has('photos') || formData.has('files'),
  });

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

  // Validate the data
  const validationResult = eventApiSchema.safeParse(eventData);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return ApiErrors.validationFailed(firstError.message);
  }

  // Extract files from form data
  const photos = getFiles(formData, 'photos');
  const files = getFiles(formData, 'files');

  // Use the service to create event
  const service = EventService.forUser(jwt);
  const result = await service.create(
    {
      ...validationResult.data,
      author: userId,
    },
    { photos, files }
  );

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess(
    { event: result.data.event },
    { warnings: result.data.uploadWarnings }
  );
});
