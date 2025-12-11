import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
  setFormContext,
} from '@/lib/api';
import { TournamentMatchService } from '@/lib/services';
import { tournamentMatchApiSchema } from '@/lib/validation';

export const POST = withAuth(async (
  request: NextRequest,
  { userId, jwt }
) => {
  const body = await request.json();

  addApiBreadcrumb('Creating tournament match', { userId });

  setFormContext('TournamentMatchForm', {
    mode: 'create',
  });

  // Validate the data
  const validationResult = tournamentMatchApiSchema.safeParse(body);

  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  // Create tournament match with author relationship
  const service = TournamentMatchService.forUser(jwt);
  const result = await service.create({
    ...validationResult.data,
    author: userId!,
  });

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ tournamentMatch: result.data });
});
