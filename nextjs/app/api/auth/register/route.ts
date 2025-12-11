import { NextRequest } from 'next/server';
import {
  withErrorHandling,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { getAuthService } from '@/lib/services';
import { createSession } from '@/lib/session';
import { registerSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json();

  addApiBreadcrumb('User registration attempt', { email: body.email });

  // Validate registration secret
  const registrationSecret = process.env.REGISTRATION_SECRET;
  if (!registrationSecret) {
    return ApiErrors.serverError('Registrace je momentálně nedostupná');
  }

  if (!body.secret || body.secret !== registrationSecret) {
    return ApiErrors.forbidden('Neplatný registrační kód');
  }

  // Validate request data
  const validationResult = registerSchema.safeParse(body);
  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  const { email, password, firstName, lastName, jobTitle } = validationResult.data;

  // Register with auth service
  const authService = getAuthService();
  const result = await authService.register({
    email,
    password,
    firstName,
    lastName,
    jobTitle,
  });

  if (!result.success) {
    return ApiErrors.badRequest(result.error.message);
  }

  // Automatically log in - create session
  await createSession(result.data.user.id, result.data.user.email, result.data.jwt);

  return apiSuccess({ user: result.data.user });
});
