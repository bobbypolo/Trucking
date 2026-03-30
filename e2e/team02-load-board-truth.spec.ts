import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import { makeAdminRequest } from "./fixtures/auth.fixture";
import { API_BASE, APP_BASE } from "./fixtures/urls";
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

async function createVisibleLoad(
  request: APIRequestContext,
  idToken: string,
) {
  const loadId = uuidv4();
  const loadNumber = `T2-BOARD-${Date.now().toString(36).toUpperCase()}`;
  const res = await request.post(`${API_BASE}/api/loads`, {
    headers: { Authorization: `Bearer ${idToken}` },
    data: {
      id: loadId,
      load_number: loadNumber,
      status: "planned",
      carrier_rate: 5200,
      driver_pay: 2600,
      freight_type: "dry_van",
      commodity: "Load board visibility validation",
      pickup_date: new Date().toISOString().split("T")[0],
      legs: [
        {
          id: uuidv4(),
          type: "Pickup",
          facility_name: "Board Pickup",
          city: "Atlanta",
          state: "GA",
          date: new Date().toISOString().split("T")[0],
          appointment_time: "09:00",
          completed: false,
          sequence_order: 0,
        },
        {
          id: uuidv4(),
          type: "Dropoff",
          facility_name: "Board Dropoff",
          city: "Charlotte",
          state: "NC",
          date: new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          appointment_time: "15:00",
          completed: false,
          sequence_order: 1,
        },
      ],
    },
  });

  expect([200, 201]).toContain(res.status());
  return { loadId, loadNumber };
}

test.describe("Team 2 - Load Board Truth", () => {
  test("backend list returns the load created for board validation", async ({
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(!auth.hasToken, "SKIP:NO_TOKEN:admin");

    const seeded = await createVisibleLoad(request, auth.idToken);
    const listRes = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${auth.idToken}` },
    });
    expect(listRes.status()).toBe(200);
    const loads = await listRes.json();
    expect(
      loads.some(
        (row: Record<string, unknown>) =>
          row.id === seeded.loadId || row.load_number === seeded.loadNumber,
      ),
    ).toBe(true);
  });

  test.skip(!SERVER_RUNNING, "SKIP:NO_UI_SERVER");

  test("browser load board shows real backend loads and load detail is not placeholder-based", async ({
    page,
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(!auth.hasToken, "SKIP:NO_TOKEN:admin");

    const seeded = await createVisibleLoad(request, auth.idToken);

    await loginAsUser(page);
    await page.getByTestId("nav-loads").click();
    await expect(page.getByTestId("team2-load-board-shell")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(seeded.loadNumber)).toBeVisible({
      timeout: 20_000,
    });

    await page.getByText(seeded.loadNumber).first().click();
    await expect(page.getByTestId("team2-load-detail-view")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("team2-load-detail-view")).not.toContainText(
      "ENTER SALES REP",
    );
    await expect(page.getByTestId("team2-load-detail-view")).not.toContainText(
      "Inject Electronic Records",
    );
    await expect(page.getByTestId("team2-load-detail-view")).not.toContainText(
      "GPS Connection Stable",
    );
    await expect(page.getByTestId("team2-load-detail-view")).not.toContainText(
      "All Records Pass",
    );
  });
});
