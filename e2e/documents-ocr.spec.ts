/**
 * E2E Documents & OCR/AI Proxy Tests — STORY-007 (R-P2E-01)
 *
 * Verifies:
 * - Document endpoint auth enforcement
 * - Upload path validation (request structure validation)
 * - AI proxy auth enforcement (Gemini proxy requires valid auth)
 *
 * NOTE: The AI router is mounted at /api/ai in index.ts. STORY-001 fixed the
 * double-prefix bug — route handlers now define paths as /extract-load (not
 * /api/ai/extract-load), so the effective path is correctly /api/ai/extract-load.
 *
 * Complements scanner.spec.ts.
 * Runs against real Express API on port 5000.
 */

import { test, expect } from "@playwright/test";
import { API_BASE, makeAdminRequest } from "./fixtures/auth.fixture";

/**
 * The AI proxy router is mounted at /api/ai. STORY-001 fixed the double-prefix
 * bug: route handlers now declare /extract-load (not /api/ai/extract-load),
 * so the effective endpoint is /api/ai/extract-load.
 */
const AI_EXTRACT_LOAD = `${API_BASE}/api/ai/extract-load`;

// ---------------------------------------------------------------------------
// Document Endpoint Auth Enforcement
// ---------------------------------------------------------------------------

test.describe("DOC — Document Endpoint Auth", () => {
  test("GET /api/loads without auth returns 401/403", async ({ request }) => {
    // Document data is gated behind load records; unauthenticated access blocked
    const res = await request.get(`${API_BASE}/api/loads`);
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/exceptions without auth returns 401/403", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/exceptions`);
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/loads/tracking without auth returns 401/403", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads/tracking`);
    expect([401, 403]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Upload Path Validation
// ---------------------------------------------------------------------------

test.describe("DOC — Upload Path Validation", () => {
  test("POST AI proxy without auth returns 401/403", async ({ request }) => {
    // AI proxy requires authentication — no anonymous access
    const res = await request.post(AI_EXTRACT_LOAD, {
      data: { imageBase64: "data:image/jpeg;base64,/9j/test" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST AI proxy with empty body returns 400/401/403", async ({
    request,
  }) => {
    const res = await request.post(AI_EXTRACT_LOAD, {
      data: {},
    });
    // Either auth-check first (401) or body validation first (400)
    expect([400, 401, 403]).toContain(res.status());
  });

  test("POST AI proxy with missing imageBase64 returns 400/401/403", async ({
    request,
  }) => {
    const res = await request.post(AI_EXTRACT_LOAD, {
      data: { mimeType: "image/jpeg" },
    });
    expect([400, 401, 403]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// AI Proxy Auth Enforcement
// ---------------------------------------------------------------------------

test.describe("DOC — AI Proxy Auth Enforcement", () => {
  test("AI proxy blocks unauthenticated requests — must not return 200", async ({
    request,
  }) => {
    const res = await request.post(AI_EXTRACT_LOAD, {
      data: { imageBase64: "dGVzdA==" },
      headers: {},
    });
    // Must NOT return 200 — auth required
    expect(res.status()).not.toBe(200);
    expect([400, 401, 403]).toContain(res.status());
  });

  test("AI proxy blocks malformed Bearer token", async ({ request }) => {
    const res = await request.post(AI_EXTRACT_LOAD, {
      data: { imageBase64: "dGVzdA==" },
      headers: { Authorization: "Bearer INVALID_TOKEN_XXXX" },
    });
    // Malformed token must be rejected
    expect([400, 401, 403]).toContain(res.status());
  });

  test("authenticated admin can reach AI proxy endpoint structure", async ({
    request,
  }) => {
    const auth = await makeAdminRequest();
    if (!auth.hasToken) {
      test.skip(true, "SKIP:NO_TOKEN:admin");
      return;
    }
    // With valid token, the AI proxy returns 400 (missing imageBase64) or
    // 500 (Gemini API key not set) — NOT 401/403
    const res = await auth.post(AI_EXTRACT_LOAD, { imageBase64: "" }, request);
    // Auth passed — now we get payload validation or Gemini error, not auth error
    expect([400, 500]).toContain(res.status());
  });
});
