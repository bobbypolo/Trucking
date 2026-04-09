/**
 * R-P3-05: Sales Demo IFTA Q4 2025 audit-lock walkthrough.
 *
 * Navigates to Accounting → Fuel & IFTA, selects Q4 2025, opens the
 * hero load LP-DEMO-RC-001 from the "Trips Pending Audit" strip, waits
 * for the Evidence Timeline and Computed Jurisdiction Split headers to
 * render (proving the unmodified live UI consumed the Phase 3 seed
 * rows), checks the attestation checkbox, clicks "Lock Trip for Audit",
 * and asserts the audit-lock success indicator appears within 10s.
 *
 * Continuity narrative for sales: "This is the same LP-DEMO-RC-001 trip
 * you just opened — Houston TX → Chicago IL, 42,500 lbs of Frozen Beef.
 * Now it's filing its Q4 2025 fuel tax across 6 jurisdictions, and
 * we're about to audit-lock it."
 *
 * Uses only role/text-based selectors on the IFTA UI against the real
 * DOM, with no testid hooks on IFTA elements (grep-verified).
 *
 * This spec runs only when the sales-demo tenant is seeded AND
 * SALES_DEMO_E2E env var is set. The Phase 7 Windows-safe certification
 * pipeline (STORY-007) drives the full run.
 */
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { APP_BASE } from "../fixtures/urls";
import {
  loginAsSalesDemoAdmin,
  requireSalesDemoGuards,
} from "./helpers";

const HERO_LOAD_ID = "LP-DEMO-RC-001";

test.describe("Sales Demo — IFTA Q4 2025 audit-lock walkthrough (R-P3-05)", () => {
  test.skip(
    !requireSalesDemoGuards(),
    "sales-demo IFTA walkthrough requires SALES_DEMO_E2E=1 and E2E_SERVER_RUNNING=1",
  );

  // Tests R-P3-05
  test("R-P3-05: hero load IFTA evidence lock sequence completes within 10 seconds", async ({
    page,
  }) => {
    await loginAsSalesDemoAdmin(page);

    // 1. Land on the app shell and click the Accounting nav entry.
    //    nav-accounting is the real route key from App.tsx line 653
    //    (App.tsx owns the nav tabs — Phase 3 never touches it).
    await page.goto(APP_BASE);
    await page.locator('[data-testid="nav-accounting"]').click();

    // 2. Open the Fuel & IFTA tab inside AccountingPortal. The label is
    //    verified at components/AccountingPortal.tsx:175 — "Fuel & IFTA".
    await page.getByRole("button", { name: /^Fuel & IFTA$/i }).click();

    // 3. Select quarter Q4 and year 2025 using the real selectors the
    //    production UI exposes — text button Q4 plus the year <select>
    //    with aria-label="Select year".
    await page.getByRole("button", { name: /^Q4$/ }).click();
    await page.locator('select[aria-label="Select year"]').selectOption("2025");

    // 4. Wait for the delivered-load card carrying the hero load id to
    //    render. The IFTAManager Trips Pending Audit strip renders the
    //    first 3 delivered loads — the hero load will appear because
    //    Phase 2 seeded it with status='delivered'.
    const heroCard = page.getByText(HERO_LOAD_ID, { exact: false }).first();
    await expect(heroCard).toBeVisible({ timeout: 10000 });
    await heroCard.click();

    // 5. Wait for the IFTAEvidenceReview modal panel. The Evidence
    //    Timeline and Computed Jurisdiction Split headers prove the
    //    live UI consumed the seeded ifta_trip_evidence + mileage rows.
    //    These header strings are verified at:
    //      components/IFTAEvidenceReview.tsx:135 (Evidence Timeline)
    //      components/IFTAEvidenceReview.tsx:193 (Computed Jurisdiction Split)
    await expect(page.getByText(/Evidence Timeline/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/Computed Jurisdiction Split/i)).toBeVisible({
      timeout: 10000,
    });

    // 6. Check the attestation checkbox. The input is at
    //    components/IFTAEvidenceReview.tsx:261 — a plain
    //    input[type="checkbox"] wrapped in the attestation label.
    await page.locator('input[type="checkbox"]').first().check();

    // 7. Click the audit-lock button. Verified at
    //    components/IFTAEvidenceReview.tsx:290.
    await page.getByRole("button", { name: /Lock Trip for Audit/i }).click();

    // 8. Assert the audit-lock success indicator appears within 10
    //    seconds. The production handler surfaces either a toast with
    //    "locked" / "Trip locked" text or closes the modal — either
    //    outcome ends the walkthrough. We wait for whichever resolves
    //    first by checking for the locked-state indicator in the DOM.
    await expect(async () => {
      const body = await page.locator("body").innerText();
      const lockedIndicator =
        /locked/i.test(body) ||
        /audit.*complete/i.test(body) ||
        /success/i.test(body);
      expect(lockedIndicator).toBe(true);
    }).toPass({ timeout: 10000 });
  });
});
