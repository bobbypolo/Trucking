/**
 * E2E Auth Fixture — STORY-001 (R-P0-01)
 *
 * Exports authenticated request factory functions for admin, dispatcher, and
 * driver roles. Each factory acquires a real Firebase ID token via the REST
 * Identity Toolkit API and returns an object containing the token and a
 * pre-configured APIRequestContext helper.
 *
 * Usage:
 *   import { makeAdminRequest, makeDispatcherRequest, makeDriverRequest } from './auth.fixture';
 *
 * Environment variables (falls back to dev defaults):
 *   FIREBASE_WEB_API_KEY       — Firebase project web API key
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 *   E2E_DISPATCHER_EMAIL / E2E_DISPATCHER_PASSWORD
 *   E2E_DRIVER_EMAIL / E2E_DRIVER_PASSWORD
 */

import type { APIRequestContext } from "@playwright/test";

export const API_BASE = process.env.E2E_API_URL || "http://localhost:5000";
const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthContext {
  /** Raw Firebase ID token (may be empty string if credentials unavailable) */
  idToken: string;
  /** Whether live credentials were successfully acquired */
  hasToken: boolean;
  /** Role label */
  role: "admin" | "dispatcher" | "driver";
  /** Make an authenticated GET request */
  get: (
    url: string,
    ctx: APIRequestContext,
  ) => Promise<import("@playwright/test").APIResponse>;
  /** Make an authenticated POST request */
  post: (
    url: string,
    data: unknown,
    ctx: APIRequestContext,
  ) => Promise<import("@playwright/test").APIResponse>;
  /** Make an authenticated PATCH request */
  patch: (
    url: string,
    data: unknown,
    ctx: APIRequestContext,
  ) => Promise<import("@playwright/test").APIResponse>;
  /** Make an authenticated DELETE request */
  delete: (
    url: string,
    ctx: APIRequestContext,
  ) => Promise<import("@playwright/test").APIResponse>;
}

// ---------------------------------------------------------------------------
// Core sign-in helper
// ---------------------------------------------------------------------------

/**
 * Sign in via Firebase REST API.  Returns the ID token string.
 * Throws if Firebase credentials are not available or sign-in fails.
 */
export async function signInFirebase(
  email: string,
  password: string,
): Promise<string> {
  if (!FIREBASE_API_KEY) {
    throw new Error(
      "FIREBASE_WEB_API_KEY not set — cannot acquire Firebase token",
    );
  }
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `Firebase signIn failed for ${email}: ${JSON.stringify(body["error"] ?? body)}`,
    );
  }
  return body["idToken"] as string;
}

// ---------------------------------------------------------------------------
// Auth context builder
// ---------------------------------------------------------------------------

function buildAuthContext(
  role: AuthContext["role"],
  idToken: string,
): AuthContext {
  const hasToken = idToken.length > 0;
  const authHeader = hasToken ? `Bearer ${idToken}` : "";

  return {
    idToken,
    hasToken,
    role,

    async get(url: string, ctx: APIRequestContext) {
      return ctx.get(url, {
        headers: hasToken ? { Authorization: authHeader } : {},
      });
    },

    async post(url: string, data: unknown, ctx: APIRequestContext) {
      return ctx.post(url, {
        data,
        headers: hasToken ? { Authorization: authHeader } : {},
      });
    },

    async patch(url: string, data: unknown, ctx: APIRequestContext) {
      return ctx.patch(url, {
        data,
        headers: hasToken ? { Authorization: authHeader } : {},
      });
    },

    async delete(url: string, ctx: APIRequestContext) {
      return ctx.delete(url, {
        headers: hasToken ? { Authorization: authHeader } : {},
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Role-specific factory functions (exported — satisfies R-P0-01)
// ---------------------------------------------------------------------------

/**
 * Acquire an authenticated request context for the admin role.
 * Falls back to an empty (unauthenticated) context if credentials are absent.
 */
export async function makeAdminRequest(): Promise<AuthContext> {
  const email = process.env.E2E_ADMIN_EMAIL || "admin@loadpilot.dev";
  const password = process.env.E2E_ADMIN_PASSWORD || "AdminPassword123!";
  try {
    const token = await signInFirebase(email, password);
    return buildAuthContext("admin", token);
  } catch {
    // Credentials unavailable — return no-token context so callers can
    // conditionally skip authenticated assertions with test.skip
    return buildAuthContext("admin", "");
  }
}

/**
 * Acquire an authenticated request context for the dispatcher role.
 * Falls back to an empty (unauthenticated) context if credentials are absent.
 */
export async function makeDispatcherRequest(): Promise<AuthContext> {
  const email = process.env.E2E_DISPATCHER_EMAIL || "dispatcher@loadpilot.dev";
  const password =
    process.env.E2E_DISPATCHER_PASSWORD || "DispatcherPassword123!";
  try {
    const token = await signInFirebase(email, password);
    return buildAuthContext("dispatcher", token);
  } catch {
    return buildAuthContext("dispatcher", "");
  }
}

/**
 * Acquire an authenticated request context for the driver role.
 * Falls back to an empty (unauthenticated) context if credentials are absent.
 */
export async function makeDriverRequest(): Promise<AuthContext> {
  const email = process.env.E2E_DRIVER_EMAIL || "driver@loadpilot.dev";
  const password = process.env.E2E_DRIVER_PASSWORD || "DriverPassword123!";
  try {
    const token = await signInFirebase(email, password);
    return buildAuthContext("driver", token);
  } catch {
    return buildAuthContext("driver", "");
  }
}

/**
 * Convenience: acquire all three role contexts in parallel.
 * Returns [admin, dispatcher, driver] contexts.
 */
export async function makeAllRoleRequests(): Promise<
  [AuthContext, AuthContext, AuthContext]
> {
  return Promise.all([
    makeAdminRequest(),
    makeDispatcherRequest(),
    makeDriverRequest(),
  ]);
}

/**
 * Token format validation helper.
 * Verifies a string looks like a Firebase JWT (3 dot-separated segments, length > 100).
 */
export function isValidFirebaseToken(token: string): boolean {
  if (!token || token.length < 100) return false;
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}
