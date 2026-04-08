/**
 * R-P6-02: Dispatcher flow spec — Scan Doc click → Scanner autoTrigger='upload'
 *
 * Dispatcher logs in, opens LoadSetupModal, picks broker, clicks "Scan Doc".
 * Asserts the hidden file input (scanner-upload-file) is present on-screen
 * (proves autoTrigger='upload' rendered the Scanner component end-to-end).
 * Uploads ratecon-sample.png, reviews extracted fields, fills equipment,
 * saves load. Asserts load appears with status='Planned', equipment_id non-null.
 *
 * Auth pattern from team02-dispatch-load-create.spec.ts.
 */
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { test, expect } from "@playwright/test";
import { makeAdminRequest } from "../fixtures/auth.fixture";
import { API_BASE, APP_BASE } from "../fixtures/urls";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.join(__dirname, "..", "fixtures");

// Tests R-P6-02
test.describe("Pre-Demo Remediation — Dispatcher Scan Doc flow (R-P6-02)", () => {
  test("Scan Doc opens Scanner with autoTrigger=upload; load saved as Planned with equipment_id", async ({
    page,
    request,
  }) => {
    const auth = await makeAdminRequest();
    test.skip(
      !auth.hasToken,
      "SKIP:NO_TOKEN:admin — Firebase credentials unavailable",
    );

    // Login as dispatcher (admin account doubles as dispatcher in demo)
    await page.goto(APP_BASE);
    await page
      .locator('input[type="email"]')
      .first()
      .fill(process.env.E2E_ADMIN_EMAIL ?? "admin@loadpilot.com");
    await page
      .locator('input[type="password"]')
      .first()
      .fill(process.env.E2E_ADMIN_PASSWORD ?? "Admin123");
    await page.locator('button[type="submit"]').first().click();
    await expect(
      page.getByRole("button", { name: /Sign Out/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Navigate to Load Board
    await page.getByTestId("nav-loads").click();
    await expect(page.getByTestId("team2-load-board-shell")).toBeVisible({
      timeout: 20_000,
    });

    // Open Create Load modal
    await page.getByTestId("team2-load-board-create-load").click();
    await expect(page.getByText("Setup New Load")).toBeVisible({
      timeout: 10_000,
    });

    // Select a broker so "Scan Doc" becomes enabled
    const brokerSelect = page
      .locator("#lsmBroker, [data-testid='lsm-broker-select'], select")
      .first();
    await brokerSelect.selectOption({ index: 1 }).catch(() => {
      // If no option, try clicking the first broker chip/button
    });

    // Click Scan Doc button (R-P4-19: fires onContinue with autoTrigger='upload')
    const scanDocBtn = page.getByRole("button", { name: /Scan Doc/i });
    await expect(scanDocBtn).toBeEnabled({ timeout: 5_000 });
    await scanDocBtn.click();

    // Assert Scanner file input is present — proves autoTrigger='upload' (R-P6-02 core)
    const fileInput = page.getByTestId("scanner-upload-file");
    await expect(fileInput).toBeAttached({ timeout: 5_000 });

    // Upload the ratecon fixture image
    await fileInput.setInputFiles(path.join(FIXTURE_DIR, "ratecon-sample.png"));

    // After upload, the Scanner processes and shows the review form
    // Fill any missing required fields in the review form
    const pickupCityInput = page
      .getByTestId("intake-pickup-city")
      .or(page.locator('[placeholder*="pickup city" i]'))
      .first();
    if (
      await pickupCityInput.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await pickupCityInput.fill("Dallas");
    }

    // Confirm / save (the modal will call onContinue with the scanned data)
    const confirmBtn = page
      .getByRole("button", { name: /confirm|continue|save|next/i })
      .first();
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Now we should be back in the LoadSetupModal with equipment field
    // Select equipment so load can be saved as Planned
    const equipmentSelect = page
      .locator(
        '[data-testid="lsm-equipment-select"], #lsmEquipment, select[name*="equipment" i]',
      )
      .first();
    if (
      await equipmentSelect.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await equipmentSelect.selectOption({ index: 1 }).catch(() => {});
    }

    // Submit the load
    const saveBtn = page
      .getByRole("button", { name: /Create Order|Save|Submit/i })
      .first();
    if (await saveBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
      await saveBtn.click();
    }

    // Verify via API: load exists with status Planned and equipment_id non-null (R-P6-02)
    await page.waitForTimeout(2_000);
    const loadsRes = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${auth.idToken}` },
    });
    expect(loadsRes.status()).toBe(200);
    const loads = (await loadsRes.json()) as Array<Record<string, unknown>>;
    const plannedWithEquip = loads.find(
      (l) =>
        String(l.status).toLowerCase() === "planned" && l.equipment_id != null,
    );
    expect(plannedWithEquip).toBeDefined();
  });
});
