import { NextRequest } from 'next/server';
import { withAuth, ApiErrors, apiBinary, addApiBreadcrumb } from '@/lib/api';
import { getWboostConfig } from '@/lib/config';
import { getSocialExportService } from '@/lib/services/social-export.service';

export const GET = withAuth(async (request: NextRequest) => {
  addApiBreadcrumb('Fetching social-export thumbnail');

  // Guard: feature must be configured and thumbnails must be enabled
  let thumbnailsEnabled: boolean;
  try {
    thumbnailsEnabled = getWboostConfig().thumbnailsEnabled;
  } catch {
    // getWboostConfig() throws 503 when unconfigured
    return ApiErrors.notFound('Export šablon není nakonfigurován');
  }

  if (!thumbnailsEnabled) {
    return ApiErrors.notFound('Náhledy šablon nejsou povoleny');
  }

  const { searchParams } = new URL(request.url);
  const variantId = searchParams.get('variantId');

  if (!variantId || !variantId.trim()) {
    return ApiErrors.badRequest('Parametr variantId je povinný');
  }

  const service = getSocialExportService();
  const result = await service.getThumbnail(variantId);

  if (!result.success) {
    const { error } = result;
    if (error.statusCode === 404) {
      return ApiErrors.notFound(error.message);
    }
    return ApiErrors.serverError(error.message);
  }

  const { body, contentType } = result.data;

  return apiBinary(body, {
    contentType: contentType || 'image/png',
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
});
