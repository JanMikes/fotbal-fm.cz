import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { CommentService } from '@/lib/services';
import { commentApiSchema } from '@/lib/validation';

export const POST = withAuth(async (
  request: NextRequest,
  { userId, jwt }
) => {
  const body = await request.json();

  addApiBreadcrumb('Creating comment', { userId });

  // Validate request
  const validationResult = commentApiSchema.safeParse(body);

  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  // Create the comment
  const service = CommentService.forUser(jwt);
  const result = await service.create(jwt, userId!, validationResult.data);

  if (!result.success) {
    if (result.error.statusCode === 400) {
      return ApiErrors.badRequest(result.error.message);
    }
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ comment: result.data });
});
