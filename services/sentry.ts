/**
 * Sentry APM integration for the React frontend.
 *
 * Gracefully degrades to no-op when VITE_SENTRY_DSN is not set,
 * so the app works identically in dev/CI environments without Sentry.
 */

import * as Sentry from "@sentry/react";

let initialized = false;

function isDsnConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SENTRY_DSN);
}

/**
 * Initialize Sentry if a DSN is configured.
 * Safe to call multiple times — only the first call has effect.
 */
export function initSentry(): void {
  if (initialized) return;
  initialized = true;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: true,
  });
}

/**
 * Report an error to Sentry.
 * No-op when Sentry DSN is not configured.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!isDsnConfigured()) return;

  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Report a breadcrumb message to Sentry.
 * No-op when Sentry DSN is not configured.
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
): void {
  if (!isDsnConfigured()) return;

  Sentry.captureMessage(message, level);
}
