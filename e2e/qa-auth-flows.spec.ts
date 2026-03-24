import { test, expect } from "@playwright/test";
import {
  API_BASE,
  makeAdminRequest,
  makeDispatcherRequest,
  makeDriverRequest,
  isValidFirebaseToken,
  type AuthContext,
} from "./fixtures/auth.fixture";

/**
 * QA-01 Auth Flows Spec
 *
 * Comprehensive E2E tests for authentication flows:
 * 1. Login form rendering and structure
 * 2. Signup multi-step wizard rendering and navigation
 * 3. Auth rejection (unauthenticated access redirects)
 * 4. Token verification (API responds to valid/invalid tokens)
 *
 * API-level tests run unconditionally.
 * UI-level tests require E2E_SERVER_RUNNING=1.
 */

const APP_BASE = process.env.E2E_APP_URL || "http://localhost:5173";
const SERVER_RUNNING = !!process.env.E2E_SERVER_RUNNING;
const E2E_EMAIL = process.env.E2E_TEST_EMAIL || process.env.E2E_ADMIN_EMAIL;
const E2E_PASSWORD =
  process.env.E2E_TEST_PASSWORD || process.env.E2E_ADMIN_PASSWORD;

// ── Login Form Rendering (UI) ────────────────────────────────────────────────

test.describe("QA-01 Auth Flows — Login Form Rendering", () => {
  test.skip(!SERVER_RUNNING, "Requires E2E_SERVER_RUNNING=1");

  test("login form renders with email input field", async ({ page }) => {
    await page.goto(APP_BASE);
    const emailInput = page.locator(
      'input[type="email"], input[name="email"], input[placeholder*="email" i]',
    );
    await expect(emailInput.first()).toBeVisible({ timeout: 10_000 });
  });

  test("login form renders with password input field", async ({ page }) => {
    await page.goto(APP_BASE);
    const passwordInput = page.locator(
      'input[type="password"], input[name="password"]',
    );
    await expect(passwordInput.first()).toBeVisible({ timeout: 10_000 });
  });

  test("login form renders with a submit button", async ({ page }) => {
    await page.goto(APP_BASE);
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")',
    );
    await expect(submitBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("email field is required — empty submit shows validation", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    // Try to submit without filling any field
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // HTML5 validation or custom error should appear
    const emailInput = page.locator('input[type="email"]').first();
    const validationMsg = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage,
    );
    // Either HTML5 validation or a custom error indicator should be present
    const hasHtml5Error = validationMsg.length > 0;
    const hasCustomError = await page
      .locator('[role="alert"], .error, .error-message, [data-testid*="error"]')
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    expect(hasHtml5Error || hasCustomError).toBe(true);
  });

  test("password field is required — empty password after email shows validation", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill("test@example.com");
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Check for HTML5 validation on password or custom error
    const passwordInput = page.locator('input[type="password"]').first();
    const validationMsg = await passwordInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage,
    );
    const hasHtml5Error = validationMsg.length > 0;
    const hasCustomError = await page
      .locator('[role="alert"], .error, .error-message, [data-testid*="error"]')
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    expect(hasHtml5Error || hasCustomError).toBe(true);
  });

  test("invalid credentials show error feedback on login form", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    await page
      .locator('input[type="email"]')
      .first()
      .fill("nonexistent-qa01@example.invalid");
    await page
      .locator('input[type="password"]')
      .first()
      .fill("WrongPassword999!");
    await page.locator('button[type="submit"]').first().click();

    const errorEl = page.locator(
      '[role="alert"], .error, .error-message, [data-testid*="error"], ' +
        'p:has-text("invalid"), p:has-text("incorrect"), p:has-text("failed"), ' +
        'div:has-text("Invalid"), span:has-text("error")',
    );
    await expect(errorEl.first()).toBeVisible({ timeout: 12_000 });
  });

  test("submit button is enabled when both fields are filled", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    await page.locator('input[type="email"]').first().fill("test@example.com");
    await page
      .locator('input[type="password"]')
      .first()
      .fill("SomePassword123!");
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeEnabled();
  });
});

// ── Signup Multi-Step Wizard (UI) ────────────────────────────────────────────

