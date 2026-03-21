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

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...restOptions,
    headers,
    ...(signal ? { signal } : {}),
  });

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

export const api = {
  get: (endpoint: string) => apiFetch(endpoint, { method: "GET" }),
  post: (endpoint: string, body: any) =>
    apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patch: (endpoint: string, body: any) =>
    apiFetch(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (endpoint: string) => apiFetch(endpoint, { method: "DELETE" }),
};
