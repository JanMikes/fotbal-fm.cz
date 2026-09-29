import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, ApiErrors, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportStateService } from '@/lib/services/social-export-state.service';
import { saveStateRequestSchema } from '@/lib/social-export/schemas';

export const GET = withAuth(async (request: NextRequest) => {
  const matchId = new URL(request.url).searchParams.get('matchId');
  if (!matchId) {
    return ApiErrors.badRequest('Chybí parametr matchId');
  }

  addApiBreadcrumb('Fetching social-export saved states', { matchId });

  const result = await getSocialExportStateService().getForMatch(matchId);
  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ states: result.data });
});

export const PUT = withAuth(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiErrors.badRequest('Neplatné tělo požadavku (očekáván JSON)');
  }

  const parsed = saveStateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.validationFailed(parsed.error.issues[0]?.message ?? 'Neplatná data požadavku');
  }

  const { matchId, templateId, variantId, state } = parsed.data;
  addApiBreadcrumb('Saving social-export state', { matchId, variantId });

  const result = await getSocialExportStateService().save(matchId, templateId, variantId, state);
  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ state: result.data });
});
