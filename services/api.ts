import { API_URL } from "./config";

import { getIdTokenAsync, forceRefreshToken } from "./authService";

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

  const headers: Record<string, string> = {};
  if (!(restOptions.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  Object.assign(headers, customHeaders || {});

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
      // First 401: force-refresh token and retry once before giving up.
      const freshToken = await forceRefreshToken();

      const retryHeaders: Record<string, string> = {};
      if (!(restOptions.body instanceof FormData)) {
        retryHeaders["Content-Type"] = "application/json";
      }
      if (freshToken) {
        retryHeaders["Authorization"] = `Bearer ${freshToken}`;
      }
      Object.assign(retryHeaders, customHeaders || {});

      let retryResponse: Response;
      try {
        retryResponse = await fetch(`${API_URL}${endpoint}`, {
          ...restOptions,
          headers: retryHeaders,
          ...(signal ? { signal } : {}),
        });
      } catch (retryErr: unknown) {
        if (
          retryErr instanceof DOMException &&
          retryErr.name === "AbortError"
        ) {
          return undefined;
        }
        throw retryErr;
      }

      if (retryResponse.ok) {
        return retryResponse.json();
      }

      if (retryResponse.status === 401) {
        // Retry also failed with 401 — session is truly expired.
        window.dispatchEvent(new CustomEvent("auth:session-expired"));
        throw new Error("Unauthorized: session expired");
      }

      // Retry returned a different error — fall through to normal error handling
      const retryErrorData = await retryResponse.json().catch(() => ({}));
      if (retryResponse.status === 403) {
        throw new ForbiddenError(retryErrorData.error || "Forbidden");
      }
      throw new Error(
        retryErrorData.error || `API Request failed: ${retryResponse.status}`,
      );
    }

    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      const forbiddenMsg = errorData.details
        ? `${errorData.error || "Forbidden"}: ${errorData.details}`
        : errorData.error || "Forbidden";
      throw new ForbiddenError(forbiddenMsg);
    }

    const errorData = await response.json().catch(() => ({}));
    const msg = errorData.details
      ? `${errorData.error || "Request failed"}: ${errorData.details}`
      : errorData.error || `API Request failed: ${response.status}`;
    throw new Error(msg);
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
  postFormData: async (
    endpoint: string,
    formData: FormData,
    opts?: ApiFetchOptions,
  ) => apiFetch(endpoint, { method: "POST", body: formData, ...opts }),
};
