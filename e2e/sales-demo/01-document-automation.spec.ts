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
import {
  loginAsSalesDemoAdmin,
  requireSalesDemoGuards,
} from "./helpers";

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
    !requireSalesDemoGuards(),
    "sales-demo document walkthrough requires SALES_DEMO_E2E=1 and E2E_SERVER_RUNNING=1",
  );

  test("R-P2-07: hero load LP-DEMO-RC-001 renders canonical continuity values", async ({
    page,
  }) => {
    await loginAsSalesDemoAdmin(page);
    await page.goto(`${APP_BASE}/loads`);

    // Drive the explicit row-view control instead of relying on row/button
    // ordering inside the SQL-style table.
    await page.getByTestId("load-board-detail-table-toggle").click();
    const heroOpenButton = page.getByTestId(`load-board-open-${HERO_LOAD_ID}`);
    await expect(heroOpenButton).toBeVisible();
    await heroOpenButton.click();
    await expect(page.getByTestId("team2-load-detail-view")).toBeVisible();
    await expect(page.getByText(/Manifest Workspace:/i)).toBeVisible();

    // Wait for the load detail view to render. The continuity values must
    // appear in the visible DOM (live UI reads from the seeded rows — no
    // mocks, no shims).
    await expect(page.getByText(HERO_BROKER_NAME).first()).toBeVisible();
    await expect(page.getByText(HERO_COMMODITY).first()).toBeVisible();
    await expect(
      page.getByText(HERO_WEIGHT, { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByText(HERO_RATE, { exact: false }).first()).toBeVisible();
    await expect(
      page.getByText(/Houston,\s*TX/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Chicago,\s*IL/i).first(),
    ).toBeVisible();
  });

  // Tests R-P2-13
  test("R-P2-13: each of the 3 hero document cards shows real filename and non-undefined type", async ({
    page,
  }) => {
    await loginAsSalesDemoAdmin(page);
    await page.goto(`${APP_BASE}/loads`);

    await page.getByTestId("load-board-detail-table-toggle").click();
    const heroOpenButton = page.getByTestId(`load-board-open-${HERO_LOAD_ID}`);
    await expect(heroOpenButton).toBeVisible();
    await heroOpenButton.click();
    await expect(page.getByTestId("team2-load-detail-view")).toBeVisible();
    await expect(page.getByText(/Digital Artifacts Matrix/i)).toBeVisible();

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
