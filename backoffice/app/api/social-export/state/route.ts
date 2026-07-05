import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { withAuth, apiSuccess, ApiErrors, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportStateService } from '@/lib/services/social-export-state.service';

const inputFieldStateSchema = z.object({
  value: z.string().max(10000),
  hidden: z.boolean(),
});

const imageSlotStateSchema = z.object({
  image: z.object({ id: z.string(), url: z.string() }).nullable(),
  scale: z.number(),
  offsetX: z.number(),
  offsetY: z.number(),
  rotation: z.number(),
  hidden: z.boolean(),
});

const saveStateRequestSchema = z.object({
  matchId: z.string().min(1),
  templateId: z.string().min(1),
  variantId: z.string().min(1),
  state: z.object({
    formState: z.record(z.string(), inputFieldStateSchema),
    imageState: z.record(z.string(), imageSlotStateSchema),
  }),
});

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
