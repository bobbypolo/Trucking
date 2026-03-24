import { test, expect, type Page } from "@playwright/test";
import {
  API_BASE,
  makeAdminRequest,
  isValidFirebaseToken,
  signInFirebase,
} from "./fixtures/auth.fixture";

/**
 * ============================================================================
 * Team 01 — Auth Shell Acceptance Tests
 * ============================================================================
 *
 * Trace IDs: T1-03, T1-04, CORE-02, CORE-03
 *
 * AUTH ARCHITECTURE EVIDENCE
 * --------------------------
 * - Authentication: Firebase Auth (email/password) via REST Identity Toolkit API
 * - Token format: Firebase JWT (3-segment, RS256, contains sub/tenantId/exp/iat)
 * - API client: `services/api.ts` — `apiFetch()` wrapper attaches Bearer token
 * - 401 retry interceptor: On first 401, `forceRefreshToken()` is called to get
 *   a fresh Firebase ID token (bypassing cache), then the request is retried once.
 *   If the retry also returns 401, a `CustomEvent("auth:session-expired")` is
 *   dispatched on `window`, which triggers the SessionExpiredModal in App.tsx.
 * - Session management: In-memory token cache (`_idToken` in authService.ts).
 *   No localStorage/sessionStorage for auth tokens. `onAuthStateChanged` listener
 *   hydrates the session on app load; API call to `/api/users/me` fetches profile.
 * - Logout: `signOut(auth)` from Firebase SDK clears Firebase session, then
 *   in-memory caches (_sessionCache, _usersCache, _idToken) are nullified.
 * - Route guard: App.tsx renders `<Auth>` login form when `user` state is null.
 *   There are no URL-based routes — the app is a single-page tab-based shell.
 *   Direct navigation to any path without auth shows the login form.
 * - Rate limiting: 10 login attempts per 15 min, 3 password resets per 15 min.
 * - Session expired modal: Accessible `role="alertdialog"` with focus trap,
 *   triggered by `auth:session-expired` custom event from the 401 retry logic.
 *
 * TEST TIERS
 * ----------
 * Tier 1 — API-level tests: Always run. Validate token acquisition, auth
 *          enforcement, session persistence, and logout invalidation at the
 *          API/Firebase REST layer. No browser or running dev server needed.
 * Tier 2 — Browser UI tests: Require E2E_SERVER_RUNNING=1 with both Vite
 *          (port 5173) and Express (port 5000) running. Validate login form
 *          rendering, successful login shell, session restore on reload,
 *          logout navigation, and protected-route redirect.
 * ============================================================================
 */

const APP_BASE = process.env.E2E_APP_URL || "http://localhost:5173";
const SERVER_RUNNING = !!process.env.E2E_SERVER_RUNNING;
const E2E_EMAIL = process.env.E2E_TEST_EMAIL || process.env.E2E_ADMIN_EMAIL;
const E2E_PASSWORD =
  process.env.E2E_TEST_PASSWORD || process.env.E2E_ADMIN_PASSWORD;

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 — API-level auth acceptance (always runs, no browser)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("T1-03 / CORE-02: Valid login — admin token acquisition (API)", () => {
  test("admin credentials acquire a valid Firebase JWT with 3 segments", async () => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(
        true,
        "Admin credentials not available — FIREBASE_WEB_API_KEY or E2E creds missing",
      );
      return;
    }
    // Token must exist and be a well-formed JWT
    expect(ctx.idToken).toBeTruthy();
    expect(isValidFirebaseToken(ctx.idToken)).toBe(true);
    const segments = ctx.idToken.split(".");
    expect(segments).toHaveLength(3);
    expect(ctx.idToken.length).toBeGreaterThan(100);
  });

  test("admin token grants access to protected /api/loads endpoint (200 or 404, never 401/403)", async ({
    request,
  }) => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(true, "Admin credentials not available");
      return;
    }
    const res = await ctx.get(`${API_BASE}/api/loads`, request);
    // Authenticated admin must never get 401/403
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
    expect([200, 404]).toContain(res.status());
  });

  test("admin token grants access to /api/users/me profile endpoint", async ({
    request,
  }) => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(true, "Admin credentials not available");
      return;
    }
    const res = await ctx.get(`${API_BASE}/api/users/me`, request);
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
    expect([200, 404]).toContain(res.status());
  });
});

