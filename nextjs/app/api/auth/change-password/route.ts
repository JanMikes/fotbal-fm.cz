import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { getAuthService } from '@/lib/services';
import { changePasswordSchema } from '@/lib/validation';

export const POST = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  // Parse body - already after session check in withAuth
  // For JSON requests, the body is not locked like with FormData
  const body = await request.json();

  addApiBreadcrumb('Changing password');

  // Validate request data
  const validationResult = changePasswordSchema.safeParse(body);
  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  const { currentPassword, newPassword } = validationResult.data;

  // Change password
  const authService = getAuthService();
  const result = await authService.changePassword(jwt, currentPassword, newPassword);

  if (!result.success) {
    if (result.error.statusCode === 401) {
      return ApiErrors.unauthorized(result.error.message);
    }
    return ApiErrors.badRequest(result.error.message);
  }

  return apiSuccess(null);
});
