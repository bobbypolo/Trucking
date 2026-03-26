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
  await expect(page.getByTestId("nav-loads")).toBeVisible({
    timeout: 30_000,
  });
}

async function createScheduleLoad(
  request: APIRequestContext,
  idToken: string,
) {
  const loadId = uuidv4();
  const loadNumber = `T2-SCH-${Date.now().toString(36).toUpperCase()}`;
  const pickupDate = new Date().toISOString().split("T")[0];
  const dropoffDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const res = await request.post(`${API_BASE}/api/loads`, {
    headers: { Authorization: `Bearer ${idToken}` },
    data: {
      id: loadId,
      load_number: loadNumber,
      status: "planned",
      carrier_rate: 4200,
      driver_pay: 2000,
      freight_type: "dry_van",
      commodity: "Schedule propagation validation",
      pickup_date: pickupDate,
      legs: [
        {
          id: uuidv4(),
          type: "Pickup",
          facility_name: "Schedule Pickup",
          city: "Memphis",
          state: "TN",
          date: pickupDate,
          appointment_time: "07:00",
          completed: false,
          sequence_order: 0,
        },
        {
          id: uuidv4(),
          type: "Dropoff",
          facility_name: "Schedule Dropoff",
          city: "Nashville",
          state: "TN",
          date: dropoffDate,
          appointment_time: "17:00",
          completed: false,
          sequence_order: 1,
        },
      ],
    },
  });

  expect([200, 201]).toContain(res.status());
  return { loadId, loadNumber, pickupDate, dropoffDate };
}

test.describe("Team 2 - Schedule Propagation", () => {
  test("backend schedule endpoint returns the newly created load", async ({
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(!auth.hasToken, "Firebase token unavailable for admin auth");

    const seeded = await createScheduleLoad(request, auth.idToken);
    const scheduleRes = await request.get(`${API_BASE}/api/loads?for=schedule`, {
      headers: { Authorization: `Bearer ${auth.idToken}` },
    });
    expect(scheduleRes.status()).toBe(200);
    const loads = await scheduleRes.json();
    expect(Array.isArray(loads)).toBe(true);
    const found = loads.find(
      (row: Record<string, unknown>) =>
        row.id === seeded.loadId || row.load_number === seeded.loadNumber,
    ) as Record<string, unknown> | undefined;
    expect(found).toBeDefined();
    expect(found?.pickup_date || found?.pickupDate).toBeTruthy();
  });

  test.skip(!SERVER_RUNNING, "Requires E2E_SERVER_RUNNING=1");

  test("browser schedule view shows the created load", async ({
    page,
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(!auth.hasToken, "Firebase token unavailable for admin auth");

    const seeded = await createScheduleLoad(request, auth.idToken);

    await loginAsUser(page);
    await page.getByTestId("nav-calendar").click();
    await expect(page.getByTestId("team2-schedule-shell")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(seeded.loadNumber).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
