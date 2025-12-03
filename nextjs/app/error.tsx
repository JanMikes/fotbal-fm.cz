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
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold text-text-primary">Něco se pokazilo!</h2>
        <p className="mb-6 text-text-secondary">
          Omlouváme se, došlo k neočekávané chybě.
        </p>
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
