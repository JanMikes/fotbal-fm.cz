import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Custom error handler that logs detailed info to stdout
export const onRequestError = (
  error: unknown,
  request: Request,
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string }
) => {
  // Log detailed error info to stdout (visible in Docker logs)
  console.error('=== REQUEST ERROR ===');
  console.error('Error:', error);
  console.error('Error message:', error instanceof Error ? error.message : String(error));
  console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
  console.error('Request URL:', request.url);
  console.error('Request method:', request.method);
  console.error('Request headers:', JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));
  console.error('Context:', JSON.stringify(context, null, 2));
  console.error('=== END REQUEST ERROR ===');

  // Convert Request to the format Sentry expects
  const requestInfo = {
    path: new URL(request.url).pathname,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  };

  // Also send to Sentry
  Sentry.captureRequestError(error, requestInfo, context);
};