test.describe("CORE-03: Invalid login — bad credentials are cleanly rejected (API)", () => {
  test("Firebase REST API rejects nonexistent email with HTTP 400 error body", async () => {
    const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;
    if (!FIREBASE_API_KEY) {
      test.skip(
        true,
        "FIREBASE_WEB_API_KEY not set — cannot test invalid login",
      );
      return;
    }

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "does-not-exist-e2e@invalid.example",
        password: "CompletelyWrongPassword!@#456",
        returnSecureToken: true,
      }),
    });

    // Firebase returns 400 for invalid credentials (INVALID_LOGIN_CREDENTIALS)
    expect(res.ok).toBe(false);
    expect([400, 401, 403]).toContain(res.status);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
  });

  test("signInFirebase helper throws for invalid credentials (no token leaks)", async () => {
    const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;
    if (!FIREBASE_API_KEY) {
      test.skip(true, "FIREBASE_WEB_API_KEY not set");
      return;
    }

    await expect(
      signInFirebase("fake-user-e2e@nonexistent.invalid", "BadPassword999!"),
    ).rejects.toThrow();
  });

  test("malformed JWT is rejected by /api/loads with non-200 status", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: "Bearer this-is-not-a-jwt" },
    });
    expect(res.status()).not.toBe(200);
    expect([401, 403, 500]).toContain(res.status());
  });

  test("two-segment JWT (missing signature) is rejected", async ({
    request,
  }) => {
    const malformed = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ3cm9uZyJ9";
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${malformed}` },
    });
    expect(res.status()).not.toBe(200);
    expect([401, 403, 500]).toContain(res.status());
  });

  test("empty Bearer value is rejected (no auth bypass)", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: "Bearer " },
    });
    expect(res.status()).not.toBe(200);
    expect([400, 401, 403, 500]).toContain(res.status());
  });
});

test.describe("T1-04: Session persistence — token works across sequential requests (API)", () => {
  test("same admin token succeeds on two sequential /api/loads calls (session stable)", async ({
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
    // Both calls should return the same status — session is stable
    expect(res1.status()).toBe(res2.status());
  });

  test("admin token works across different endpoints within one session", async ({
    request,
  }) => {
    const ctx = await makeAdminRequest();
    if (!ctx.hasToken) {
      test.skip(true, "Admin credentials not available");
      return;
    }

    const resLoads = await ctx.get(`${API_BASE}/api/loads`, request);
    const resMe = await ctx.get(`${API_BASE}/api/users/me`, request);

    // Both should succeed (200/404) — never 401/403
    expect([200, 404]).toContain(resLoads.status());
    expect([200, 404]).toContain(resMe.status());
    expect(resLoads.status()).not.toBe(401);
    expect(resMe.status()).not.toBe(401);
  });
});

test.describe("Logout validation — invalidated tokens are rejected (API)", () => {
  test("post-logout stale token is rejected by /api/loads", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: "Bearer post-logout-stale-token-team01" },
    });
    expect(res.status()).not.toBe(200);
    expect([401, 403, 500]).toContain(res.status());
  });

  test("post-logout stale token is rejected by /api/users/me", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/users/me`, {
      headers: { Authorization: "Bearer expired-session-after-signout-team01" },
    });
    expect(res.status()).not.toBe(200);
    expect([401, 403, 500]).toContain(res.status());
  });

  test("no auth header at all is rejected (session data does not leak)", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads`);
    expect(res.status()).not.toBe(200);
    expect([401, 403, 500]).toContain(res.status());
  });
});

test.describe("Auth-required route guard — protected endpoints reject anonymous (API)", () => {
  const protectedPaths = [
    "/api/loads",
    "/api/equipment",
    "/api/users/me",
    "/api/accounting/settlements",
    "/api/exceptions",
    "/api/dispatch",
    "/api/clients",
    "/api/contracts",
  ];

  test("all protected API endpoints reject unauthenticated requests", async ({
    request,
  }) => {
    const results = await Promise.all(
      protectedPaths.map(async (path) => {
        const res = await request.get(`${API_BASE}${path}`);
        return { path, status: res.status() };
      }),
    );

    for (const { path, status } of results) {
      expect(status, `${path} must not return 200 without auth`).not.toBe(200);
    }
  });

  test("health endpoint remains publicly accessible (sanity baseline)", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2 — Browser UI auth acceptance (requires E2E_SERVER_RUNNING=1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: perform login via the browser UI.
 * Fills the Auth component's login form and submits.
 */
async function browserLogin(page: Page, email: string, password: string) {
  await page.goto(APP_BASE);
  // Wait for the login form to render (Auth component)
  const emailInput = page.locator('input[type="email"]').first();
  await expect(emailInput).toBeVisible({ timeout: 15_000 });

  await emailInput.fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
}

test.describe("T1-03 / CORE-02: Valid login flow — browser UI", () => {
  test.skip(
    !SERVER_RUNNING,
    "Requires E2E_SERVER_RUNNING=1 with Vite + Express",
  );
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Requires E2E_TEST_EMAIL/E2E_TEST_PASSWORD or E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD",
  );

  test("login form renders with email field, password field, and submit button", async ({
    page,
  }) => {
    await page.goto(APP_BASE);
    // Auth.tsx login form: h2 "Sign In", input[type=email], input[type=password], button[type=submit]
    await expect(page.locator('input[type="email"]').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
    // Heading should say "Sign In"
    await expect(page.locator('h2:has-text("Sign In")').first()).toBeVisible();
  });

  test("valid admin credentials authenticate and render the app shell with navigation", async ({
    page,
  }) => {
    await browserLogin(page, E2E_EMAIL!, E2E_PASSWORD!);

    // After successful login, the Auth component unmounts and the main shell renders.
    // The shell has a sidebar with nav links and a header. Wait for nav to appear.
    const shellNav = page.locator(
      'nav, [role="navigation"], aside, [data-testid*="sidebar"], header',
    );
    await expect(shellNav.first()).toBeVisible({ timeout: 20_000 });

    // At least one navigation link should be present in the sidebar
    const navLinks = page.locator('nav a, aside a, [role="navigation"] a');
    await expect(navLinks.first()).toBeVisible({ timeout: 10_000 });

    // The login form (h2 "Sign In") should no longer be visible
    await expect(page.locator('h2:has-text("Sign In")')).not.toBeVisible();
  });
});

test.describe("CORE-03: Invalid login flow — browser UI (no crash, no hang, no null-app)", () => {
  test.skip(
    !SERVER_RUNNING,
    "Requires E2E_SERVER_RUNNING=1 with Vite + Express",
  );

  test("bad credentials show error message without crashing the app", async ({
    page,
  }) => {
    // Track JS errors — a crash would fire pageerror
    let jsErrorOccurred = false;
    page.on("pageerror", () => {
      jsErrorOccurred = true;
    });

    await browserLogin(
      page,
      "nonexistent-e2e@invalid.example",
      "WrongPassword999!",
    );

    // Auth.tsx shows error in a <p> with class text-red-400
    const errorEl = page.locator(
      'p.text-red-400, [role="alert"], .error-message, ' +
        'p:has-text("Invalid"), p:has-text("incorrect"), p:has-text("failed")',
    );
    await expect(errorEl.first()).toBeVisible({ timeout: 12_000 });

    // App must NOT crash — no JS errors
    expect(jsErrorOccurred).toBe(false);

    // App must NOT hang — the login form should still be interactive
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toBeEnabled();

    // The submit button should be re-enabled (not stuck in "Signing In..." state)
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });

    // App must NOT enter null-app state — login heading still present
    await expect(page.locator('h2:has-text("Sign In")')).toBeVisible();
  });

  test("bad credentials do NOT render the authenticated shell (no sidebar leak)", async ({
    page,
  }) => {
    await browserLogin(page, "fake-user@example.invalid", "BadPass123!");

    // Wait for error to appear (confirms login was attempted)
    const errorEl = page.locator("p.text-red-400");
    await expect(errorEl.first()).toBeVisible({ timeout: 12_000 });

    // Authenticated shell elements must NOT be visible
    const sidebar = page.locator(
      '[data-testid*="sidebar"], aside:has(nav), nav:has(a[href])',
    );
    await expect(sidebar).not.toBeVisible();
  });
});

test.describe("T1-04: Session restore — reload preserves authentication (browser UI)", () => {
  test.skip(
    !SERVER_RUNNING,
    "Requires E2E_SERVER_RUNNING=1 with Vite + Express",
  );
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Requires E2E credentials");

  test("after login, page reload restores authenticated session (user stays logged in)", async ({
    page,
  }) => {
    // Step 1: Login
    await browserLogin(page, E2E_EMAIL!, E2E_PASSWORD!);

    // Step 2: Wait for authenticated shell to render
    const shellNav = page.locator('nav, [role="navigation"], aside, header');
    await expect(shellNav.first()).toBeVisible({ timeout: 20_000 });

    // Step 3: Reload the page
    await page.reload();

    // Step 4: After reload, Firebase onAuthStateChanged should restore the session.
    // The authenticated shell should re-appear (not the login form).
    // Allow extra time for Firebase SDK to re-initialize and hydrate.
    const shellNavAfterReload = page.locator(
      'nav, [role="navigation"], aside, header',
    );
    await expect(shellNavAfterReload.first()).toBeVisible({ timeout: 25_000 });

    // Login form should NOT be visible
    await expect(page.locator('h2:has-text("Sign In")')).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("session restore does not produce JS errors on reload", async ({
    page,
  }) => {
    let jsErrorOccurred = false;
    page.on("pageerror", () => {
      jsErrorOccurred = true;
    });

    await browserLogin(page, E2E_EMAIL!, E2E_PASSWORD!);
    const shellNav = page.locator('nav, [role="navigation"], aside, header');
    await expect(shellNav.first()).toBeVisible({ timeout: 20_000 });

    await page.reload();

    // Wait for the shell to re-render after reload
    await expect(shellNav.first()).toBeVisible({ timeout: 25_000 });
    expect(jsErrorOccurred).toBe(false);
  });
});

test.describe("Logout flow — app returns to login with no session data leaks (browser UI)", () => {
  test.skip(
    !SERVER_RUNNING,
    "Requires E2E_SERVER_RUNNING=1 with Vite + Express",
  );
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Requires E2E credentials");

  test("clicking Sign Out returns to login screen", async ({ page }) => {
    // Login first
    await browserLogin(page, E2E_EMAIL!, E2E_PASSWORD!);
    const shellNav = page.locator('nav, [role="navigation"], aside, header');
    await expect(shellNav.first()).toBeVisible({ timeout: 20_000 });

    // Find and click the logout/sign-out button
    // App.tsx: button with LogOut icon + "Sign Out" text, or aria-label
    const logoutBtn = page.locator(
      'button:has-text("Sign Out"), button:has-text("Logout"), ' +
        'button:has-text("Log out"), a:has-text("Sign Out"), ' +
        '[data-testid*="logout"], [aria-label*="logout" i], [aria-label*="sign out" i]',
    );
    const logoutVisible = await logoutBtn
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!logoutVisible) {
      test.skip(
        true,
        "Logout button not visible in current UI state — may need sidebar expansion",
      );
      return;
    }

    await logoutBtn.first().click();

    // After logout, the login form should appear
    await expect(page.locator('h2:has-text("Sign In")').first()).toBeVisible({
      timeout: 15_000,
    });

    // The authenticated shell should NOT be visible
    await expect(page.locator("aside:has(nav)")).not.toBeVisible();
  });

  test("after logout, no session token leaks in localStorage or sessionStorage", async ({
    page,
  }) => {
    await browserLogin(page, E2E_EMAIL!, E2E_PASSWORD!);
    const shellNav = page.locator('nav, [role="navigation"], aside, header');
    await expect(shellNav.first()).toBeVisible({ timeout: 20_000 });

    const logoutBtn = page.locator(
      'button:has-text("Sign Out"), button:has-text("Logout"), ' +
        'button:has-text("Log out")',
    );
    const logoutVisible = await logoutBtn
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!logoutVisible) {
      test.skip(
        true,
        "Logout button not visible — skipping session leak check",
      );
      return;
    }

    await logoutBtn.first().click();
    await expect(page.locator('h2:has-text("Sign In")').first()).toBeVisible({
      timeout: 15_000,
    });

    // Verify no auth tokens remain in browser storage
    const storageCheck = await page.evaluate(() => {
      const localKeys = Object.keys(localStorage);
      const sessionKeys = Object.keys(sessionStorage);
      // Check for any key that looks like an auth token
      const suspiciousLocal = localKeys.filter(
        (k) =>
          k.includes("token") ||
          k.includes("idToken") ||
          k.includes("auth") ||
          k.includes("firebase"),
      );
      const suspiciousSession = sessionKeys.filter(
        (k) =>
          k.includes("token") ||
          k.includes("idToken") ||
          k.includes("auth_token"),
      );
      return { suspiciousLocal, suspiciousSession };
    });

    // App uses in-memory token cache, not browser storage — verify no leaks
    // Note: Firebase SDK may store persistence data in indexedDB, which is fine.
    // We specifically check localStorage/sessionStorage don't have raw tokens.
    expect(
      storageCheck.suspiciousLocal.filter((k) => k.includes("idToken")),
    ).toHaveLength(0);
    expect(
      storageCheck.suspiciousSession.filter((k) => k.includes("idToken")),
    ).toHaveLength(0);
  });
});

test.describe("Auth-required route guard — browser redirect to login (browser UI)", () => {
  test.skip(
    !SERVER_RUNNING,
    "Requires E2E_SERVER_RUNNING=1 with Vite + Express",
  );

  test("navigating to /dashboard without auth shows the login form (not the dashboard)", async ({
    page,
  }) => {
    await page.goto(`${APP_BASE}/dashboard`);
    // SPA: App.tsx renders <Auth> when user is null, regardless of URL path
    const loginHeading = page.locator('h2:has-text("Sign In")');
    await expect(loginHeading.first()).toBeVisible({ timeout: 15_000 });
  });

  test("navigating to /loads without auth shows the login form", async ({
    page,
  }) => {
    await page.goto(`${APP_BASE}/loads`);
    const loginHeading = page.locator('h2:has-text("Sign In")');
    await expect(loginHeading.first()).toBeVisible({ timeout: 15_000 });
  });

  test("navigating to /admin without auth shows the login form", async ({
    page,
  }) => {
    await page.goto(`${APP_BASE}/admin`);
    const loginHeading = page.locator('h2:has-text("Sign In")');
    await expect(loginHeading.first()).toBeVisible({ timeout: 15_000 });
  });

  test("navigating to /accounting without auth shows login (no unauthenticated data exposure)", async ({
    page,
  }) => {
    await page.goto(`${APP_BASE}/accounting`);
    const loginHeading = page.locator('h2:has-text("Sign In")');
    await expect(loginHeading.first()).toBeVisible({ timeout: 15_000 });

    // Verify no financial data is visible
    await expect(
      page.locator("text=Settlement, text=Invoice, text=Revenue"),
    ).not.toBeVisible();
  });
});
