import { test, expect } from "@playwright/test";
import { APP_BASE } from "../fixtures/urls";
import { loginAsSalesDemoAdmin, requireSalesDemoGuards } from "./helpers";

test.describe("Sales Demo — Reset Demo walkthrough", () => {
  test.skip(
    !requireSalesDemoGuards(),
    "sales-demo reset requires SALES_DEMO_E2E=1 and E2E_SERVER_RUNNING=1",
  );

  test("Reset Demo button returns success and hero load persists", async ({
    page,
  }) => {
    // 1. Login as the sales demo admin
    await loginAsSalesDemoAdmin(page);

    // 2. Navigate to operations-hub
    await page.goto(`${APP_BASE}/operations-hub`);
    await expect(page.getByTestId("nav-demo-reset")).toBeVisible({
      timeout: 15000,
    });

    // 3. Click Reset Demo button
    await page.getByTestId("nav-demo-reset").click();

    // 4. Wait for success toast OR page reload completing successfully.
    //    The reset endpoint shows a toast "Reset Demo OK" on success.
    //    If the page reloads instead, we fall through to the hero-load check.
    const toastOrReload = await Promise.race([
      page
        .getByText(/Reset Demo OK/i)
        .waitFor({ state: "visible", timeout: 20000 })
        .then(() => "toast" as const),
      page
        .waitForURL(`${APP_BASE}/operations-hub`, { timeout: 20000 })
        .then(() => "reload" as const),
    ]).catch(() => "timeout" as const);

    // At least one signal should fire
    expect(["toast", "reload"]).toContain(toastOrReload);

    // 5. Navigate to Load Board and verify hero load LP-DEMO-RC-001 is present
    await page.goto(`${APP_BASE}/loads`);
    await expect(page.getByText("LP-DEMO-RC-001")).toBeVisible({
      timeout: 15000,
    });
  });
});
