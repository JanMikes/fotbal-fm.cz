import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Safely extract headers from request object
 * Next.js may pass non-standard request objects in some error contexts
 */
function safeGetHeaders(request: unknown): Record<string, string> {
  try {
    if (!request || typeof request !== 'object') {
      return {};
    }

    const req = request as Record<string, unknown>;

    // Standard Request object with Headers
    if (req.headers && typeof (req.headers as Headers).entries === 'function') {
      return Object.fromEntries((req.headers as Headers).entries());
    }

    // Plain object headers
    if (req.headers && typeof req.headers === 'object') {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers as Record<string, unknown>)) {
        if (typeof value === 'string') {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value.join(', ');
        }
      }
      return headers;
    }

    return {};
  } catch {
    return {};
  }
}

/**
 * Safely get URL from request object
 */
function safeGetUrl(request: unknown): string | undefined {
  try {
    if (!request || typeof request !== 'object') {
      return undefined;
    }

    const req = request as Record<string, unknown>;

    if (typeof req.url === 'string') {
      return req.url;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Safely get method from request object
 */
function safeGetMethod(request: unknown): string {
  try {
    if (!request || typeof request !== 'object') {
      return 'UNKNOWN';
    }

    const req = request as Record<string, unknown>;

    if (typeof req.method === 'string') {
      return req.method;
    }

    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

/**
 * Safely get pathname from URL string
 */
function safeGetPathname(url: string | undefined): string {
  if (!url) {
    return '/unknown';
  }

  try {
    return new URL(url).pathname;
  } catch {
    // URL might be relative or malformed
    return url.split('?')[0] || '/unknown';
  }
}

// Custom error handler that logs detailed info to stdout
export const onRequestError = (
  error: unknown,
  request: unknown,
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string }
) => {
  const url = safeGetUrl(request);
  const method = safeGetMethod(request);
  const headers = safeGetHeaders(request);

  // Log detailed error info to stdout (visible in Docker logs)
  console.error('=== REQUEST ERROR ===');
  console.error('Error:', error);
  console.error('Error message:', error instanceof Error ? error.message : String(error));
  console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
  console.error('Request URL:', url ?? 'unknown');
  console.error('Request method:', method);
  console.error('Request headers:', JSON.stringify(headers, null, 2));
  console.error('Context:', JSON.stringify(context, null, 2));
  console.error('=== END REQUEST ERROR ===');

  try {
    // Convert Request to the format Sentry expects
    const requestInfo = {
      path: safeGetPathname(url),
      method,
      headers,
    };

    // Also send to Sentry
    Sentry.captureRequestError(error, requestInfo, context);
  } catch (sentryError) {
    // Don't let Sentry errors prevent logging
    console.error('Error sending to Sentry:', sentryError);

    // Fallback: capture as regular exception
    Sentry.captureException(error, {
      tags: {
        source: 'onRequestError',
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
      },
      extra: {
        url,
        method,
        context,
      },
    });
  }
};
