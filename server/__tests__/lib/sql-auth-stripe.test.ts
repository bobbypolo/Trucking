import { describe, it, expect } from "vitest";
import {
  mapCompanyRowToApiCompany,
  SqlCompanyRow,
} from "../../lib/sql-auth";

function makeCompanyRow(overrides: Record<string, unknown> = {}): SqlCompanyRow {
  return {
    id: "co-1",
    name: "Test Company",
    account_type: "carrier",
    email: "test@example.com",
    address: "123 Main St",
    city: "Dallas",
    state: "TX",
    zip: "75201",
    tax_id: null,
    phone: null,
    mc_number: null,
    dot_number: null,
    subscription_status: "active",
    load_numbering_config: null,
    accessorial_rates: null,
    operating_mode: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_period_end: null,
    constructor: { name: "RowDataPacket" },
    ...overrides,
  } as unknown as SqlCompanyRow;
}

describe("mapCompanyRowToApiCompany — Stripe fields", () => {
  it("returns stripeCustomerId when present", () => {
    const row = makeCompanyRow({ stripe_customer_id: "cus_abc123" });
    const result = mapCompanyRowToApiCompany(row);
    expect(result.stripeCustomerId).toBe("cus_abc123");
  });

  it("returns stripeSubscriptionId when present", () => {
    const row = makeCompanyRow({
      stripe_subscription_id: "sub_xyz789",
    });
    const result = mapCompanyRowToApiCompany(row);
    expect(result.stripeSubscriptionId).toBe("sub_xyz789");
  });

  it("returns subscriptionPeriodEnd when present", () => {
    const row = makeCompanyRow({
      subscription_period_end: "2026-04-01T00:00:00.000Z" as any,
    });
    const result = mapCompanyRowToApiCompany(row);
    expect(result.subscriptionPeriodEnd).toBe("2026-04-01T00:00:00.000Z");
  });

  it("returns undefined for null stripe_customer_id", () => {
    const row = makeCompanyRow({ stripe_customer_id: null });
    const result = mapCompanyRowToApiCompany(row);
    expect(result.stripeCustomerId).toBeUndefined();
  });

  it("returns undefined for null stripe_subscription_id", () => {
    const row = makeCompanyRow({ stripe_subscription_id: null });
    const result = mapCompanyRowToApiCompany(row);
    expect(result.stripeSubscriptionId).toBeUndefined();
  });

  it("returns undefined for null subscription_period_end", () => {
    const row = makeCompanyRow({ subscription_period_end: null });
    const result = mapCompanyRowToApiCompany(row);
    expect(result.subscriptionPeriodEnd).toBeUndefined();
  });

  it("all three Stripe fields coexist with existing company fields", () => {
    const row = makeCompanyRow({
      stripe_customer_id: "cus_test",
      stripe_subscription_id: "sub_test",
      subscription_period_end: "2026-12-31" as any,
    });
    const result = mapCompanyRowToApiCompany(row);
    // Existing fields still present
    expect(result.id).toBe("co-1");
    expect(result.name).toBe("Test Company");
    expect(result.subscriptionStatus).toBe("active");
    // New Stripe fields
    expect(result.stripeCustomerId).toBe("cus_test");
    expect(result.stripeSubscriptionId).toBe("sub_test");
    expect(result.subscriptionPeriodEnd).toBe("2026-12-31");
  });
});
