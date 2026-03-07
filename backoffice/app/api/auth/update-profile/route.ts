import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { getAuthService } from '@/lib/services';
import { updateProfileSchema } from '@/lib/validation';

export const PUT = withAuth(async (
  request: NextRequest,
  { userId, jwt }
) => {
  // Parse body - already after session check in withAuth
  const body = await request.json();

  addApiBreadcrumb('Updating profile', { userId });

  // Validate request data
  const validationResult = updateProfileSchema.safeParse(body);
  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  const { firstName, lastName, jobTitle } = validationResult.data;

  // Update profile
  const authService = getAuthService();
  const result = await authService.updateProfile(jwt, userId!, {
    firstName,
    lastName,
    jobTitle,
  });

  if (!result.success) {
    if (result.error.statusCode === 401) {
      return ApiErrors.unauthorized(result.error.message);
    }
    if (result.error.statusCode === 403) {
      return ApiErrors.forbidden(result.error.message);
    }
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ user: result.data });
});
