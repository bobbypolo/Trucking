import path from "path";
import { fileURLToPath } from "url";
import { test, expect } from "@playwright/test";
import { APP_BASE } from "../fixtures/urls";
import {
  loginAsSalesDemoAdmin,
  loginAsSalesDemoDriver,
  requireSalesDemoGuards,
} from "./helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RATE_CON_PDF = path.join(
  __dirname,
  "..",
  "..",
  "server",
  "scripts",
  "sales-demo-fixtures",
  "rate-con.pdf",
);

test.describe("Sales Demo — Live driver intake walkthrough", () => {
  test.skip(
    !requireSalesDemoGuards(),
    "sales-demo live intake requires SALES_DEMO_E2E=1 and E2E_SERVER_RUNNING=1",
  );

  test("driver upload -> Gemini extraction -> review -> submit -> dispatcher queue", async ({
    page,
    browser,
  }) => {
    const baselineAdminContext = await browser.newContext();
    const baselineAdminPage = await baselineAdminContext.newPage();
    let pendingIntakeCountBefore = 0;
    try {
      await loginAsSalesDemoAdmin(baselineAdminPage);
      await baselineAdminPage.goto(`${APP_BASE}/loads`);
      await baselineAdminPage.getByTestId("tab-pending-intake").click();
      await expect(
        baselineAdminPage.getByRole("heading", { name: /Pending Driver Intake/i }),
      ).toBeVisible({
        timeout: 10000,
      });
      pendingIntakeCountBefore = await baselineAdminPage
        .locator("[data-testid^='intake-row-']")
        .count();
    } finally {
      await baselineAdminContext.close();
    }

    await loginAsSalesDemoDriver(page);
    await page.goto(`${APP_BASE}/drive`);

    await page.getByTestId("new-intake-today").click();
    await page.getByTestId("scanner-upload-file").setInputFiles(RATE_CON_PDF);
    await expect(page.getByTestId("intake-done-scanning")).toBeVisible({
      timeout: 20000,
    });
    await page.getByTestId("intake-done-scanning").click();

    await expect(page.getByTestId("intake-review-form")).toBeVisible({
      timeout: 10000,
    });

    const extracted = await page.evaluate(() => {
      const read = (id: string) =>
        (
          document.querySelector(`[data-testid='${id}']`) as
            | HTMLInputElement
            | null
        )?.value ?? "";
      return {
        pickupCity: read("intake-pickup-city"),
        pickupState: read("intake-pickup-state"),
        dropoffCity: read("intake-dropoff-city"),
        dropoffState: read("intake-dropoff-state"),
        pickupDate: read("intake-pickup-date"),
        commodity: read("intake-commodity"),
        reference: read("intake-reference"),
        weight: read("intake-weight"),
      };
    });

    const extractionSignals = [
      extracted.pickupCity.toLowerCase() === "houston",
      extracted.pickupState.toUpperCase() === "TX",
      extracted.dropoffCity.toLowerCase() === "chicago",
      extracted.dropoffState.toUpperCase() === "IL",
      extracted.commodity.toLowerCase().includes("frozen beef"),
      extracted.weight.replace(/[^\d]/g, "") === "42500",
    ].filter(Boolean).length;

    expect(extractionSignals).toBeGreaterThanOrEqual(3);

    if (!extracted.pickupDate) {
      await page.getByTestId("intake-pickup-date").fill("2026-04-09");
    }
    if (!extracted.reference) {
      await page
        .getByTestId("intake-reference")
        .fill(`LIVE-RATECON-${Date.now()}`);
    }

    await page.getByTestId("intake-submit").click();
    await expect(page.getByText(/Intake submitted/i)).toBeVisible({
      timeout: 15000,
    });

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await loginAsSalesDemoAdmin(adminPage);
      await adminPage.goto(`${APP_BASE}/loads`);
      await adminPage.getByTestId("tab-pending-intake").click();

      await expect(
        adminPage.getByRole("heading", { name: /Pending Driver Intake/i }),
      ).toBeVisible({ timeout: 10000 });
      await expect
        .poll(
          async () =>
            adminPage.locator("[data-testid^='intake-row-']").count(),
          {
            timeout: 10000,
          },
        )
        .toBeGreaterThan(pendingIntakeCountBefore);
    } finally {
      await adminContext.close();
    }
  });
});
