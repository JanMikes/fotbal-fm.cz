import { withAuth, apiSuccess, ApiErrors, apiError, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportService } from '@/lib/services/social-export.service';

/**
 * `GET /api/social-export/fonts` — the project's font faces (exact Fabric
 * family strings + same-origin proxied file URLs). Loaded once per session by
 * `useWboostFonts` so client-side text measurement (live placeholder boxes,
 * container reflow, overflow pre-check) wraps with the real glyph metrics.
 */
export const GET = withAuth(async () => {
  addApiBreadcrumb('Fetching social-export project fonts');

  const service = getSocialExportService();
  const result = await service.getProjectFonts();

  if (!result.success) {
    const { error } = result;
    if (error.statusCode === 404) {
      // Older WBoost deploy without the fonts endpoint — the client hook
      // treats this as "no fonts to load" and keeps the fallback measurement.
      return apiError(error.message, { status: 404, code: error.code });
    }
    return ApiErrors.serverError(error.message);
  }

  return apiSuccess({ fonts: result.data });
});
