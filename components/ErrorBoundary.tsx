import React, { ReactNode } from "react";
import { captureException } from "../services/sentry";
export { useApiError } from "../hooks/useApiError";

/* ---------- shared types ---------- */

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/* ---------- PageErrorBoundary ---------- */

/**
 * Wraps an entire route / page.  On error it renders a full-screen branded
 * error page with a Reload button.  In DEV mode the error stack is shown.
 */
export class PageErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    captureException(error, {
      componentStack: errorInfo.componentStack,
      boundary: "PageErrorBoundary",
    });
    // Intentional: error logging for production diagnostics
    // eslint-disable-next-line no-console
    console.error(
      "[PageErrorBoundary] Uncaught render error:",
      error,
      errorInfo,
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div
          className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-8"
          data-testid="page-error-boundary"
        >
          <div className="max-w-lg w-full bg-slate-800 rounded-lg p-6 shadow-lg">
            <h1 className="text-2xl font-bold text-red-400 mb-2">
              Something went wrong
            </h1>
            <p className="text-slate-300 mb-4">
              An unexpected error occurred. Please reload the page.
            </p>
            {isDev && this.state.error && (
              <pre className="text-xs text-red-300 bg-slate-900 rounded p-3 overflow-auto mb-4">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ---------- ComponentErrorBoundary ---------- */

/**
 * Wraps an individual widget / card.  On error it renders a small inline
 * error card so the rest of the page keeps working.
 */
export class ComponentErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    captureException(error, {
      componentStack: errorInfo.componentStack,
      boundary: "ComponentErrorBoundary",
    });
    // Intentional: error logging for production diagnostics
    // eslint-disable-next-line no-console
    console.error(
      "[ComponentErrorBoundary] Widget render error:",
      error,
      errorInfo,
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="border border-red-400 bg-red-50 rounded-lg p-4 text-sm text-red-700"
          data-testid="component-error-boundary"
          role="alert"
        >
          <p className="font-semibold">Widget error</p>
          <p className="mt-1">
            This component encountered an error and could not render.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ---------- legacy default export ---------- */

/**
 * The original ErrorBoundary class — kept as default export for
 * backwards compatibility with existing `<ErrorBoundary>` usage in App.tsx.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    captureException(error, {
      componentStack: errorInfo.componentStack,
      boundary: "ErrorBoundary",
    });
    // Intentional: error logging for production diagnostics
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Uncaught render error:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-8">
          <div className="max-w-lg w-full bg-slate-800 rounded-lg p-6 shadow-lg">
            <h1 className="text-2xl font-bold text-red-400 mb-2">
              Something went wrong
            </h1>
            <p className="text-slate-300 mb-4">
              An unexpected error occurred. Please reload the page.
            </p>
            {isDev && this.state.error && (
              <pre className="text-xs text-red-300 bg-slate-900 rounded p-3 overflow-auto mb-4">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
