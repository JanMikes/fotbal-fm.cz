// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Only initialize Sentry if DSN is provided (skip for local development)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    tracesSampleRate: 0.0,

    // Capture 100% of error events
    sampleRate: 1.0,

    // Attach stack traces to all messages (not just errors)
    attachStacktrace: true,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Enable sending user PII (Personally Identifiable Information)
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: true,

    // Maximum breadcrumbs to capture
    maxBreadcrumbs: 50,

    // Log captured events locally for debugging (visible in Docker logs)
    beforeSend(event) {
      console.log('[Sentry] Capturing:', event.exception?.values?.[0]?.type,
                  event.exception?.values?.[0]?.value);
      return event;
    },

    // Add global context to all events
    initialScope: {
      tags: { runtime: 'server' },
    },
  });
}
