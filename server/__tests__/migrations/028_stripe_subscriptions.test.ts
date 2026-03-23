import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Migration 028: Stripe subscription columns", () => {
  const migrationPath = path.join(
    __dirname,
    "../../migrations/028_stripe_subscriptions.sql",
  );

  it("migration file exists", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it("UP section adds stripe_customer_id column", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    const upSection = sql.split("-- DOWN")[0];
    expect(upSection).toContain("stripe_customer_id");
    expect(upSection).toContain("VARCHAR(255)");
    expect(upSection).toContain("NULL");
  });

  it("UP section adds stripe_subscription_id column", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    const upSection = sql.split("-- DOWN")[0];
    expect(upSection).toContain("stripe_subscription_id");
  });

  it("UP section adds subscription_period_end column", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    const upSection = sql.split("-- DOWN")[0];
    expect(upSection).toContain("subscription_period_end");
    expect(upSection).toContain("DATETIME");
  });

  it("all three columns are nullable", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    const upSection = sql.split("-- DOWN")[0];
    const lines = upSection
      .split("\n")
      .filter((l) => l.includes("ADD COLUMN"));
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line).toContain("NULL");
      expect(line).not.toContain("NOT NULL");
    }
  });

  it("DOWN section drops all three columns", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    const downSection = sql.split("-- DOWN")[1];
    expect(downSection).toContain("DROP COLUMN subscription_period_end");
    expect(downSection).toContain("DROP COLUMN stripe_subscription_id");
    expect(downSection).toContain("DROP COLUMN stripe_customer_id");
  });
});