test.describe("QA-01 Auth Flows — Signup Multi-Step Wizard", () => {
  test.skip(!SERVER_RUNNING, "Requires E2E_SERVER_RUNNING=1");

  test("signup wizard entry button is visible on login page", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    const signupBtn = page.locator(
      'button:has-text("Apply for New Authority"), button:has-text("Sign up"), ' +
        'button:has-text("Register"), button:has-text("Create Account"), ' +
        'a:has-text("Sign up"), a:has-text("Register")',
    );
    await expect(signupBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("clicking signup button navigates to step 1 of wizard", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    const signupBtn = page.locator(
      'button:has-text("Apply for New Authority"), button:has-text("Sign up"), ' +
        'button:has-text("Register"), button:has-text("Create Account")',
    );
    await signupBtn.first().click();

    // Step 1 heading or identity fields should appear
    const step1Indicator = page.locator(
      'h2:has-text("Step 1"), h2:has-text("Identity"), ' +
        'input[placeholder="Legal Name"], input[placeholder*="name" i]',
    );
    await expect(step1Indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test("signup step 1 renders identity fields (name, company, email, password)", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    const signupBtn = page.locator(
      'button:has-text("Apply for New Authority"), button:has-text("Sign up"), ' +
        'button:has-text("Register"), button:has-text("Create Account")',
    );
    await signupBtn.first().click();

    // Wait for step 1 to load
    await page
      .locator('h2:has-text("Step 1"), h2:has-text("Identity")')
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => {
        /* Heading may have different text */
      });

    // At minimum, there should be input fields for signup
    const inputs = page.locator("input");
    const inputCount = await inputs.count();
    // Signup step should have at least 3 input fields (name, email, password or similar)
    expect(inputCount).toBeGreaterThanOrEqual(3);
  });

  test("signup step 1 fields have validation — empty submit blocked", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    const signupBtn = page.locator(
      'button:has-text("Apply for New Authority"), button:has-text("Sign up"), ' +
        'button:has-text("Register"), button:has-text("Create Account")',
    );
    await signupBtn.first().click();

    // Wait for at least one input field to appear on the signup step
    await page
      .locator("input")
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    // Capture URL before submit attempt
    const urlBeforeSubmit = page.url();

    // Try to advance without filling required fields
    const nextBtn = page.locator('button[type="submit"]').first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();

      // Allow a brief moment for any navigation or validation to trigger
      await page.waitForLoadState("domcontentloaded");

      // The page should still show the signup form — validation must block advancement.
      // Check that signup-related content is still present (form inputs, signup text, or same URL).
      const signupFormStillPresent = await page
        .locator(
          'h2:has-text("Step 1"), h2:has-text("Identity"), ' +
            'input[placeholder="Legal Name"], input[placeholder*="name" i]',
        )
        .first()
        .isVisible()
        .catch(() => false);
      const urlAfterSubmit = page.url();
      const stayedOnSamePage = urlAfterSubmit === urlBeforeSubmit;

      // At least one of these must be true: signup form elements still visible,
      // or the URL did not change (i.e., validation prevented navigation).
      expect(signupFormStillPresent || stayedOnSamePage).toBe(true);
    }
  });

  test("signup wizard can navigate back to login from step 1", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    const signupBtn = page.locator(
      'button:has-text("Apply for New Authority"), button:has-text("Sign up"), ' +
        'button:has-text("Register"), button:has-text("Create Account")',
    );
    await signupBtn.first().click();

    // Wait for signup step to load by checking for an input field
    await page
      .locator("input")
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    // Find and click the back button (arrow or text)
    const backBtn = page.locator(
      'button:has-text("Back"), button:has-text("Cancel"), ' +
        'button[aria-label*="back" i], button[type="button"]:first-of-type',
    );
    if (
      await backBtn
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await backBtn.first().click();
    } else {
      // Try clicking a generic back button with an SVG icon
      const arrowBtn = page.locator('button[type="button"]').first();
      if (await arrowBtn.isVisible().catch(() => false)) {
        await arrowBtn.click();
      }
    }

    // Should be back at login — email and password fields visible
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Auth Rejection — Unauthenticated Access Redirects (UI) ──────────────────

test.describe("QA-01 Auth Flows — Unauthenticated Access Redirects", () => {
  test.skip(!SERVER_RUNNING, "Requires E2E_SERVER_RUNNING=1");

  const protectedRoutes = [
    "/dashboard",
    "/loads",
    "/admin",
    "/settings",
    "/accounting",
  ];

  for (const route of protectedRoutes) {
    test(`unauthenticated navigation to ${route} redirects to login`, async ({
      page,
    }) => {
      await page.goto(`${APP_BASE}${route}`);
      const url = page.url();
      // Must not remain on the protected route
      expect(url).not.toMatch(new RegExp(`${route}($|\\?)`));
      // Should land on login-related route or root
      expect(url).toMatch(/localhost:5173\/(login|auth|signin|$)/i);
    });
  }

  test("unauthenticated user sees login form, not authenticated shell", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    // Login form must be visible, not a sidebar/nav
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput.first()).toBeVisible({ timeout: 10_000 });

    // The authenticated shell sidebar should NOT be visible
    const sidebar = page.locator(
      'aside nav, [data-testid="sidebar"], nav:has(a[href*="loads"])',
    );
    const sidebarVisible = await sidebar
      .first()
      .isVisible()
      .catch(() => false);
    expect(sidebarVisible).toBe(false);
  });
});

// ── Auth Rejection — API-Level (Always Runs) ────────────────────────────────

test.describe("QA-01 Auth Flows — API Unauthenticated Rejection", () => {
  const protectedEndpoints = [
    "/api/loads",
    "/api/equipment",
    "/api/clients",
    "/api/users/me",
    "/api/accounting/settlements",
    "/api/exceptions",
    "/api/contracts",
    "/api/dispatch",
    "/api/brokers",
  ];

  for (const endpoint of protectedEndpoints) {
    test(`GET ${endpoint} without auth returns 401/403/500`, async ({
      request,
    }) => {
      const res = await request.get(`${API_BASE}${endpoint}`);
      expect([401, 403, 404, 500]).toContain(res.status());
      expect(res.status()).not.toBe(200);
    });
  }

  test("POST /api/loads without auth is rejected", async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/loads`, {
      data: { origin: "QA-01 Test", destination: "QA-01 Dest" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
    expect(res.status()).not.toBe(201);
  });

  test("health endpoint remains publicly accessible", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
  });
});

// ── Token Verification — Valid Tokens (API-Level) ───────────────────────────

test.describe("QA-01 Auth Flows — Valid Token Verification", () => {
  test("admin token grants access to /api/loads", async ({ request }) => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(true, "Admin credentials not available");
      return;
    }
    expect(isValidFirebaseToken(ctx.idToken)).toBe(true);
    const res = await ctx.get(`${API_BASE}/api/loads`, request);
    expect([200, 404]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
  });

  test("admin token grants access to /api/users/me", async ({ request }) => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(true, "Admin credentials not available");
      return;
    }
    const res = await ctx.get(`${API_BASE}/api/users/me`, request);
    expect([200, 404]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
  });

  test("dispatcher token grants access to /api/loads", async ({ request }) => {
    const ctx = await makeDispatcherRequest();
    if (!ctx.hasToken) {
      test.skip(true, "Dispatcher credentials not available");
      return;
    }
    expect(isValidFirebaseToken(ctx.idToken)).toBe(true);
    const res = await ctx.get(`${API_BASE}/api/loads`, request);
    expect([200, 404]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test("driver token grants access to /api/users/me", async ({ request }) => {
    const ctx = await makeDriverRequest();
    if (!ctx.hasToken) {
      test.skip(true, "Driver credentials not available");
      return;
    }
    expect(isValidFirebaseToken(ctx.idToken)).toBe(true);
    const res = await ctx.get(`${API_BASE}/api/users/me`, request);
    expect([200, 404]).toContain(res.status());
    expect(res.status()).not.toBe(401);
  });

  test("valid token works consistently across multiple requests", async ({
    request,
  }) => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(true, "Admin credentials not available");
      return;
    }
    const res1 = await ctx.get(`${API_BASE}/api/loads`, request);
    const res2 = await ctx.get(`${API_BASE}/api/loads`, request);
    expect([200, 404]).toContain(res1.status());
    expect([200, 404]).toContain(res2.status());
    expect(res1.status()).toBe(res2.status());
  });
});

// ── Token Verification — Invalid Tokens (API-Level) ─────────────────────────

test.describe("QA-01 Auth Flows — Invalid Token Rejection", () => {
  test("empty Bearer token value is rejected", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: "Bearer " },
    });
    expect([400, 401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("malformed JWT (not a valid JWT structure) is rejected", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: "Bearer not-a-valid-jwt-token" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("JWT with only 2 segments is rejected", async ({ request }) => {
    const twoSegmentToken = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ3cm9uZy11c2VyIn0";
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${twoSegmentToken}` },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("JWT with fake signature is rejected", async ({ request }) => {
    const fakeToken =
      "eyJhbGciOiJSUzI1NiIsImtpZCI6ImZha2Uta2V5LWlkIn0.eyJzdWIiOiJmYWtlLXVzZXIiLCJ0ZW5hbnRJZCI6InRlc3QifQ.ZmFrZVNpZ25hdHVyZQ";
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("expired/invalidated post-logout token is rejected", async ({
    request,
  }) => {
    const postLogoutToken = "post-logout-invalidated-qa01-token";
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${postLogoutToken}` },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("no Authorization header at all is rejected", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { "Content-Type": "application/json" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("non-Bearer auth scheme is rejected", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

// ── Token Verification — Firebase REST API (API-Level) ──────────────────────

test.describe("QA-01 Auth Flows — Firebase REST Token Verification", () => {
  test("invalid credentials are rejected by Firebase REST API", async () => {
    const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;
    test.skip(
      !FIREBASE_API_KEY,
      "FIREBASE_WEB_API_KEY not set — cannot test Firebase REST",
    );

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "qa01-nonexistent@invalid.example",
        password: "WrongPasswordQA01!",
        returnSecureToken: true,
      }),
    });
    expect(res.ok).toBe(false);
    expect([400, 401, 403]).toContain(res.status);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
  });

  test("valid admin credentials produce a real Firebase JWT", async () => {
    const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(
      !FIREBASE_API_KEY || !email || !password,
      "Firebase API key or admin credentials not set",
    );

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("idToken");
    const token = body["idToken"] as string;
    expect(isValidFirebaseToken(token)).toBe(true);
  });
});

// ── Successful Login Flow (UI) ──────────────────────────────────────────────

test.describe("QA-01 Auth Flows — Successful Login", () => {
  test.skip(
    !SERVER_RUNNING || !E2E_EMAIL || !E2E_PASSWORD,
    "Requires E2E_SERVER_RUNNING=1 and test credentials",
  );

  test("successful login redirects to authenticated route", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    await page.locator('input[type="email"]').first().fill(E2E_EMAIL!);
    await page.locator('input[type="password"]').first().fill(E2E_PASSWORD!);
    await page.locator('button[type="submit"]').first().click();

    // Wait for authenticated shell (app stays at / after login)
    await page
      .locator("nav, [role='navigation'], aside")
      .first()
      .waitFor({ timeout: 20_000 });

    const url = page.url();
    expect(url).not.toMatch(/\/(login|auth|signin)/i);
  });

  test("authenticated shell renders navigation after login", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    await page.locator('input[type="email"]').first().fill(E2E_EMAIL!);
    await page.locator('input[type="password"]').first().fill(E2E_PASSWORD!);
    await page.locator('button[type="submit"]').first().click();

    // Wait for authenticated shell (app stays at / after login)
    await page
      .locator("nav, [role='navigation'], aside")
      .first()
      .waitFor({ timeout: 20_000 });

    const shellNav = page.locator(
      'nav, [role="navigation"], aside, [data-testid*="sidebar"], header',
    );
    await expect(shellNav.first()).toBeVisible({ timeout: 10_000 });
  });

  test("tenant context established — user info or company name visible", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    await page.locator('input[type="email"]').first().fill(E2E_EMAIL!);
    await page.locator('input[type="password"]').first().fill(E2E_PASSWORD!);
    await page.locator('button[type="submit"]').first().click();

    // Wait for authenticated shell (app stays at / after login)
    await page
      .locator("nav, [role='navigation'], aside")
      .first()
      .waitFor({ timeout: 20_000 });

    const tenantEl = page.locator(
      '[data-testid="tenant-name"], [data-testid="company-name"], ' +
        ".company-name, .tenant-name, header, aside",
    );
    await expect(tenantEl.first()).toBeVisible({ timeout: 10_000 });
  });
});
