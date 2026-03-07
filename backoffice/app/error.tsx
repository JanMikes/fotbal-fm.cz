"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error details (will appear in browser console, captured by Sentry breadcrumbs)
    console.error('[Error Boundary] Caught error:', {
      message: error.message,
      name: error.name,
      digest: error.digest,
      stack: error.stack,
    });

    // Log the error to Sentry with extra context
    Sentry.withScope((scope) => {
      scope.setTag('error_boundary', 'app_error');
      scope.setContext('error_details', {
        message: error.message,
        name: error.name,
        digest: error.digest,
        currentUrl: typeof window !== 'undefined' ? window.location.href : 'unknown',
      });
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold text-text-primary">Něco se pokazilo!</h2>
        <p className="mb-6 text-text-secondary">
          Omlouváme se, došlo k neočekávané chybě.
        </p>
        {/* Show error digest for debugging */}
        {error.digest && (
          <p className="mb-4 text-xs text-text-muted font-mono">
            Kód chyby: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover transition-colors"
        >
          Zkusit znovu
        </button>
      </div>
    </div>
  );
}
