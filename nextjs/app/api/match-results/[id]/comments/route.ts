import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { CommentService } from '@/lib/services';

export const GET = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  // Extract ID from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  // Path is /api/match-results/[id]/comments, so id is at index -2
  const id = pathParts[pathParts.length - 2];

  addApiBreadcrumb('Getting match result comments', { id });

  const service = CommentService.forUser(jwt);
  const result = await service.getByEntity('matchResult', id);

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ comments: result.data });
});
