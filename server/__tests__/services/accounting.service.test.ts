import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Accounting Service Unit Tests
 *
 * Verifies business logic in the accountingService extracted from
 * server/routes/accounting.ts during the service-layer refactor.
 *
 * Covers:
 *   - Load P&L revenue/cost/margin calculation
 *   - IFTA jurisdiction analysis (GPS-based mile allocation)
 *   - IFTA summary tax calculation
 *   - Settlement role permission checks
 *   - Settlement batch status transition validation
 *   - ValidationError throwing for invalid quarter
 */

// --- Hoisted mocks ---
const {
  mockGetChartOfAccounts,
  mockGetLoadJournalAggregations,
  mockGetSettlementStatuses,
  mockUpdateSettlementStatuses,
  mockGetIftaTaxRates,
  mockGetMileageByState,
  mockGetFuelByState,
  mockDetectState,
  mockCalculateDistance,
} = vi.hoisted(() => ({
  mockGetChartOfAccounts: vi.fn(),
  mockGetLoadJournalAggregations: vi.fn(),
  mockGetSettlementStatuses: vi.fn(),
  mockUpdateSettlementStatuses: vi.fn(),
  mockGetIftaTaxRates: vi.fn(),
  mockGetMileageByState: vi.fn(),
  mockGetFuelByState: vi.fn(),
  mockDetectState: vi.fn(),
  mockCalculateDistance: vi.fn(),
}));

vi.mock("../../repositories/accounting.repository", () => ({
  accountingRepository: {
    getChartOfAccounts: (...args: unknown[]) => mockGetChartOfAccounts(...args),
    getLoadJournalAggregations: (...args: unknown[]) =>
      mockGetLoadJournalAggregations(...args),
    getSettlementStatuses: (...args: unknown[]) =>
      mockGetSettlementStatuses(...args),
    updateSettlementStatuses: (...args: unknown[]) =>
      mockUpdateSettlementStatuses(...args),
    getIftaTaxRates: (...args: unknown[]) => mockGetIftaTaxRates(...args),
    getMileageByState: (...args: unknown[]) => mockGetMileageByState(...args),
    getFuelByState: (...args: unknown[]) => mockGetFuelByState(...args),
  },
}));

vi.mock("../../geoUtils", () => ({
  detectState: (...args: unknown[]) => mockDetectState(...args),
  calculateDistance: (...args: unknown[]) => mockCalculateDistance(...args),
}));

// Import after mocks are set up
import {
  accountingService,
  ValidationError,
} from "../../services/accounting.service";

const TENANT = "tenant-test-123";

