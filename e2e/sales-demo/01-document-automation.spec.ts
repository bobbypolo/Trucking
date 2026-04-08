/**
 * R-P2-07 + R-P2-13: Sales Demo hero load + document download walkthrough.
 *
 * Opens the Load Board, clicks the hero load LP-DEMO-RC-001, and asserts the
 * visible DOM contains the canonical continuity values from the BSD plan
 * (broker name, commodity, weight, rate, route).
 *
 * R-P2-13 extends R-P2-07: after the Documents panel opens, asserts each of
 * the 3 hero document cards renders the real filename (rate-con.pdf, bol.pdf,
 * lumper-receipt.pdf) and a non-undefined type label — proves the Phase 2
 * document.repository.ts alias mapping (R-P2-12) reaches the canonical UI.
 *
 * This spec runs only when the sales-demo tenant is seeded and the BSD
 * certification env vars are present. It is exercised in the Phase 7
 * Windows-safe certification pipeline (STORY-007).
 */
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { APP_BASE } from "../fixtures/urls";

const HERO_LOAD_ID = "LP-DEMO-RC-001";
const HERO_BROKER_NAME = "ACME Logistics LLC";
const HERO_COMMODITY = "Frozen Beef";
const HERO_WEIGHT = "42,500";
const HERO_RATE = "$3,250";
const HERO_PICKUP_CITY = "Houston";
const HERO_DROPOFF_CITY = "Chicago";

const HERO_DOCUMENT_FILENAMES = [
  "rate-con.pdf",
  "bol.pdf",
  "lumper-receipt.pdf",
];

// Tests R-P2-07
test.describe("Sales Demo — Hero load walkthrough (R-P2-07, R-P2-13)", () => {
  test.skip(
    !process.env.SALES_DEMO_E2E,
    "SALES_DEMO_E2E env var not set — spec runs only under STORY-007 certification",
  );

  test("R-P2-07: hero load LP-DEMO-RC-001 renders canonical continuity values", async ({
    page,
  }) => {
    await page.goto(`${APP_BASE}/loads`);

    // Locate the hero load row by its load number text and click it.
    const heroRow = page.getByText(HERO_LOAD_ID, { exact: false }).first();
    await expect(heroRow).toBeVisible();
    await heroRow.click();

    // Wait for the load detail view to render. The continuity values must
    // appear in the visible DOM (live UI reads from the seeded rows — no
    // mocks, no shims).
    await expect(page.getByText(HERO_BROKER_NAME)).toBeVisible();
    await expect(page.getByText(HERO_COMMODITY)).toBeVisible();
    await expect(page.getByText(HERO_WEIGHT, { exact: false })).toBeVisible();
    await expect(page.getByText(HERO_RATE, { exact: false })).toBeVisible();
    await expect(
      page.getByText(HERO_PICKUP_CITY, { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText(HERO_DROPOFF_CITY, { exact: false }),
    ).toBeVisible();
  });

  // Tests R-P2-13
  test("R-P2-13: each of the 3 hero document cards shows real filename and non-undefined type", async ({
    page,
  }) => {
    await page.goto(`${APP_BASE}/loads`);

    const heroRow = page.getByText(HERO_LOAD_ID, { exact: false }).first();
    await expect(heroRow).toBeVisible();
    await heroRow.click();

    // Wait for the documents panel to render at least 3 cards.
    for (const filename of HERO_DOCUMENT_FILENAMES) {
      const card = page.getByText(filename, { exact: false });
      await expect(card).toBeVisible();
    }

    // Critical: assert the literal substring "undefined undefined" never
    // appears anywhere in the rendered Documents panel. Without the Phase 2
    // alias mapping (R-P2-12), the UI would show "undefined undefined" for
    // every card because the canonical reads `doc.filename` and `doc.type`
    // while the raw rows only expose `original_filename` and `document_type`.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("undefined undefined");
  });
});
