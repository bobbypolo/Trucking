import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import { makeAdminRequest } from "./fixtures/auth.fixture";
import { API_BASE, APP_BASE } from "./fixtures/urls";
const SERVER_RUNNING = !!process.env.E2E_SERVER_RUNNING;
const UI_EMAIL =
  process.env.E2E_TEST_EMAIL ||
  process.env.E2E_ADMIN_EMAIL ||
  "admin@loadpilot.com";
const UI_PASSWORD =
  process.env.E2E_TEST_PASSWORD || process.env.E2E_ADMIN_PASSWORD || "Admin123";

async function loginAsUser(page: Page) {
  await page.goto(APP_BASE);
  await page.locator('input[type="email"]').first().fill(UI_EMAIL);
  await page.locator('input[type="password"]').first().fill(UI_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await expect(
    page.getByRole("button", { name: /Sign Out/i }).first(),
  ).toBeVisible({
    timeout: 30_000,
  });
}

async function createTrackedLoad(request: APIRequestContext, idToken: string) {
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
  test("API create persists a load in the backend list", async ({
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(!auth.hasToken, "SKIP:NO_TOKEN:admin");

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

  test.skip(!SERVER_RUNNING, "SKIP:NO_UI_SERVER");

  test("browser Create Load opens the setup modal and the board shows backend data", async ({
    page,
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(!auth.hasToken, "SKIP:NO_TOKEN:admin");

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

  test("setup modal shows required form elements and validates before submit", async ({
    page,
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(!auth.hasToken, "SKIP:NO_TOKEN:admin");

    await loginAsUser(page);
    await page.getByTestId("nav-loads").click();
    await expect(page.getByTestId("team2-load-board-shell")).toBeVisible({
      timeout: 20_000,
    });

    // Open the Create Load modal
    await page.getByTestId("team2-load-board-create-load").click();
    await expect(page.getByText("Setup New Load")).toBeVisible({
      timeout: 10_000,
    });

    // Verify modal form elements are present
    await expect(page.getByText("Select Broker / Customer *")).toBeVisible();
    await expect(page.locator("#lsmAssignDriver")).toBeVisible();

    // Verify the Phone Order button exists
    const phoneOrderBtn = page.getByRole("button", { name: /Phone Order/i });
    await expect(phoneOrderBtn).toBeVisible();

    // Verify the Scan Doc button exists (disabled until broker+driver selected)
    const scanDocBtn = page.getByRole("button", { name: /Scan Doc/i });
    await expect(scanDocBtn).toBeVisible();
    await expect(scanDocBtn).toBeDisabled();

    // Click Phone Order to reveal the call notes field
    await phoneOrderBtn.click();
    await expect(page.locator("#lsmInitialCallNotes")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Create Order/i }),
    ).toBeVisible();

    // Attempting to submit without broker/driver shows validation errors
    // NOTE: The Create Order button is not disabled, so clicking it triggers validation
    await page.getByRole("button", { name: /Create Order/i }).click();
    await expect(page.getByText("Broker is required")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText("Driver is required")).toBeVisible({
      timeout: 5_000,
    });

    // Close modal via the close button
    await page.getByRole("button", { name: /Close modal/i }).click();
    await expect(page.getByText("Setup New Load")).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("full round-trip: API-created load appears on Load Board and Schedule calendar", async ({
    page,
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(!auth.hasToken, "SKIP:NO_TOKEN:admin");

    // Create a uniquely identifiable load via API
    const uniqueTag = Date.now().toString(36).toUpperCase();
    const loadId = uuidv4();
    const loadNumber = `T2-E2E-${uniqueTag}`;
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const res = await request.post(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${auth.idToken}` },
      data: {
        id: loadId,
        load_number: loadNumber,
        status: "planned",
        carrier_rate: 5500,
        driver_pay: 3200,
        freight_type: "dry_van",
        commodity: `E2E Round Trip Freight ${uniqueTag}`,
        pickup_date: today,
        legs: [
          {
            id: uuidv4(),
            type: "Pickup",
            facility_name: "E2E Origin Warehouse",
            city: "Dallas",
            state: "TX",
            date: today,
            appointment_time: "09:00",
            completed: false,
            sequence_order: 0,
          },
          {
            id: uuidv4(),
            type: "Dropoff",
            facility_name: "E2E Destination Hub",
            city: "Memphis",
            state: "TN",
            date: tomorrow,
            appointment_time: "14:00",
            completed: false,
            sequence_order: 1,
          },
        ],
      },
    });
    expect([200, 201]).toContain(res.status());

    // --- Step 1: Verify API persistence ---
    const listRes = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${auth.idToken}` },
    });
    expect(listRes.status()).toBe(200);
    const allLoads = await listRes.json();
    expect(
      allLoads.some(
        (row: Record<string, unknown>) =>
          row.id === loadId || row.load_number === loadNumber,
      ),
    ).toBe(true);

    // --- Step 2: Login and verify load appears on Load Board ---
    await loginAsUser(page);
    await page.getByTestId("nav-loads").click();
    await expect(page.getByTestId("team2-load-board-shell")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(loadNumber)).toBeVisible({
      timeout: 20_000,
    });

    // Verify key data columns are visible in the board row
    // The board shows origin/destination city, so look for Dallas and Memphis
    await expect(page.getByText("Dallas").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Memphis").first()).toBeVisible({
      timeout: 10_000,
    });

    // --- Step 3: Navigate to Schedule/Calendar and verify load appears ---
    await page.getByTestId("nav-calendar").click();
    await expect(page.getByTestId("team2-schedule-shell")).toBeVisible({
      timeout: 20_000,
    });

    // The calendar view renders load numbers as "#{loadNumber}"
    // Wait for the calendar to load and display the seeded load
    await expect(page.getByText(loadNumber).first()).toBeVisible({
      timeout: 20_000,
    });

    // --- Step 4: Navigate back to Load Board to confirm consistent state ---
    await page.getByTestId("nav-loads").click();
    await expect(page.getByTestId("team2-load-board-shell")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(loadNumber)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("load created via API can be opened for editing from the board", async ({
    page,
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(!auth.hasToken, "SKIP:NO_TOKEN:admin");

    const seeded = await createTrackedLoad(request, auth.idToken);

    await loginAsUser(page);
    await page.getByTestId("nav-loads").click();
    await expect(page.getByTestId("team2-load-board-shell")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(seeded.loadNumber)).toBeVisible({
      timeout: 20_000,
    });

    // Click the load row to open the detail/edit view
    // The board table has a view button (Maximize2 icon) per row
    const loadRow = page.getByText(seeded.loadNumber).first();
    await loadRow.click();

    // After clicking, the EditLoadForm or LoadDetailView should open
    // The EditLoadForm shows "Initialize Dispatch" for new loads or "Save Changes" for existing
    // The LoadDetailView shows load details
    // Wait for either the edit form or detail view to be visible
    const editFormOrDetail = page
      .getByText(/Save Changes|Initialize Dispatch|Load Detail/i)
      .first();
    await expect(editFormOrDetail).toBeVisible({ timeout: 15_000 });

    // Verify the commodity from the seeded load is displayed
    await expect(
      page.getByText("Team 2 dispatch validation freight").first(),
    ).toBeVisible({ timeout: 10_000 });

    // Verify pickup/dropoff cities are shown
    await expect(page.getByText("Chicago").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Detroit").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
