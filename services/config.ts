/**
 * Central configuration for frontend services.
 * All service files must import API_URL from here -- never hardcode localhost.
 *
 * With the Vite dev proxy configured, the default is a relative "/api" path.
 * This ensures the frontend works through tunnels and reverse proxies without
 * CORS/PNA issues. If a non-local page is loaded with a localhost API override,
 * ignore that override and fall back to same-origin "/api".
 */
const rawApiUrl: string | undefined = (import.meta as any).env?.VITE_API_URL;

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function resolveApiUrl(): string {
  if (!rawApiUrl) {
    return "/api";
  }

  if (typeof window === "undefined") {
    return rawApiUrl;
  }

  try {
    const pageHost = window.location.hostname;
    const resolved = new URL(rawApiUrl, window.location.origin);

    if (!isLocalHost(pageHost) && isLocalHost(resolved.hostname)) {
      console.warn(
        `[config] Ignoring localhost VITE_API_URL (${rawApiUrl}) from non-local origin ${window.location.origin}; using /api instead.`,
      );
      return "/api";
    }
  } catch (_error: unknown) {
    // Preserve explicit overrides if URL parsing fails for any reason.
  }

  return rawApiUrl;
}

export const API_URL: string = resolveApiUrl();
