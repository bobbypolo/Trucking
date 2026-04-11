/**
 * R-P6-03: Driver intake flow spec
 *
 * Driver context: taps Submit Load Intake tile (DriverMobileHome),
 * uploads bol-sample.png through the Scanner, fills review fields,
 * submits via POST /api/loads/driver-intake.
 * Asserts load appears with status='Draft' and intake_source='driver'.
 *
 * Dispatcher context: navigates to Pending Driver Intake tab
 * (LoadBoardEnhanced tab-pending-intake), sees the load row,
 * clicks Approve, picks equipment, confirms.
 * Asserts load transitions to status='Planned' with equipment_id persisted.
 *
 * Auth pattern from team02-driver-intake.spec.ts.
 */
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { test, expect } from "@playwright/test";
import { makeAdminRequest, makeDriverRequest } from "../fixtures/auth.fixture";
import { API_BASE, APP_BASE } from "../fixtures/urls";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.join(__dirname, "..", "fixtures");

const DRIVER_EMAIL = process.env.E2E_DRIVER_EMAIL ?? "driver1@loadpilot.com";
const DRIVER_PASSWORD = process.env.E2E_DRIVER_PASSWORD ?? "User123";
const DISPATCHER_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@loadpilot.com";
const DISPATCHER_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Admin123";

// Tests R-P6-03
test.describe("Pre-Demo Remediation — Driver Intake Flow (R-P6-03)", () => {
  test("driver submits BOL intake; dispatcher approves from Pending Driver Intake queue", async ({
    browser,
    request,
  }) => {
    const adminAuth = await makeAdminRequest();
    const driverAuth = await makeDriverRequest();
    test.skip(
      !adminAuth.hasToken || !driverAuth.hasToken,
      "SKIP:NO_TOKEN — Firebase credentials unavailable for driver/admin",
    );

    // ── Driver context: submit load intake ──────────────────────────────
    const driverCtx = await browser.newContext();
    const driverPage = await driverCtx.newPage();

    await driverPage.goto(APP_BASE);
    await driverPage.locator('input[type="email"]').first().fill(DRIVER_EMAIL);
    await driverPage
      .locator('input[type="password"]')
      .first()
      .fill(DRIVER_PASSWORD);
    await driverPage.locator('button[type="submit"]').first().click();
    // Driver sees driver-nav-loads after login
    await expect(driverPage.getByTestId("driver-nav-loads")).toBeVisible({
      timeout: 30_000,
    });

    // Tap the Submit Load Intake tile (R-P5-16)
    await driverPage.getByTestId("submit-load-intake-tile").click();

    // Scanner appears — upload BOL fixture
    const fileInput = driverPage.getByTestId("scanner-upload-file");
    await expect(fileInput).toBeAttached({ timeout: 10_000 });
    await fileInput.setInputFiles(path.join(FIXTURE_DIR, "bol-sample.png"));

    // Fill review form fields (intake-review-form)
    await expect(driverPage.getByTestId("intake-review-form")).toBeVisible({
      timeout: 10_000,
    });

    const pickupCity = `E2E-PICKUP-${Date.now().toString(36).toUpperCase()}`;
    await driverPage.getByTestId("intake-pickup-city").fill(pickupCity);
    await driverPage.getByTestId("intake-pickup-state").fill("TX");
    await driverPage.getByTestId("intake-dropoff-city").fill("Memphis");
    await driverPage.getByTestId("intake-dropoff-state").fill("TN");
    await driverPage
      .getByTestId("intake-pickup-date")
      .fill(new Date().toISOString().split("T")[0]);
    await driverPage
      .getByTestId("intake-commodity")
      .fill("E2E BOL intake freight");
    await driverPage
      .getByTestId("intake-reference")
      .fill(`BOL-E2E-${Date.now()}`);
    await driverPage.getByTestId("intake-weight").fill("38000");

    // Submit
    await driverPage.getByTestId("intake-submit").click();
    await expect(driverPage.getByText(/Intake submitted/i)).toBeVisible({
      timeout: 15_000,
    });

    // Verify via API: load exists with status=Draft, intake_source=driver (R-P6-03 part 1)
    const loadsRes = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${adminAuth.idToken}` },
    });
    expect(loadsRes.status()).toBe(200);
    const loads = (await loadsRes.json()) as Array<Record<string, unknown>>;
    const draftLoad = loads.find(
      (l) =>
        String(l.status).toLowerCase() === "draft" &&
        l.intake_source === "driver",
    );
    expect(draftLoad).toBeDefined();
    const draftLoadId = String(draftLoad!.id);

    await driverCtx.close();

    // ── Dispatcher context: approve from Pending Driver Intake ──────────
    const dispatcherCtx = await browser.newContext();
    const dispatcherPage = await dispatcherCtx.newPage();

    await dispatcherPage.goto(APP_BASE);
    await dispatcherPage
      .locator('input[type="email"]')
      .first()
      .fill(DISPATCHER_EMAIL);
    await dispatcherPage
      .locator('input[type="password"]')
      .first()
      .fill(DISPATCHER_PASSWORD);
    await dispatcherPage.locator('button[type="submit"]').first().click();
    await expect(
      dispatcherPage.getByRole("button", { name: /Sign Out/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Navigate to Load Board
    await dispatcherPage.getByTestId("nav-loads").click();
    await expect(
      dispatcherPage.getByTestId("team2-load-board-shell"),
    ).toBeVisible({ timeout: 20_000 });

    // Switch to Pending Driver Intake tab (R-P5-17)
    await dispatcherPage.getByTestId("tab-pending-intake").click();

    // The driver-submitted load row should appear (R-P6-03 part 2)
    const intakeRow = dispatcherPage.getByTestId(`intake-row-${draftLoadId}`);
    await expect(intakeRow).toBeVisible({ timeout: 10_000 });

    // Click Approve on the row
    await dispatcherPage.getByTestId(`approve-btn-${draftLoadId}`).click();

    // Approval modal: select equipment then confirm
    const equipmentSelect = dispatcherPage.getByTestId("equipment-select");
    await expect(equipmentSelect).toBeVisible({ timeout: 5_000 });
    await equipmentSelect.selectOption({ index: 1 });

    await dispatcherPage.getByTestId("approve-confirm-btn").click();

    // Row disappears from queue (approved)
    await expect(intakeRow).not.toBeVisible({ timeout: 10_000 });

    // Verify via API: load transitioned to Planned with equipment_id (R-P6-03 part 3)
    const verifyRes = await request.get(
      `${API_BASE}/api/loads/${draftLoadId}`,
      { headers: { Authorization: `Bearer ${adminAuth.idToken}` } },
    );
    expect(verifyRes.status()).toBe(200);
    const approvedLoad = (await verifyRes.json()) as Record<string, unknown>;
    expect(String(approvedLoad.status).toLowerCase()).toBe("planned");
    expect(approvedLoad.equipment_id).toBeTruthy();

    await dispatcherCtx.close();
  });
});
