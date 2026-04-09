import * as dotenv from "dotenv";
import path from "path";
import { expect, type Page } from "@playwright/test";
import { APP_BASE } from "../fixtures/urls";

dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: false });
dotenv.config({ path: path.join(process.cwd(), ".env"), override: false });

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required env var for sales demo e2e: ${name}`);
  }
  return value;
}

export const salesDemoCreds = {
  adminEmail: requireEnv(
    "SALES_DEMO_ADMIN_EMAIL",
    process.env.E2E_ADMIN_EMAIL,
  ),
  adminPassword: requireEnv(
    "SALES_DEMO_ADMIN_PASSWORD",
    process.env.E2E_ADMIN_PASSWORD,
  ),
  driverEmail: requireEnv(
    "SALES_DEMO_DRIVER_EMAIL",
    process.env.E2E_DRIVER_EMAIL,
  ),
  driverPassword: requireEnv(
    "SALES_DEMO_DRIVER_PASSWORD",
    process.env.E2E_DRIVER_PASSWORD,
  ),
};

export function requireSalesDemoGuards() {
  return (
    process.env.SALES_DEMO_E2E === "1" &&
    process.env.E2E_SERVER_RUNNING === "1"
  );
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto(APP_BASE);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
}

export async function loginAsSalesDemoAdmin(page: Page) {
  await signIn(page, salesDemoCreds.adminEmail, salesDemoCreds.adminPassword);
  await expect(page.getByRole("button", { name: /sign out/i }).first()).toBeVisible({
    timeout: 30000,
  });
}

export async function loginAsSalesDemoDriver(page: Page) {
  await signIn(page, salesDemoCreds.driverEmail, salesDemoCreds.driverPassword);
  await expect(page.getByTestId("driver-nav-today")).toBeVisible({
    timeout: 30000,
  });
}
