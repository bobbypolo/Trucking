import { API_URL } from "./config";

import { getIdTokenAsync } from "./authService";

/** Thrown when the server responds with 403 Forbidden. */
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
    // Maintain proper prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getIdTokenAsync();

  const { signal, headers: customHeaders, ...restOptions } = options;

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(customHeaders || {}),
  };

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...restOptions,
      headers,
      ...(signal ? { signal } : {}),
    });
  } catch (err: unknown) {
    // Silently swallow AbortError so callers never see it as an exception.
    // This prevents stale-request errors from surfacing in error toasts.
    if (err instanceof DOMException && err.name === "AbortError") {
      return undefined;
    }
    throw err;
  }

  if (!response.ok) {
    if (response.status === 401) {
      // Session truly expired — Firebase token auto-refresh should have prevented this.
      // Emit a global event so the App can show the SessionExpiredModal.
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
      throw new Error("Unauthorized: session expired");
    }

    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      throw new ForbiddenError(errorData.error || "Forbidden");
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `API Request failed: ${response.status}`,
    );
  }

  return response.json();
};

/** Optional fetch overrides that callers can pass to convenience methods. */
export interface ApiFetchOptions {
  signal?: AbortSignal;
}

export const api = {
  get: (endpoint: string, opts?: ApiFetchOptions) =>
    apiFetch(endpoint, { method: "GET", ...opts }),
  post: (endpoint: string, body: any, opts?: ApiFetchOptions) =>
    apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      ...opts,
    }),
  patch: (endpoint: string, body: any, opts?: ApiFetchOptions) =>
    apiFetch(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...opts,
    }),
  delete: (endpoint: string, opts?: ApiFetchOptions) =>
    apiFetch(endpoint, { method: "DELETE", ...opts }),
};
