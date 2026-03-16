/**
 * utils/logger.ts
 *
 * Thin logging wrapper. In development (import.meta.env.DEV === true) calls
 * pass through to the native console methods. In production all calls are
 * no-ops, keeping the browser console clean without scattering
 * `if (DEV)` guards throughout the codebase.
 *
 * Usage:
 *   import { log } from "@/utils/logger";
 *   log.info("Loaded user", user);
 *   log.warn("Missing field", field);
 *   log.error("Request failed", err);
 */

const isDev: boolean =
  typeof import.meta !== "undefined" &&
  typeof (import.meta as { env?: { DEV?: boolean } }).env !== "undefined"
    ? ((import.meta as { env: { DEV?: boolean } }).env.DEV ?? false)
    : false;

/* eslint-disable no-console */
export const log = {
  info: isDev ? console.log.bind(console) : () => undefined,
  warn: isDev ? console.warn.bind(console) : () => undefined,
  error: isDev ? console.error.bind(console) : () => undefined,
  debug: isDev ? console.debug.bind(console) : () => undefined,
} as const;
/* eslint-enable no-console */
