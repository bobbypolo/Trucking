import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Real E2E Authenticated CRUD Tests — R-P3-02
 *
 * Uses Firebase REST API to obtain a real ID token, then tests
 * authenticated operations against the REAL Express server.
 *
 * Requires:
 *   - FIREBASE_WEB_API_KEY in .env (for token exchange)
 *   - E2E_TEST_EMAIL / E2E_TEST_PASSWORD for an existing Firebase test user
 *   - serviceAccount.json present for full CRUD (otherwise token-only tests run)
 *
 * If serviceAccount.json is absent, the server returns 500 on auth middleware
 * (Firebase Admin SDK not initialized). Token-acquisition tests still pass.
 */

import { API_BASE } from "./fixtures/urls";
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

const projectRoot = path.resolve(__dirname, "..");
const serviceAccountPath = path.join(
  projectRoot,
  "server",
  "serviceAccount.json",
);
const hasServiceAccount = fs.existsSync(serviceAccountPath);

/**
 * Sign in a Firebase user via Identity Toolkit REST API.
 * Returns the idToken or throws on failure.
 */
async function signInFirebaseUser(
  email: string,
  password: string,
): Promise<string> {
  if (!FIREBASE_WEB_API_KEY) {
    throw new Error("FIREBASE_WEB_API_KEY not set in environment");
  }
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `Firebase signIn failed: ${JSON.stringify(body["error"] ?? body)}`,
    );
  }
  return body["idToken"] as string;
}

// ── Firebase REST Token Acquisition ──────────────────────────────────────────

test.describe("Firebase REST Auth — Token Acquisition", () => {
  test.skip(!FIREBASE_WEB_API_KEY, "SKIP:NO_FIREBASE_KEY");
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped — E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set",
  );

  test("Firebase REST API returns valid ID token for test user", async () => {
    const idToken = await signInFirebaseUser(E2E_EMAIL!, E2E_PASSWORD!);
    // Token must be a non-empty string
    expect(typeof idToken).toBe("string");
    expect(idToken.length).toBeGreaterThan(100);
    // Firebase JWT has 3 dot-separated segments
    const parts = idToken.split(".");
    expect(parts).toHaveLength(3);
  });

  test("Firebase ID token is a well-formed JWT", async () => {
    const idToken = await signInFirebaseUser(E2E_EMAIL!, E2E_PASSWORD!);
    const parts = idToken.split(".");
    expect(parts).toHaveLength(3);
    // Header must decode to valid JSON with alg field
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    expect(header).toHaveProperty("alg");
    // Payload must decode to valid JSON with sub field
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload).toHaveProperty("sub");
    expect(typeof payload.sub).toBe("string");
  });
});

// ── Authenticated API Tests (requires serviceAccount.json) ───────────────────

test.describe("Authenticated CRUD — Real Server (serviceAccount required)", () => {
  test.skip(
    !hasServiceAccount,
    "Skipped — serviceAccount.json not present (Firebase Admin SDK not initialized)",
  );
  test.skip(!FIREBASE_WEB_API_KEY, "SKIP:NO_FIREBASE_KEY");
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Skipped — E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set",
  );

  let idToken: string;

  test.beforeAll(async () => {
    idToken = await signInFirebaseUser(E2E_EMAIL!, E2E_PASSWORD!);
  });

  test("authenticated GET /api/loads returns 200 with array", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("authenticated POST /api/loads creates a load", async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        origin: "Chicago, IL",
        destination: "Detroit, MI",
        weight: 10000,
        commodity: "E2E Test Freight",
        status: "draft",
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty("id");
  });

  test("authenticated GET /api/users returns 200", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/users`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    // 200 = success, 403 = not admin (also valid auth response)
    expect([200, 403]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });
});

// ── Auth token rejection with live server ────────────────────────────────────

test.describe("Real Server — Token Rejection", () => {
  test("server rejects token signed with wrong key", async ({ request }) => {
    // A well-formed JWT signed with wrong key — server must reject
    const fakeToken =
      "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJzdWIiOiJ0ZXN0LXVzZXIiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJ0ZW5hbnRJZCI6InRlc3QtdGVuYW50IiwiaWF0IjoxNzA5OTQ0MDAwfQ." +
      "fake-signature-that-will-not-verify";
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("server rejects empty Bearer token", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: "Bearer " },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});
