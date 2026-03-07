'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';
import * as Sentry from "@sentry/nextjs";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Root error boundary that catches unhandled errors in the component tree
 * Displays a user-friendly error message and allows recovery
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log detailed error info for Docker stdout visibility
    console.error('=== REACT ERROR BOUNDARY ===');
    console.error('[ErrorBoundary] Error name:', error.name);
    console.error('[ErrorBoundary] Error message:', error.message);
    console.error('[ErrorBoundary] Error stack:', error.stack);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    console.error('[ErrorBoundary] Current URL:', typeof window !== 'undefined' ? window.location.href : 'SSR');
    console.error('=== END REACT ERROR BOUNDARY ===');

    this.setState({
      error,
      errorInfo,
    });

    // Send error to Sentry with React component stack
    Sentry.withScope((scope) => {
      scope.setTag('error_boundary', 'class_component');
      scope.setContext("react", {
        componentStack: errorInfo.componentStack,
      });
      scope.setContext("error_details", {
        name: error.name,
        message: error.message,
        currentUrl: typeof window !== 'undefined' ? window.location.href : 'SSR',
      });
      Sentry.captureException(error);
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <Card className="max-w-lg w-full" variant="elevated">
            <div className="text-center">
              <div className="mb-6">
                <svg
                  className="mx-auto h-16 w-16 text-danger"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              <h1 className="text-2xl font-bold text-text-primary mb-3">
                Něco se pokazilo
              </h1>

              <p className="text-text-secondary mb-6">
                Omlouváme se, ale došlo k neočekávané chybě. Zkuste prosím akci opakovat.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mb-6 p-4 bg-danger-bg rounded border border-danger-border">
                  <summary className="cursor-pointer text-sm font-semibold text-danger-text mb-2">
                    Technické detaily (pouze pro vývoj)
                  </summary>
                  <pre className="text-xs text-danger-text overflow-auto">
                    <code>
                      {this.state.error.toString()}
                      {'\n\n'}
                      {this.state.errorInfo?.componentStack}
                    </code>
                  </pre>
                </details>
              )}

              <div className="flex gap-3 justify-center">
                <Button variant="primary" onClick={this.handleReset}>
                  Zkusit znovu
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => (window.location.href = '/')}
                >
                  Zpět na hlavní stránku
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
