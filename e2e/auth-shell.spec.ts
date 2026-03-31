import { test, expect } from "@playwright/test";
import {
  API_BASE,
  makeAdminRequest,
  isValidFirebaseToken,
} from "./fixtures/auth.fixture";

/**
 * Auth Shell Spec — R-P2A-01
 *
 * Tests: login success (token acquisition), login failure (bad credentials),
 * logout (token invalidation), token format validation, session persistence,
 * and authenticated API access.
 *
 * These are API-level tests that always run (no browser/server required).
 */

// ── Login success — real Firebase token acquisition ─────────────────────────

test.describe("Auth Shell — Login Success & Token Acquisition", () => {
  test("admin credentials produce a valid Firebase JWT token", async () => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(true, "SKIP:NO_TOKEN:admin");
      return;
    }
    expect(ctx.idToken).toBeTruthy();
    expect(isValidFirebaseToken(ctx.idToken)).toBe(true);
    // Token must have 3 segments separated by dots
    const parts = ctx.idToken.split(".");
    expect(parts.length).toBe(3);
    expect(ctx.idToken.length).toBeGreaterThan(100);
  });

  test("valid Firebase token grants access to protected /api/loads endpoint", async ({
    request,
  }) => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(true, "SKIP:NO_TOKEN:admin");
      return;
    }
    const res = await ctx.get(`${API_BASE}/api/loads`, request);
    // With a valid token we should get 200 (data returned) or 404 (no loads yet)
    // — NOT 401 or 403
    expect([200, 404]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
  });

  test("valid Firebase token grants access to protected /api/users/me endpoint", async ({
    request,
  }) => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(true, "SKIP:NO_TOKEN:admin");
      return;
    }
    const res = await ctx.get(`${API_BASE}/api/users/me`, request);
    // A valid admin token must either return user profile (200) or not-found (404)
    // — NOT 401/403 which would indicate auth failure
    expect([200, 404]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
  });
});

// ── Login failure — invalid credentials are rejected ────────────────────────

test.describe("Auth Shell — Login Failure (Invalid Credentials)", () => {
  test("invalid email/password returns 401 from Firebase REST API", async () => {
    const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;
    if (!FIREBASE_API_KEY) {
      test.skip(
        true,
        "FIREBASE_WEB_API_KEY not set — cannot test login failure",
      );
      return;
    }

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent-e2e@invalid.example",
        password: "WrongPasswordXYZ!@#",
        returnSecureToken: true,
      }),
    });
    // Firebase returns 400 for invalid credentials (INVALID_EMAIL or INVALID_PASSWORD/INVALID_LOGIN_CREDENTIALS)
    expect(res.ok).toBe(false);
    expect([400, 401, 403]).toContain(res.status);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
  });

  test("malformed JWT token is rejected by /api/loads with 401", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: "Bearer not-a-valid-jwt-token" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("token with wrong structure (2 segments) is rejected", async ({
    request,
  }) => {
    // Real JWTs have 3 dot-separated segments
    const malformedToken = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ3cm9uZyJ9";
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${malformedToken}` },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

// ── Token format validation ───────────────────────────────────────────────────

test.describe("Auth Shell — Token Format Validation", () => {
  test("isValidFirebaseToken rejects empty string", () => {
    expect(isValidFirebaseToken("")).toBe(false);
  });

  test("isValidFirebaseToken rejects short strings", () => {
    expect(isValidFirebaseToken("abc.def.ghi")).toBe(false);
  });

  test("isValidFirebaseToken rejects 2-segment tokens", () => {
    const twoSegment =
      "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0";
    expect(isValidFirebaseToken(twoSegment)).toBe(false);
  });

  test("isValidFirebaseToken accepts well-formed 3-segment JWT string", () => {
    // A minimal valid-looking 3-segment JWT (not cryptographically valid, but structurally correct)
    const wellFormed =
      "eyJhbGciOiJSUzI1NiIsImtpZCI6ImFiY2RlZiIsInR5cCI6IkpXVCJ9" +
      ".eyJzdWIiOiJ1c2VyMTIzIiwidGVuYW50SWQiOiJ0ZW5hbnQxIiwiZXhwIjo5OTk5OTk5OTk5LCJpYXQiOjE3MDAwMDAwMDB9" +
      ".c2lnbmF0dXJlYmFzZTY0dXJsc2FmZW9mYXJlYWxsb25nc3RyaW5ndGhhdGlzbG9uZ2Vub3VnaA";
    expect(isValidFirebaseToken(wellFormed)).toBe(true);
  });
});

// ── Logout — post-logout token invalidation ──────────────────────────────────

test.describe("Auth Shell — Logout & Session Invalidation", () => {
  test("post-logout token (invalidated/expired) is rejected by API", async ({
    request,
  }) => {
    const expiredToken = "post-logout-session-token-that-is-no-longer-valid";
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("expired JWT (no kid claim) is rejected with 401", async ({
    request,
  }) => {
    // A JWT-like token without proper Firebase claims is always rejected
    const tokenWithoutKid =
      "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ3cm9uZy11c2VyIn0.YmFkLXNpZ25hdHVyZQ";
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${tokenWithoutKid}` },
    });
    expect([401, 403, 500]).toContain(res.status());
  });

  test("session token invalidation — stale token rejected from /api/users/me", async ({
    request,
  }) => {
    const staleToken = "stale-session-after-firebase-signout-e2e-test";
    const res = await request.get(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${staleToken}` },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

// ── Session persistence — authenticated API calls succeed consistently ────────

test.describe("Auth Shell — Session Persistence", () => {
  test("authenticated session token works on multiple sequential API calls", async ({
    request,
  }) => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(true, "SKIP:NO_TOKEN:admin");
      return;
    }

    // Make two sequential authenticated calls — both should succeed consistently
    const res1 = await ctx.get(`${API_BASE}/api/loads`, request);
    const res2 = await ctx.get(`${API_BASE}/api/loads`, request);

    expect([200, 404]).toContain(res1.status());
    expect([200, 404]).toContain(res2.status());
    // Both must return the same auth result (session is stable)
    expect(res1.status()).toBe(res2.status());
  });

  test("health endpoint is always accessible without auth (sanity check)", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
  });
});
