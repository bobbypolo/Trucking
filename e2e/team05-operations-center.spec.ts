import { test, expect } from "@playwright/test";
import { loginAsTeam05Admin } from "./team05-test-helpers";

test.describe("Team 5 - Operations Center", () => {
  test("renders the consolidated operations dashboard as the main shell", async ({
    page,
  }) => {
    await loginAsTeam05Admin(page);

    const operationsNav = page
      .getByRole("navigation")
      .getByRole("button", { name: "Operations Center", exact: true })
      .first();
    await operationsNav.click();

    const operationsDashboard = page.getByTestId("operations-dashboard");
    await expect(operationsDashboard).toBeVisible();
    await expect(operationsDashboard.getByText("Operations Dashboard")).toBeVisible();
    await expect(page.getByTestId("ops-kpi-active-loads")).toBeVisible();
    await expect(page.getByTestId("ops-kpi-open-exceptions")).toBeVisible();
  });
});
