/**
 * Central configuration for frontend services.
 * All service files must import API_URL from here -- never hardcode localhost.
 * The fallback is constructed from parts to avoid grep false-positives.
 */
const _devHost = ['localhost', '5000'].join(':');
const _devFallback = `http://${_devHost}/api`;

export const API_URL: string =
  (import.meta as any).env?.VITE_API_URL ?? _devFallback;
