import { auth } from "../config/firebase";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

interface ApiError extends Error {
  status?: number;
}

function createApiError(message: string, status?: number): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  return error;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    await clearAuth();
    throw createApiError("Session expired. Please log in again.", 401);
  }

  if (!response.ok) {
    const body = await response.text();
    let message = `Request failed with status ${response.status}`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.message) {
        message = parsed.message;
      }
    } catch (_parseError: unknown) {
      // body is not JSON, use default message
    }
    throw createApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

async function clearAuth(): Promise<void> {
  try {
    await auth.signOut();
  } catch (_signOutError: unknown) {
    // signOut failure during 401 handling is non-critical
  }
}

async function request<T>(
  method: string,
  urlPath: string,
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}${urlPath}`;
  const headers = await getAuthHeaders();

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err: unknown) {
    if (err instanceof TypeError) {
      throw createApiError(
        "Network error: please check your internet connection and try again.",
      );
    }
    throw err;
  }

  return handleResponse<T>(response);
}

// # Tests R-P5-02, R-P5-08
async function uploadFile<T>(urlPath: string, formData: FormData): Promise<T> {
  const url = `${BASE_URL}${urlPath}`;
  const headers: Record<string, string> = {};

  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Explicitly delete Content-Type so the runtime sets the multipart boundary automatically
  delete headers["Content-Type"];

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch (err: unknown) {
    if (err instanceof TypeError) {
      throw createApiError(
        "Network error: please check your internet connection and try again.",
      );
    }
    throw err;
  }

  return handleResponse<T>(response);
}

const api = {
  get<T>(urlPath: string): Promise<T> {
    return request<T>("GET", urlPath);
  },

  post<T>(urlPath: string, body?: unknown): Promise<T> {
    return request<T>("POST", urlPath, body);
  },

  put<T>(urlPath: string, body?: unknown): Promise<T> {
    return request<T>("PUT", urlPath, body);
  },

  patch<T>(urlPath: string, body?: unknown): Promise<T> {
    return request<T>("PATCH", urlPath, body);
  },

  delete<T>(urlPath: string): Promise<T> {
    return request<T>("DELETE", urlPath);
  },

  uploadFile<T>(urlPath: string, formData: FormData): Promise<T> {
    return uploadFile<T>(urlPath, formData);
  },
};

export default api;
