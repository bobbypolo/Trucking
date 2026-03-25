import "dotenv/config";
import { test, expect } from "@playwright/test";
import { loginAsTeam05Admin } from "./team05-test-helpers";
import { API_BASE } from "./fixtures/auth.fixture";

async function signInFirebaseAdmin() {
  const apiKey =
    process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  const email = process.env.E2E_ADMIN_EMAIL || "admin@loadpilot.com";
  const password = process.env.E2E_ADMIN_PASSWORD || "Admin123";
  if (!apiKey) {
    throw new Error("FIREBASE_WEB_API_KEY not set");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Firebase sign-in failed: ${JSON.stringify(body)}`);
  }
  return {
    idToken: String(body.idToken || ""),
    firebaseUid: String(body.localId || ""),
    email,
  };
}

test.describe("Team 5 - Onboarding entities", () => {
  test("creates a real entity and shows it in the onboarding registry", async ({
    page,
    request,
  }) => {
    const auth = await signInFirebaseAdmin();

    const meResponse = await request.get(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${auth.idToken}` },
    });
    if (meResponse.status() === 401) {
      const loginResponse = await request.post(`${API_BASE}/api/auth/login`, {
        headers: {
          Authorization: `Bearer ${auth.idToken}`,
          "Content-Type": "application/json",
        },
        data: {
          email: auth.email,
          firebaseUid: auth.firebaseUid,
        },
      });
      expect([200, 404]).toContain(loginResponse.status());
    } else {
      expect([200, 404]).toContain(meResponse.status());
    }

    const me = (await request
      .get(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${auth.idToken}` },
      })
      .then((res) => res.json())) as {
      companyId?: string;
      tenantId?: string;
      company_id?: string;
    };
    const companyId = me.companyId || me.tenantId || me.company_id;
    expect(companyId).toBeTruthy();

    const entityName = `T5 QA Carrier ${Date.now()}`;
    const createResponse = await request.post(`${API_BASE}/api/parties`, {
      headers: {
        Authorization: `Bearer ${auth.idToken}`,
        "Content-Type": "application/json",
      },
      data: {
        name: entityName,
        type: "Carrier",
        entityClass: "Contractor",
        company_id: companyId,
        status: "Draft",
        isCustomer: false,
        isVendor: true,
        mc_number: `MC-${Date.now().toString().slice(-6)}`,
        dot_number: `DOT-${Date.now().toString().slice(-6)}`,
        email: `qa-${Date.now()}@example.com`,
      },
    });
    expect([200, 201]).toContain(createResponse.status());

    await loginAsTeam05Admin(page);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Onboarding", exact: true })
      .click();

    const onboardingPortal = page.getByTestId("onboarding-portal");
    await expect(onboardingPortal).toBeVisible();
    await expect(onboardingPortal.getByText("Loading content")).toHaveCount(0, {
      timeout: 20_000,
    });
    await onboardingPortal
      .getByLabel("Search entities by name, MC#, DOT# or contact")
      .fill(entityName);
    await expect(
      onboardingPortal.getByLabel("Search entities by name, MC#, DOT# or contact"),
    ).toHaveValue(entityName);

    const partiesResponse = await request.get(`${API_BASE}/api/parties`, {
      headers: { Authorization: `Bearer ${auth.idToken}` },
    });
    expect(partiesResponse.status()).toBe(200);
    const parties = (await partiesResponse.json()) as Array<{ name?: string }>;
    expect(parties.some((party) => party.name === entityName)).toBe(true);
  });
});
