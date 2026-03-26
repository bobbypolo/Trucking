import { test, expect } from "@playwright/test";
import { loginAsTeam05Admin } from "./team05-test-helpers";

test.describe("Team 5 - Company settings", () => {
  test("admin settings tabs render and switch content", async ({ page }) => {
    await loginAsTeam05Admin(page);

    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Company Settings", exact: true })
      .click();

    const settingsShell = page.getByTestId("company-settings-shell");
    await expect(settingsShell).toBeVisible();
    await expect(
      settingsShell.getByRole("button", { name: "Identity", exact: true }),
    ).toBeVisible();
    await expect(
      settingsShell.getByRole("button", { name: "Operations", exact: true }),
    ).toBeVisible();
    await expect(
      settingsShell.getByRole("button", { name: "Personnel", exact: true }),
    ).toBeVisible();
    await expect(
      settingsShell.getByRole("button", { name: "Security", exact: true }),
    ).toBeVisible();
    await expect(
      settingsShell.getByRole("button", { name: "Governance", exact: true }),
    ).toBeVisible();

    await settingsShell
      .getByRole("button", { name: "Operations", exact: true })
      .click();
    await expect(settingsShell.getByText("Fleet Configuration")).toBeVisible();
    await expect(
      settingsShell.getByText("Authorized Freight Types"),
    ).toBeVisible();
    await expect(settingsShell.getByText("Company Structure")).toBeVisible();
    await expect(
      settingsShell.getByText("System Operating Mode (Owner Switch)"),
    ).toBeVisible();

    await settingsShell
      .getByRole("button", { name: "Identity", exact: true })
      .click();
    const phoneField = settingsShell.locator("#cpPhone");
    const originalPhone = await phoneField.inputValue();
    const testPhone = `${originalPhone || "555-0105"}-T5`;
    await phoneField.fill(testPhone);
    await expect(settingsShell.getByText("Unsaved changes")).toBeVisible();

    const saveButton = settingsShell.getByRole("button", {
      name: "Save Changes",
      exact: true,
    });
    await saveButton.click();
    await expect(settingsShell.getByText("Unsaved changes")).toHaveCount(0);

    await page.reload();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Company Settings", exact: true })
      .click();
    const reloadedShell = page.getByTestId("company-settings-shell");
    await expect(reloadedShell.locator("#cpPhone")).toHaveValue(testPhone);

    await settingsShell
      .getByRole("button", { name: "Personnel", exact: true })
      .click();
    await expect(settingsShell.getByText("Team Members")).toBeVisible();

    await settingsShell
      .getByRole("button", { name: "Security", exact: true })
      .click();
    await expect(settingsShell.getByText("Role Permissions")).toBeVisible();

    await settingsShell
      .getByRole("button", { name: "Governance", exact: true })
      .click();
    await expect(settingsShell.getByText("Safety Rules")).toBeVisible();
  });
});
