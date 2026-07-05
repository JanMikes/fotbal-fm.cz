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
import { NewsArticleService } from '@/lib/services';
import { newsArticleApiSchema } from '@/lib/validation';

/** Parse a JSON array field from form data, null on malformed input */
function parseJsonArray<T>(value: string | undefined): T[] | null {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export const POST = withAuthFormData(async (request, { userId, formData }) => {
  addApiBreadcrumb('Creating news article', {
    userId,
    formFields: [...formData.keys()],
  });

  setFormContext('NewsArticleForm', {
    mode: 'create',
    fields: [...formData.keys()],
    hasFiles: formData.has('gallery'),
  });

  const categories = parseJsonArray<string>(getStringField(formData, 'categoryIds'));
  if (!categories) {
    return ApiErrors.validationFailed('Neplatný formát kategorií');
  }

  const galleryIds = parseJsonArray<number>(getStringField(formData, 'galleryIds'));
  const fileIds = parseJsonArray<number>(getStringField(formData, 'fileIds'));
  if (!galleryIds || !fileIds) {
    return ApiErrors.validationFailed('Neplatný formát převzatých souborů');
  }

  const mainPhotoIdRaw = getStringField(formData, 'mainPhotoId');
  const mainPhotoId = mainPhotoIdRaw ? Number(mainPhotoIdRaw) : undefined;
  if (mainPhotoIdRaw && !Number.isInteger(mainPhotoId)) {
    return ApiErrors.validationFailed('Neplatný formát hlavní fotografie');
  }

  const articleData = {
    title: getStringField(formData, 'title'),
    description: getStringField(formData, 'description'),
    date: getStringField(formData, 'date'),
    video: getStringField(formData, 'video'),
    categories,
    mainPhotoId,
    galleryIds,
    fileIds,
  };

  const validationResult = newsArticleApiSchema.safeParse(articleData);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return ApiErrors.validationFailed(firstError.message);
  }

  const gallery = getFiles(formData, 'gallery');

  const service = NewsArticleService.default();
  const result = await service.create(
    {
      ...validationResult.data,
      author: userId,
    },
    { gallery }
  );

  if (!result.success) {
    return apiErrorFromAppError(result.error);
  }

  return apiSuccess(
    { article: result.data.article },
    { warnings: result.data.uploadWarnings }
  );
});
