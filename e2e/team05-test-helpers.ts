import "dotenv/config";
import { expect, type Page } from "@playwright/test";

export const TEAM05_ADMIN_EMAIL =
  process.env.E2E_ADMIN_EMAIL || "admin@loadpilot.com";
export const TEAM05_ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD || "Admin123";

export async function loginAsTeam05Admin(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(TEAM05_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(TEAM05_ADMIN_PASSWORD);
  await page.getByRole("button", { name: /^Sign In$/ }).click();
  await expect(page.getByTestId("operations-dashboard")).toBeVisible({
    timeout: 20_000,
  });
}
