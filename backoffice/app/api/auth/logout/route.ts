import {
  withErrorHandling,
  apiSuccess,
  addApiBreadcrumb,
} from '@/lib/api';
import { destroySession } from '@/lib/session';

export const POST = withErrorHandling(async () => {
  addApiBreadcrumb('User logout');

  await destroySession();

  return apiSuccess(null);
});
