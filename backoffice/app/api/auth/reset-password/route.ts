import { NextRequest } from 'next/server';
import {
  withErrorHandling,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { getAuthService } from '@/lib/services';
import { resetPasswordSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json();

  addApiBreadcrumb('Reset password attempt');

  const validationResult = resetPasswordSchema.safeParse(body);
  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  const { code, password, passwordConfirmation } = validationResult.data;

  const authService = getAuthService();
  const result = await authService.resetPassword(code, password, passwordConfirmation);

  if (!result.success) {
    return ApiErrors.badRequest(result.error.message);
  }

  return apiSuccess({ ok: true });
});