describe("accountingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // P&L Calculation
  // ─────────────────────────────────────────────────────────

  describe("calculateLoadPnl", () => {
    it("calculates positive margin from income vs expense rows", async () => {
      mockGetLoadJournalAggregations.mockResolvedValue([
        {
          allocation_id: "load-001",
          account_name: "Linehaul Revenue",
          account_type: "Income",
          total_debit: 0,
          total_credit: 5000,
        },
        {
          allocation_id: "load-001",
          account_name: "Driver Pay",
          account_type: "Expense",
          total_debit: 1500,
          total_credit: 0,
        },
        {
          allocation_id: "load-001",
          account_name: "Fuel",
          account_type: "Expense",
          total_debit: 800,
          total_credit: 0,
        },
      ]);

      const result = await accountingService.calculateLoadPnl(TENANT, "load-001");

      expect(result.loadId).toBe("load-001");
      expect(result.revenue).toBe(5000);
      expect(result.costs).toBe(2300);
      expect(result.margin).toBe(2700);
      expect(result.marginPercent).toBe(54);
      expect(result.details).toHaveLength(3);
    });

    it("returns zero marginPercent when revenue is zero", async () => {
      mockGetLoadJournalAggregations.mockResolvedValue([
        {
          allocation_id: "load-002",
          account_name: "Fuel",
          account_type: "Expense",
          total_debit: 500,
          total_credit: 0,
        },
      ]);

      const result = await accountingService.calculateLoadPnl(TENANT, "load-002");

      expect(result.revenue).toBe(0);
      expect(result.costs).toBe(500);
      expect(result.margin).toBe(-500);
      expect(result.marginPercent).toBe(0);
    });

    it("handles empty journal lines", async () => {
      mockGetLoadJournalAggregations.mockResolvedValue([]);

      const result = await accountingService.calculateLoadPnl(TENANT, "load-empty");

      expect(result.revenue).toBe(0);
      expect(result.costs).toBe(0);
      expect(result.margin).toBe(0);
      expect(result.details).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Settlement Permissions
  // ─────────────────────────────────────────────────────────

  describe("checkSettlementViewPermission", () => {
    it("denies users that are neither driver nor admin", () => {
      expect(accountingService.checkSettlementViewPermission("guest")).toEqual({
        allowed: false,
      });
      expect(
        accountingService.checkSettlementViewPermission("RANDOM_ROLE"),
      ).toEqual({
        allowed: false,
      });
    });

    it("allows drivers and marks isDriver=true", () => {
      const result = accountingService.checkSettlementViewPermission("driver");
      expect(result).toEqual({ allowed: true, isDriver: true });

      const result2 =
        accountingService.checkSettlementViewPermission("DRIVER_PORTAL");
      expect(result2).toEqual({ allowed: true, isDriver: true });
    });

    it("allows admin/payroll/finance roles with isDriver=false", () => {
      const adminRoles = [
        "admin",
        "payroll_manager",
        "PAYROLL_SETTLEMENTS",
        "FINANCE",
        "OWNER_ADMIN",
        "ACCOUNTING_AR",
      ];
      for (const role of adminRoles) {
        expect(accountingService.checkSettlementViewPermission(role)).toEqual({
          allowed: true,
          isDriver: false,
        });
      }
    });
  });

  describe("canCreateSettlement", () => {
    it("rejects driver and dispatcher roles", () => {
      expect(accountingService.canCreateSettlement("driver")).toBe(false);
      expect(accountingService.canCreateSettlement("dispatcher")).toBe(false);
    });

    it("allows payroll/admin/finance roles", () => {
      expect(accountingService.canCreateSettlement("admin")).toBe(true);
      expect(accountingService.canCreateSettlement("payroll_manager")).toBe(true);
      expect(accountingService.canCreateSettlement("FINANCE")).toBe(true);
      expect(accountingService.canCreateSettlement("OWNER_ADMIN")).toBe(true);
    });
  });

  describe("canApproveSettlement", () => {
    it("excludes dispatcher from approval", () => {
      expect(accountingService.canApproveSettlement("dispatcher")).toBe(false);
    });

    it("allows finance/payroll/admin roles", () => {
      expect(accountingService.canApproveSettlement("admin")).toBe(true);
      expect(accountingService.canApproveSettlement("FINANCE")).toBe(true);
      expect(accountingService.canApproveSettlement("PAYROLL_SETTLEMENTS")).toBe(
        true,
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // Settlement Batch Status Transitions
  // ─────────────────────────────────────────────────────────

  describe("batchUpdateSettlementStatus", () => {
    it("normalizes 'Finalized' to canonical 'Paid'", async () => {
      mockGetSettlementStatuses.mockResolvedValue([
        { id: "set-001", status: "Approved" },
      ]);
      mockUpdateSettlementStatuses.mockResolvedValue(1);

      const result = await accountingService.batchUpdateSettlementStatus(
        TENANT,
        ["set-001"],
        "Finalized",
      );

      expect(mockUpdateSettlementStatuses).toHaveBeenCalledWith(
        TENANT,
        ["set-001"],
        "Paid",
      );
      expect(result.updated).toBe(1);
      expect(result.blocked).toBeUndefined();
    });

    it("blocks invalid transitions and only updates allowed ones", async () => {
      mockGetSettlementStatuses.mockResolvedValue([
        { id: "set-001", status: "Draft" }, // Draft → Approved invalid
        { id: "set-002", status: "Calculated" }, // Calculated → Approved valid
      ]);
      mockUpdateSettlementStatuses.mockResolvedValue(1);

      const result = await accountingService.batchUpdateSettlementStatus(
        TENANT,
        ["set-001", "set-002"],
        "Approved",
      );

      expect(mockUpdateSettlementStatuses).toHaveBeenCalledWith(
        TENANT,
        ["set-002"],
        "Approved",
      );
      expect(result.updated).toBe(1);
      expect(result.blocked).toEqual([
        "set-001: cannot transition from Draft to Approved",
      ]);
    });

    it("throws ValidationError on non-canonical status", async () => {
      await expect(
        accountingService.batchUpdateSettlementStatus(
          TENANT,
          ["set-001"],
          "Bogus",
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("does not call update when no rows are allowed", async () => {
      mockGetSettlementStatuses.mockResolvedValue([
        { id: "set-001", status: "Paid" }, // Paid is terminal
      ]);

      const result = await accountingService.batchUpdateSettlementStatus(
        TENANT,
        ["set-001"],
        "Approved",
      );

      expect(mockUpdateSettlementStatuses).not.toHaveBeenCalled();
      expect(result.updated).toBe(0);
      expect(result.blocked).toBeDefined();
    });

    it("enforces full Draft → Calculated → Approved → Paid sequence", async () => {
      // Each test verifies one valid step
      mockGetSettlementStatuses.mockResolvedValueOnce([
        { id: "x", status: "Draft" },
      ]);
      mockUpdateSettlementStatuses.mockResolvedValueOnce(1);
      const r1 = await accountingService.batchUpdateSettlementStatus(
        TENANT,
        ["x"],
        "Calculated",
      );
      expect(r1.updated).toBe(1);

      mockGetSettlementStatuses.mockResolvedValueOnce([
        { id: "x", status: "Calculated" },
      ]);
      mockUpdateSettlementStatuses.mockResolvedValueOnce(1);
      const r2 = await accountingService.batchUpdateSettlementStatus(
        TENANT,
        ["x"],
        "Approved",
      );
      expect(r2.updated).toBe(1);

      mockGetSettlementStatuses.mockResolvedValueOnce([
        { id: "x", status: "Approved" },
      ]);
      mockUpdateSettlementStatuses.mockResolvedValueOnce(1);
      const r3 = await accountingService.batchUpdateSettlementStatus(
        TENANT,
        ["x"],
        "Paid",
      );
      expect(r3.updated).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────
  // IFTA Analyze (GPS Jurisdiction Analysis)
  // ─────────────────────────────────────────────────────────

  describe("analyzeIftaJurisdictions", () => {
    it("aggregates miles per state from GPS pings", async () => {
      mockCalculateDistance.mockReturnValueOnce(10).mockReturnValueOnce(20);
      // p2 and p3 have state codes inline so detectState should not be called

      const result = await accountingService.analyzeIftaJurisdictions([
        { lat: 39.7, lng: -104.9 },
        { lat: 39.8, lng: -104.8, state_code: "CO" },
        { lat: 39.9, lng: -104.7, stateCode: "CO" },
      ]);

      expect(result.jurisdictionMiles).toEqual({ CO: 30 });
      expect(result.method).toBe("ACTUAL_GPS");
      expect(result.confidence).toBe("HIGH");
      expect(mockDetectState).not.toHaveBeenCalled();
    });

    it("falls back to reverse geocoding when state_code is missing", async () => {
      mockCalculateDistance.mockReturnValueOnce(15);
      mockDetectState.mockResolvedValueOnce("UT");

      const result = await accountingService.analyzeIftaJurisdictions([
        { lat: 40.0, lng: -111.0 },
        { lat: 40.1, lng: -111.1 }, // no state_code → triggers detectState
      ]);

      expect(result.jurisdictionMiles).toEqual({ UT: 15 });
      expect(mockDetectState).toHaveBeenCalledWith(40.1, -111.1);
    });

    it("returns empty object when only one ping is provided", async () => {
      const result = await accountingService.analyzeIftaJurisdictions([
        { lat: 39.7, lng: -104.9, state_code: "CO" },
      ]);

      expect(result.jurisdictionMiles).toEqual({});
      expect(mockCalculateDistance).not.toHaveBeenCalled();
    });

    it("accumulates miles across multiple states", async () => {
      mockCalculateDistance
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(75)
        .mockReturnValueOnce(25);

      const result = await accountingService.analyzeIftaJurisdictions([
        { lat: 0, lng: 0 },
        { lat: 1, lng: 1, state_code: "CA" },
        { lat: 2, lng: 2, state_code: "NV" },
        { lat: 3, lng: 3, state_code: "CA" },
      ]);

      expect(result.jurisdictionMiles).toEqual({ CA: 75, NV: 75 });
    });
  });

  // ─────────────────────────────────────────────────────────
  // IFTA Summary
  // ─────────────────────────────────────────────────────────

  describe("getIftaSummary", () => {
    it("calculates net tax due using fleet average MPG", async () => {
      mockGetIftaTaxRates.mockResolvedValue([
        { state_code: "CA", rate_per_gallon: 0.5 },
        { state_code: "NV", rate_per_gallon: 0.3 },
      ]);
      mockGetMileageByState.mockResolvedValue([
        { state_code: "CA", total_miles: 1000 },
        { state_code: "NV", total_miles: 500 },
      ]);
      mockGetFuelByState.mockResolvedValue([
        { state_code: "CA", total_gallons: 200, total_cost: 800 },
        { state_code: "NV", total_gallons: 50, total_cost: 200 },
      ]);

      const result = await accountingService.getIftaSummary(TENANT, "1", "2026");

      // 1500 miles / 250 gallons = 6 MPG fleet average
      expect(result.fleetAvgMpg).toBe(6);
      expect(result.totalMiles).toBe(1500);
      expect(result.totalGallons).toBe(250);

      // CA: 1000mi / 6mpg = 166.67 taxable gallons * 0.5 rate = $83.33 tax due
      // CA paid at pump: 200gal * 0.5 = $100 → net = $83.33 - $100 = -$16.67
      const ca = result.rows.find((r) => r.stateCode === "CA");
      expect(ca?.taxableGallons).toBeCloseTo(166.67, 1);
      expect(ca?.taxDue).toBeCloseTo(83.33, 1);
      expect(ca?.taxPaidAtPump).toBe(100);
      expect(ca?.netTax).toBeCloseTo(-16.67, 1);

      // NV: 500mi / 6mpg = 83.33 taxable gallons * 0.3 rate = $25 tax due
      const nv = result.rows.find((r) => r.stateCode === "NV");
      expect(nv?.taxDue).toBeCloseTo(25, 1);
    });

    it("falls back to default 6.0 MPG when no fuel data exists", async () => {
      mockGetIftaTaxRates.mockResolvedValue([
        { state_code: "TX", rate_per_gallon: 0.2 },
      ]);
      mockGetMileageByState.mockResolvedValue([
        { state_code: "TX", total_miles: 600 },
      ]);
      mockGetFuelByState.mockResolvedValue([]);

      const result = await accountingService.getIftaSummary(TENANT, "2", "2026");

      expect(result.fleetAvgMpg).toBe(6);
    });

    it("uses default tax rate of 0.20 when state rate is missing", async () => {
      mockGetIftaTaxRates.mockResolvedValue([]); // no rates
      mockGetMileageByState.mockResolvedValue([
        { state_code: "WY", total_miles: 600 },
      ]);
      mockGetFuelByState.mockResolvedValue([
        { state_code: "WY", total_gallons: 100, total_cost: 300 },
      ]);

      const result = await accountingService.getIftaSummary(TENANT, "3", "2026");

      const wy = result.rows.find((r) => r.stateCode === "WY");
      expect(wy?.taxRate).toBe(0.2);
    });

    it("throws ValidationError for invalid quarter (>4)", async () => {
      // Note: original code does `parseInt(quarter, 10) || 4` so "0" and
      // non-numeric strings fall back to Q4 (no error). Only quarters
      // greater than 4 trigger the validation branch.
      await expect(
        accountingService.getIftaSummary(TENANT, "5", "2026"),
      ).rejects.toThrow(ValidationError);
    });

    it("uses correct quarter end date for rate lookup", async () => {
      mockGetIftaTaxRates.mockResolvedValue([]);
      mockGetMileageByState.mockResolvedValue([]);
      mockGetFuelByState.mockResolvedValue([]);

      await accountingService.getIftaSummary(TENANT, "1", "2026");
      expect(mockGetIftaTaxRates).toHaveBeenCalledWith("2026-03-31");

      await accountingService.getIftaSummary(TENANT, "2", "2026");
      expect(mockGetIftaTaxRates).toHaveBeenCalledWith("2026-06-30");

      await accountingService.getIftaSummary(TENANT, "3", "2026");
      expect(mockGetIftaTaxRates).toHaveBeenCalledWith("2026-09-30");

      await accountingService.getIftaSummary(TENANT, "4", "2026");
      expect(mockGetIftaTaxRates).toHaveBeenCalledWith("2026-12-31");
    });
  });

  // ─────────────────────────────────────────────────────────
  // Pass-through delegations
  // ─────────────────────────────────────────────────────────

  describe("getChartOfAccounts", () => {
    it("delegates to repository with tenantId", async () => {
      mockGetChartOfAccounts.mockResolvedValue([
        { id: "GL-1000", name: "Cash", type: "Asset" },
      ]);

      const result = await accountingService.getChartOfAccounts(TENANT);

      expect(mockGetChartOfAccounts).toHaveBeenCalledWith(TENANT);
      expect(result).toHaveLength(1);
    });
  });
});
