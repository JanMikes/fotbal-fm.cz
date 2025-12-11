import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import {
  withErrorHandling,
  apiSuccess,
  addApiBreadcrumb,
} from '@/lib/api';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const data = await request.json();

  addApiBreadcrumb('Client debug log', {
    form: data.form,
  });

  // Log to console
  console.log('=== CLIENT DEBUG LOG ===');
  console.log('Form:', data.form);
  console.log('User Agent:', data.userAgent);
  console.log('Timestamp:', new Date().toISOString());
  console.log('Validation Errors:', JSON.stringify(data.errors, null, 2));
  console.log('Form Values:', JSON.stringify(data.formValues, null, 2));
  console.log('========================');

  // Also send to Sentry as breadcrumb for debugging
  Sentry.addBreadcrumb({
    category: 'debug',
    message: `Client validation debug: ${data.form}`,
    level: 'info',
    data: {
      form: data.form,
      errorCount: data.errors?.length || 0,
      hasFormValues: !!data.formValues,
    },
  });

  return apiSuccess(null);
});
