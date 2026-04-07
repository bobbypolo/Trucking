import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Accounting Repository Unit Tests
 *
 * Verifies parameterized SQL queries and tenant isolation in
 * the accountingRepository extracted from server/routes/accounting.ts.
 *
 * Critical security checks:
 *   - Every query includes company_id in WHERE clause
 *   - Update queries scope by company_id to prevent cross-tenant writes
 *   - Settlement filters by driver_id when provided
 */

// --- Hoisted mocks ---
const {
  mockQuery,
  mockExecute,
  mockBeginTransaction,
  mockCommit,
  mockRollback,
  mockRelease,
  mockGetConnection,
  mockConnection,
} = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockExecute = vi.fn();
  const mockBeginTransaction = vi.fn().mockResolvedValue(undefined);
  const mockCommit = vi.fn().mockResolvedValue(undefined);
  const mockRollback = vi.fn().mockResolvedValue(undefined);
  const mockRelease = vi.fn();

  const mockConnection = {
    beginTransaction: mockBeginTransaction,
    commit: mockCommit,
    rollback: mockRollback,
    release: mockRelease,
    query: mockQuery,
    execute: mockExecute,
  };

  const mockGetConnection = vi.fn().mockResolvedValue(mockConnection);

  return {
    mockQuery,
    mockExecute,
    mockBeginTransaction,
    mockCommit,
    mockRollback,
    mockRelease,
    mockGetConnection,
    mockConnection,
  };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: mockExecute,
    getConnection: mockGetConnection,
  },
}));

import { accountingRepository } from "../../repositories/accounting.repository";

const TENANT_A = "tenant-aaa";
const TENANT_B = "tenant-bbb";

