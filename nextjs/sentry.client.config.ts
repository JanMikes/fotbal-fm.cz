// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Only initialize Sentry if DSN is provided (skip for local development)
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    tracesSampleRate: 0.0,

    // Session Replay - captures user interactions leading up to an error
    // This is very useful for debugging intermittent issues
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,

    // Capture 100% of error events
    sampleRate: 1.0,

    // Attach stack traces to all messages (not just errors)
    attachStacktrace: true,

    // Maximum breadcrumbs to capture (default is 100)
    maxBreadcrumbs: 50,

    integrations: [
      Sentry.replayIntegration({
        // Don't mask text - we need to see form values for debugging
        maskAllText: false,
        blockAllMedia: false,
        // Capture network requests in replay
        networkDetailAllowUrls: ['/api/'],
      }),
      // Capture console.log/warn/error as breadcrumbs
      Sentry.breadcrumbsIntegration({
        console: true,
        dom: true,      // Track clicks, inputs
        fetch: true,    // Track fetch requests
        history: true,  // Track URL changes
        xhr: true,
      }),
    ],

    // Add context before sending
    beforeSend(event, hint) {
      // Add current URL to help debug navigation issues
      if (typeof window !== 'undefined') {
        event.tags = {
          ...event.tags,
          currentUrl: window.location.href,
          currentPath: window.location.pathname,
        };
      }
      return event;
    },

    // Add global context to all events
    initialScope: {
      tags: { runtime: 'browser' },
    },
  });
}
