import { NextRequest } from 'next/server';
import {
  withErrorHandling,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { getAuthService } from '@/lib/services';
import { forgotPasswordSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json();

  addApiBreadcrumb('Forgot password request', { email: body.email });

  const validationResult = forgotPasswordSchema.safeParse(body);
  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  const { email } = validationResult.data;

  const authService = getAuthService();
  const result = await authService.forgotPassword(email);

  // Always return success to prevent email enumeration
  if (!result.success) {
    console.error('[ForgotPassword] Strapi error:', result.error.message);
  }

  return apiSuccess({ ok: true });
});
