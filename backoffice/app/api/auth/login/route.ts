import { NextRequest } from 'next/server';
import {
  withErrorHandling,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { getAuthService } from '@/lib/services';
import { createSession } from '@/lib/session';
import { loginSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json();

  addApiBreadcrumb('User login attempt', { email: body.email });

  // Validate request data
  const validationResult = loginSchema.safeParse(body);
  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  const { email, password } = validationResult.data;

  // Login with auth service
  const authService = getAuthService();
  const result = await authService.login({ email, password });

  if (!result.success) {
    // Auth errors should return 401
    return ApiErrors.unauthorized(result.error.message);
  }

  // Create session
  await createSession(result.data.user.id, result.data.user.email, result.data.jwt);

  return apiSuccess({ user: result.data.user });
});
