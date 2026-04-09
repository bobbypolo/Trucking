/**
 * Tests R-P1-10: Invoice Aging Nightly Job
 *
 * Validates `server/jobs/invoice-aging-nightly.ts`:
 *  - Running the job against 3 seeded invoices updates days_since_issued > 0
 *  - And writes a non-null last_aging_snapshot_at for each row.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    getConnection: vi.fn(),
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { runInvoiceAgingNightly } from "../../jobs/invoice-aging-nightly";

describe("invoice-aging-nightly job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Tests R-P1-10 — updates days_since_issued > 0 and non-null last_aging_snapshot_at for 3 seeded invoices", async () => {
    // Three invoices with different issue dates (all in the past).
    const now = new Date("2025-12-31T00:00:00.000Z");
    const seededInvoices = [
      { id: "inv-001", issued_at: new Date("2025-12-01T00:00:00.000Z") },
      { id: "inv-002", issued_at: new Date("2025-11-15T00:00:00.000Z") },
      { id: "inv-003", issued_at: new Date("2025-10-01T00:00:00.000Z") },
    ];

    // First query: SELECT id, issued_at FROM ar_invoices
    mockQuery.mockResolvedValueOnce([seededInvoices]);
    // Subsequent queries: UPDATE per invoice (3 calls)
    mockQuery.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await runInvoiceAgingNightly(now);

    // The job must report 3 updated invoices.
    expect(result.updated).toBe(3);
    // Each captured update payload must have days_since_issued > 0
    // and a non-null last_aging_snapshot_at.
    expect(result.snapshots.length).toBe(3);
    for (const snap of result.snapshots) {
      expect(snap.daysSinceIssued).toBeGreaterThan(0);
      expect(snap.lastAgingSnapshotAt).not.toBeNull();
      expect(snap.lastAgingSnapshotAt).toBeDefined();
    }

    // Verify the actual SQL UPDATEs were issued (3 UPDATE calls + 1 SELECT).
    expect(mockQuery).toHaveBeenCalledTimes(4);
    // First call must be a SELECT against ar_invoices
    expect(mockQuery.mock.calls[0][0]).toMatch(/SELECT/i);
    expect(mockQuery.mock.calls[0][0]).toMatch(/ar_invoices/i);
    // The remaining 3 calls must be UPDATEs against ar_invoices
    for (let i = 1; i <= 3; i++) {
      expect(mockQuery.mock.calls[i][0]).toMatch(/UPDATE\s+ar_invoices/i);
      expect(mockQuery.mock.calls[i][0]).toMatch(/days_since_issued/i);
      expect(mockQuery.mock.calls[i][0]).toMatch(/last_aging_snapshot_at/i);
    }
  });

  it("Tests R-P1-10 — computes correct days_since_issued for each row", async () => {
    const now = new Date("2025-12-31T00:00:00.000Z");
    const seededInvoices = [
      { id: "inv-30", issued_at: new Date("2025-12-01T00:00:00.000Z") }, // 30 days
      { id: "inv-46", issued_at: new Date("2025-11-15T00:00:00.000Z") }, // 46 days
      { id: "inv-91", issued_at: new Date("2025-10-01T00:00:00.000Z") }, // 91 days
    ];
    mockQuery.mockResolvedValueOnce([seededInvoices]);
    mockQuery.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await runInvoiceAgingNightly(now);
    const days = result.snapshots
      .map((s) => s.daysSinceIssued)
      .sort((a, b) => a - b);
    expect(days).toEqual([30, 46, 91]);
  });

  it("Tests R-P1-10 — returns updated:0 when no invoices exist", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await runInvoiceAgingNightly(
      new Date("2025-12-31T00:00:00.000Z"),
    );
    expect(result.updated).toBe(0);
    expect(result.snapshots).toEqual([]);
  });
});
