import { NextRequest } from 'next/server';
import {
  withAuth,
  withAuthFormData,
  apiSuccess,
  ApiErrors,
  apiError,
  addApiBreadcrumb,
  getStringField,
  getFiles,
} from '@/lib/api';
import { ErrorCode } from '@/lib/core/errors';
import { getSocialExportService } from '@/lib/services/social-export.service';

/**
 * GET /api/social-export/placeholder-images?variantId=&imageInputId=
 * Lists the gallery images an image slot can be filled with (its allowed folders).
 */
export const GET = withAuth(async (request: NextRequest) => {
  addApiBreadcrumb('Listing social-export placeholder images');

  const { searchParams } = new URL(request.url);
  const variantId = searchParams.get('variantId')?.trim();
  const imageInputId = searchParams.get('imageInputId')?.trim();

  if (!variantId) return ApiErrors.badRequest('Parametr variantId je povinný');
  if (!imageInputId) return ApiErrors.badRequest('Parametr imageInputId je povinný');

  const service = getSocialExportService();
  const result = await service.listPlaceholderImages(variantId, imageInputId);

  if (!result.success) {
    const { error } = result;
    switch (error.statusCode) {
      case 403:
        return ApiErrors.forbidden('Tato varianta není dostupná');
      case 404:
        return ApiErrors.notFound('Obrázkový slot nebyl nalezen');
      case 503:
        return apiError(error.message, { status: 503, code: error.code });
      default:
        return ApiErrors.serverError(error.message);
    }
  }

  return apiSuccess({ images: result.data });
});

/**
 * POST /api/social-export/placeholder-images  (multipart/form-data)
 * Fields: variantId, imageInputId, file, directoryId? — uploads a new image into
 * one of the slot's allowed folders and returns the created gallery image.
 */
export const POST = withAuthFormData(async (_request: NextRequest, { formData }) => {
  addApiBreadcrumb('Uploading social-export placeholder image');

  const variantId = getStringField(formData, 'variantId');
  const imageInputId = getStringField(formData, 'imageInputId');
  const directoryId = getStringField(formData, 'directoryId');
  const file = getFiles(formData, 'file')[0];

  if (!variantId) return ApiErrors.badRequest('Pole variantId je povinné');
  if (!imageInputId) return ApiErrors.badRequest('Pole imageInputId je povinné');
  if (!file) return ApiErrors.badRequest('Soubor je povinný');

  const service = getSocialExportService();
  const result = await service.uploadPlaceholderImage(
    variantId,
    imageInputId,
    file,
    file.name || 'upload',
    directoryId
  );

  if (!result.success) {
    const { error } = result;
    switch (error.statusCode) {
      case 400:
        return ApiErrors.badRequest('Soubor se nepodařilo nahrát (neplatný obrázek)');
      case 403:
        return apiError('Cílová složka není pro tento slot povolena', {
          status: 403,
          code: ErrorCode.FORBIDDEN,
        });
      case 404:
        return ApiErrors.notFound('Obrázkový slot nebyl nalezen');
      case 503:
        return apiError(error.message, { status: 503, code: error.code });
      default:
        return ApiErrors.serverError(error.message);
    }
  }

  return apiSuccess({ image: result.data });
});
