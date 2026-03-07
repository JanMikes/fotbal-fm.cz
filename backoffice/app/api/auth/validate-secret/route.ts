import { NextRequest } from 'next/server';
import {
  withErrorHandling,
  apiSuccess,
  addApiBreadcrumb,
} from '@/lib/api';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const { secret } = body;

  addApiBreadcrumb('Validating registration secret');

  const registrationSecret = process.env.REGISTRATION_SECRET;

  if (!registrationSecret) {
    return apiSuccess({ valid: false });
  }

  const isValid = secret === registrationSecret;

  return apiSuccess({ valid: isValid });
});
