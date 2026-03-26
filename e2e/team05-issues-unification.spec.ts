import { test, expect } from "@playwright/test";
import { loginAsTeam05Admin } from "./team05-test-helpers";

test.describe("Team 5 - Issues unification", () => {
  test("issues and alerts remain the only top-level issue workflow", async ({
    page,
  }) => {
    await loginAsTeam05Admin(page);

    const issuesNav = page
      .getByRole("navigation")
      .getByRole("button", { name: "Issues & Alerts", exact: true })
      .first();
    await expect(issuesNav).toBeVisible();
    await issuesNav.click();
    await page.waitForLoadState("networkidle");

    const issuesConsole = page.getByTestId("issues-console");
    await expect(issuesConsole).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Issues & Alerts", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Safety & Compliance", exact: true })).toHaveCount(0);
  });
});
