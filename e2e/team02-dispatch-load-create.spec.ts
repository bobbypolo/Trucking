import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import { API_BASE, makeAdminRequest } from "./fixtures/auth.fixture";

const APP_BASE = process.env.E2E_APP_URL || "http://localhost:5173";
const SERVER_RUNNING = !!process.env.E2E_SERVER_RUNNING;
const UI_EMAIL =
  process.env.E2E_TEST_EMAIL ||
  process.env.E2E_ADMIN_EMAIL ||
  "admin@loadpilot.com";
const UI_PASSWORD =
  process.env.E2E_TEST_PASSWORD ||
  process.env.E2E_ADMIN_PASSWORD ||
  "Admin123";

async function loginAsUser(page: Page) {
  await page.goto(APP_BASE);
  await page.locator('input[type="email"]').first().fill(UI_EMAIL);
  await page.locator('input[type="password"]').first().fill(UI_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await expect(page.getByRole("button", { name: /Sign Out/i }).first()).toBeVisible({
    timeout: 30_000,
  });
}

async function createTrackedLoad(
  request: APIRequestContext,
  idToken: string,
) {
  const loadId = uuidv4();
  const loadNumber = `T2-LOAD-${Date.now().toString(36).toUpperCase()}`;
  const res = await request.post(`${API_BASE}/api/loads`, {
    headers: { Authorization: `Bearer ${idToken}` },
    data: {
      id: loadId,
      load_number: loadNumber,
      status: "planned",
      carrier_rate: 3400,
      driver_pay: 1800,
      freight_type: "dry_van",
      commodity: "Team 2 dispatch validation freight",
      pickup_date: new Date().toISOString().split("T")[0],
      legs: [
        {
          id: uuidv4(),
          type: "Pickup",
          facility_name: "Team 2 Pickup Dock",
          city: "Chicago",
          state: "IL",
          date: new Date().toISOString().split("T")[0],
          appointment_time: "08:00",
          completed: false,
          sequence_order: 0,
        },
        {
          id: uuidv4(),
          type: "Dropoff",
          facility_name: "Team 2 Delivery Dock",
          city: "Detroit",
          state: "MI",
          date: new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          appointment_time: "16:00",
          completed: false,
          sequence_order: 1,
        },
      ],
    },
  });

  expect([200, 201]).toContain(res.status());
  return { loadId, loadNumber };
}

test.describe("Team 2 - Load Board Create Flow", () => {
  test("API create persists a load in the backend list", async ({ request }) => {
    const auth = await makeAdminRequest();
    test.skip(!auth.hasToken, "Firebase token unavailable for admin auth");

    const seeded = await createTrackedLoad(request, auth.idToken);
    const listRes = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${auth.idToken}` },
    });
    expect(listRes.status()).toBe(200);
    const loads = await listRes.json();
    expect(Array.isArray(loads)).toBe(true);
    expect(
      loads.some(
        (row: Record<string, unknown>) =>
          row.id === seeded.loadId || row.load_number === seeded.loadNumber,
      ),
    ).toBe(true);
  });

  test.skip(!SERVER_RUNNING, "Requires E2E_SERVER_RUNNING=1");

  test("browser Create Load opens the setup modal and the board shows backend data", async ({
    page,
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(!auth.hasToken, "Firebase token unavailable for admin auth");

    const seeded = await createTrackedLoad(request, auth.idToken);

    await loginAsUser(page);
    await page.getByTestId("nav-loads").click();

    await expect(page.getByTestId("team2-load-board-shell")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(seeded.loadNumber)).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId("team2-load-board-create-load").click();
    await expect(page.getByText("Setup New Load")).toBeVisible({
      timeout: 10_000,
    });
  });
});
