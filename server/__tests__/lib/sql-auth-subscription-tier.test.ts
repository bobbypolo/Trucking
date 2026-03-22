import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for S-101: subscription_tier field in mapCompanyRowToApiCompany
 *
 * Verifies that:
 * - R-P1-01: Migration 027 structure (tested here by asserting the mapper
 *   handles the column correctly — SQL migration tested separately)
 * - R-P1-02: mapCompanyRowToApiCompany returns subscriptionTier field,
 *   null defaults to "Records Vault"
 */

// Hoisted mocks for pool and firestore
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

vi.mock("../../firestore", () => ({
  default: {
    collection: () => ({
      doc: () => ({
        set: vi.fn(),
      }),
    }),
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import type { SqlCompanyRow } from "../../lib/sql-auth";

function makeCompanyRow(
  overrides: Partial<Record<string, unknown>> = {},
): SqlCompanyRow {
  return {
    id: "company-abc",
    name: "Test Trucking LLC",
    account_type: "fleet",
    email: "info@test.com",
    address: "123 Main St",
    city: "Dallas",
    state: "TX",
    zip: "75001",
    tax_id: "12-3456789",
    phone: "555-1234",
    mc_number: "MC-123456",
    dot_number: "DOT-789",
    subscription_status: "active",
    subscription_tier: null,
    load_numbering_config: null,
    accessorial_rates: null,
    operating_mode: "fleet",
    constructor: { name: "RowDataPacket" },
    ...overrides,
  } as unknown as SqlCompanyRow;
}

describe("S-101: subscription_tier in mapCompanyRowToApiCompany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns subscriptionTier field when subscription_tier is set", async () => {
    const { mapCompanyRowToApiCompany } = await import("../../lib/sql-auth");
    const row = makeCompanyRow({ subscription_tier: "Fleet Command" });
    const result = mapCompanyRowToApiCompany(row);

    expect(result.subscriptionTier).toBe("Fleet Command");
    expect(result.subscription_tier).toBe("Fleet Command");
  });

  it("defaults null subscription_tier to Records Vault", async () => {
    const { mapCompanyRowToApiCompany } = await import("../../lib/sql-auth");
    const row = makeCompanyRow({ subscription_tier: null });
    const result = mapCompanyRowToApiCompany(row);

    expect(result.subscriptionTier).toBe("Records Vault");
    expect(result.subscription_tier).toBe("Records Vault");
  });

  it("defaults undefined subscription_tier to Records Vault", async () => {
    const { mapCompanyRowToApiCompany } = await import("../../lib/sql-auth");
    const row = makeCompanyRow({ subscription_tier: undefined });
    const result = mapCompanyRowToApiCompany(row);

    expect(result.subscriptionTier).toBe("Records Vault");
    expect(result.subscription_tier).toBe("Records Vault");
  });

  it("preserves each valid tier name", async () => {
    const { mapCompanyRowToApiCompany } = await import("../../lib/sql-auth");
    const tiers = [
      "Records Vault",
      "Automation Pro",
      "Fleet Core",
      "Fleet Command",
    ];

    for (const tier of tiers) {
      const row = makeCompanyRow({ subscription_tier: tier });
      const result = mapCompanyRowToApiCompany(row);
      expect(result.subscriptionTier).toBe(tier);
      expect(result.subscription_tier).toBe(tier);
    }
  });

  it("includes subscriptionTier alongside other mapped fields", async () => {
    const { mapCompanyRowToApiCompany } = await import("../../lib/sql-auth");
    const row = makeCompanyRow({
      subscription_tier: "Automation Pro",
      subscription_status: "active",
    });
    const result = mapCompanyRowToApiCompany(row);

    // Verify subscription_tier coexists with other fields
    expect(result.id).toBe("company-abc");
    expect(result.name).toBe("Test Trucking LLC");
    expect(result.subscriptionStatus).toBe("active");
    expect(result.subscriptionTier).toBe("Automation Pro");
  });

  it("SqlCompanyRow interface accepts subscription_tier field", () => {
    // Type-level test: if this compiles, the interface is correct
    const row: SqlCompanyRow = makeCompanyRow({
      subscription_tier: "Fleet Core",
    });
    expect(row.subscription_tier).toBe("Fleet Core");
  });
});
