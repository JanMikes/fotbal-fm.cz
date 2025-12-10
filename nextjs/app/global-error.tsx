"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// This error boundary catches errors in the root layout
// It's required because error.tsx doesn't catch root layout errors
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error details
    console.error('[Global Error Boundary] Caught error:', {
      message: error.message,
      name: error.name,
      digest: error.digest,
      stack: error.stack,
    });

    // Log the error to Sentry with extra context
    Sentry.withScope((scope) => {
      scope.setTag('error_boundary', 'global_error');
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
    <html lang="cs">
      <body>
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
              Něco se pokazilo!
            </h2>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
              Omlouváme se, došlo k neočekávané chybě.
            </p>
            {error.digest && (
              <p style={{ marginBottom: '1rem', fontSize: '0.75rem', color: '#999', fontFamily: 'monospace' }}>
                Kód chyby: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              Zkusit znovu
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
