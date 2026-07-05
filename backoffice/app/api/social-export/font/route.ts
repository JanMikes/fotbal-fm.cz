import { NextRequest } from 'next/server';
import { withAuth, ApiErrors, apiBinary, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportService } from '@/lib/services/social-export.service';

/**
 * Same-origin font proxy (`GET /api/social-export/font?family=…`), used by
 * the rich-text WYSIWYG and by `useWboostFonts` (client-side measurement).
 *
 * Fonts are a CORS-restricted resource type: unlike `<img>`, an `@font-face`
 * source on another origin is refused by the browser unless the host sends
 * CORS headers — which the object store does not. The service resolves the
 * face's raw store URL from the project fonts endpoint (mirroring the
 * thumbnail proxy pattern) and streams the bytes same-origin.
 *
 * A legacy `variantId` query param is accepted and ignored (older client
 * bundles may still send it).
 */
export const GET = withAuth(async (request: NextRequest) => {
  addApiBreadcrumb('Fetching social-export font');

  const { searchParams } = new URL(request.url);
  const family = searchParams.get('family');

  if (!family || !family.trim()) {
    return ApiErrors.badRequest('Parametr family je povinný');
  }

  const service = getSocialExportService();
  const result = await service.getFont(family);

  if (!result.success) {
    const { error } = result;
    if (error.statusCode === 404) {
      return ApiErrors.notFound(error.message);
    }
    return ApiErrors.serverError(error.message);
  }

  const { body, contentType } = result.data;

  return apiBinary(body, {
    contentType: contentType || 'font/ttf',
    // Font files are immutable per uploaded face — cache aggressively.
    headers: { 'Cache-Control': 'private, max-age=86400' },
  });
});