describe("accountingRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // Chart of Accounts
  // ─────────────────────────────────────────────────────────

  describe("getChartOfAccounts", () => {
    it("scopes query by company_id and is_active filter", async () => {
      mockQuery.mockResolvedValue([[{ id: "GL-1000", name: "Cash" }]]);

      await accountingRepository.getChartOfAccounts(TENANT_A);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE company_id = ? AND is_active = TRUE"),
        [TENANT_A],
      );
    });

    it("orders by account_number", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.getChartOfAccounts(TENANT_A);

      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain("ORDER BY account_number ASC");
    });
  });

  // ─────────────────────────────────────────────────────────
  // Load P&L Aggregation
  // ─────────────────────────────────────────────────────────

  describe("getLoadJournalAggregations", () => {
    it("filters by both loadId and tenant company_id", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.getLoadJournalAggregations(TENANT_A, "load-123");

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("jl.allocation_type = 'Load'");
      expect(sql).toContain("jl.allocation_id = ?");
      expect(sql).toContain("je.company_id = ?");
      expect(params).toEqual(["load-123", TENANT_A]);
    });

    it("groups by gl_account_id, name, and type", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.getLoadJournalAggregations(TENANT_A, "load-1");

      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain("GROUP BY jl.gl_account_id, a.name, a.type");
    });
  });

  // ─────────────────────────────────────────────────────────
  // List Operations (tenant isolation)
  // ─────────────────────────────────────────────────────────

  describe("listInvoices", () => {
    it("scopes by company_id and orders by date desc", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.listInvoices(TENANT_A);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE company_id = ?"),
        [TENANT_A],
      );
      expect(mockQuery.mock.calls[0][0]).toContain("ORDER BY invoice_date DESC");
    });
  });

  describe("listBills", () => {
    it("scopes by company_id and orders by bill_date desc", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.listBills(TENANT_B);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE company_id = ?"),
        [TENANT_B],
      );
      expect(mockQuery.mock.calls[0][0]).toContain("ORDER BY bill_date DESC");
    });
  });

  describe("listSettlements", () => {
    it("scopes by company_id only when no driverId provided", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.listSettlements(TENANT_A);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("WHERE company_id = ?");
      expect(sql).not.toContain("driver_id");
      expect(params).toEqual([TENANT_A]);
    });

    it("adds driver_id filter when provided", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.listSettlements(TENANT_A, "driver-001");

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("WHERE company_id = ? AND driver_id = ?");
      expect(params).toEqual([TENANT_A, "driver-001"]);
    });
  });

  describe("listMileage", () => {
    it("scopes by company_id and limits to 50", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.listMileage(TENANT_A);

      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain("WHERE company_id = ?");
      expect(sql).toContain("LIMIT 50");
    });
  });

  // ─────────────────────────────────────────────────────────
  // Settlement Status Updates (tenant isolation)
  // ─────────────────────────────────────────────────────────

  describe("getSettlementStatuses", () => {
    it("builds parameterized IN clause scoped by company_id", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.getSettlementStatuses(TENANT_A, [
        "id-1",
        "id-2",
        "id-3",
      ]);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("WHERE company_id = ? AND id IN (?,?,?)");
      expect(params).toEqual([TENANT_A, "id-1", "id-2", "id-3"]);
    });
  });

  describe("updateSettlementStatuses", () => {
    it("scopes UPDATE by company_id to prevent cross-tenant writes", async () => {
      mockQuery.mockResolvedValue([{ affectedRows: 2 }]);

      const result = await accountingRepository.updateSettlementStatuses(
        TENANT_A,
        ["s1", "s2"],
        "Approved",
      );

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("WHERE company_id = ? AND id IN (?,?)");
      expect(params).toEqual(["Approved", TENANT_A, "s1", "s2"]);
      expect(result).toBe(2);
    });

    it("returns 0 when affectedRows is undefined", async () => {
      mockQuery.mockResolvedValue([{}]);

      const result = await accountingRepository.updateSettlementStatuses(
        TENANT_A,
        ["s1"],
        "Paid",
      );

      expect(result).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // IFTA queries
  // ─────────────────────────────────────────────────────────

  describe("getIftaEvidence", () => {
    it("scopes by both tenant and load_id", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.getIftaEvidence(TENANT_A, "load-001");

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("WHERE company_id = ? AND load_id = ?");
      expect(params).toEqual([TENANT_A, "load-001"]);
    });
  });

  describe("getIftaTaxRates", () => {
    it("uses correlated subquery for latest effective rate", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.getIftaTaxRates("2026-03-31");

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("MAX(effective_date)");
      expect(sql).toContain("effective_date <= ?");
      expect(params).toEqual(["2026-03-31"]);
    });
  });

  describe("getMileageByState / getFuelByState", () => {
    it("aggregates mileage with company_id scope", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.getMileageByState(TENANT_A);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("WHERE company_id = ?");
      expect(sql).toContain("GROUP BY state_code");
      expect(params).toEqual([TENANT_A]);
    });

    it("aggregates fuel with company_id scope", async () => {
      mockQuery.mockResolvedValue([[]]);

      await accountingRepository.getFuelByState(TENANT_A);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("FROM fuel_ledger WHERE company_id = ?");
      expect(params).toEqual([TENANT_A]);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Insert operations (tenant binding)
  // ─────────────────────────────────────────────────────────

  describe("createIftaAudit", () => {
    it("includes tenantId in INSERT and stringifies jurisdictionMiles JSON", async () => {
      mockQuery.mockResolvedValue([{ insertId: 1 }]);

      await accountingRepository.createIftaAudit(TENANT_A, {
        truckId: "T-001",
        loadId: "L-001",
        tripDate: "2026-04-01",
        startOdometer: 100000,
        endOdometer: 100500,
        totalMiles: 500,
        method: "ACTUAL_GPS",
        confidenceLevel: "HIGH",
        jurisdictionMiles: { CA: 250, NV: 250 },
        attestedBy: "user-1",
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("INSERT INTO ifta_trips_audit");
      // Parameter index 1 is tenant ID (after uuid)
      expect(params[1]).toBe(TENANT_A);
      // jurisdiction_miles should be serialized JSON
      const jurisdictionParam = params.find(
        (p: unknown) => typeof p === "string" && p.includes("CA"),
      );
      expect(jurisdictionParam).toBe(JSON.stringify({ CA: 250, NV: 250 }));
    });
  });

  describe("createMileageEntry", () => {
    it("includes tenantId as second parameter", async () => {
      mockQuery.mockResolvedValue([{ insertId: 1 }]);

      await accountingRepository.createMileageEntry(
        TENANT_A,
        "T-1",
        "L-1",
        "CA",
        100,
        "2026-04-01",
        "Manual",
      );

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("INSERT INTO mileage_jurisdiction");
      expect(params[1]).toBe(TENANT_A);
    });
  });

  describe("createFuelReceipt", () => {
    it("returns generated UUID and binds tenant", async () => {
      mockQuery.mockResolvedValue([{ insertId: 1 }]);

      const id = await accountingRepository.createFuelReceipt(TENANT_A, {
        vendorName: "Pilot",
        gallons: 100,
        pricePerGallon: 4.5,
        totalCost: 450,
        transactionDate: "2026-04-01",
        stateCode: "CA",
        truckId: "T-1",
      });

      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("INSERT INTO fuel_ledger");
      expect(params[1]).toBe(TENANT_A);
    });

    it("uses null for optional truckId", async () => {
      mockQuery.mockResolvedValue([{ insertId: 1 }]);

      await accountingRepository.createFuelReceipt(TENANT_A, {
        vendorName: "Pilot",
        gallons: 100,
        pricePerGallon: 4.5,
        totalCost: 450,
        transactionDate: "2026-04-01",
        stateCode: "CA",
      });

      const params = mockQuery.mock.calls[0][1];
      // truck_id is index 2 (after id, company_id)
      expect(params[2]).toBeNull();
    });
  });

  describe("createAdjustment", () => {
    it("binds tenantId as second parameter", async () => {
      mockQuery.mockResolvedValue([{ insertId: 1 }]);

      await accountingRepository.createAdjustment(TENANT_A, {
        parentEntityType: "Invoice",
        parentEntityId: "inv-001",
        amountAdjustment: -50,
        reasonCode: "OVERPAY",
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("INSERT INTO adjustment_entries");
      expect(params[1]).toBe(TENANT_A);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Connection helper
  // ─────────────────────────────────────────────────────────

  describe("getConnection", () => {
    it("delegates to pool.getConnection", async () => {
      await accountingRepository.getConnection();
      expect(mockGetConnection).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────
  // Cross-tenant isolation regression test
  // ─────────────────────────────────────────────────────────

  describe("Tenant isolation regression", () => {
    it("never executes a SELECT without company_id when listing", async () => {
      mockQuery.mockResolvedValue([[]]);

      const listFunctions = [
        () => accountingRepository.getChartOfAccounts(TENANT_A),
        () => accountingRepository.listInvoices(TENANT_A),
        () => accountingRepository.listBills(TENANT_A),
        () => accountingRepository.listSettlements(TENANT_A),
        () => accountingRepository.listMileage(TENANT_A),
        () => accountingRepository.getMileageByState(TENANT_A),
        () => accountingRepository.getFuelByState(TENANT_A),
      ];

      for (const fn of listFunctions) {
        mockQuery.mockClear();
        await fn();
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toContain("company_id = ?");
      }
    });
  });
});
