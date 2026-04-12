import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests R-P8-01
 *
 * Verifies fetchSettlements() calls api.get('/accounting/settlements')
 * and returns Settlement[].
 */

// Mock the api module
const mockGet = vi.fn();
vi.mock("../../src/services/api", () => ({
  default: {
    get: mockGet,
  },
}));

// Mock firebase config (transitive dependency of api.ts)
vi.mock("../../src/config/firebase", () => ({
  auth: { currentUser: null },
}));

describe("R-P8-01: fetchSettlements service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P8-01
  it("calls api.get with /accounting/settlements and returns Settlement[]", async () => {
    const mockSettlements = [
      {
        id: "set-001",
        company_id: "co-1",
        driver_id: "drv-1",
        settlement_date: "2026-04-01",
        period_start: "2026-03-16",
        period_end: "2026-03-31",
        total_earnings: 2500.0,
        total_deductions: 350.0,
        total_reimbursements: 100.0,
        net_pay: 2250.0,
        status: "approved",
        lines: [
          {
            id: "line-1",
            settlement_id: "set-001",
            description: "Linehaul pay",
            amount: 2500.0,
            load_id: "load-100",
            type: "earning",
          },
        ],
      },
      {
        id: "set-002",
        company_id: "co-1",
        driver_id: "drv-1",
        settlement_date: "2026-03-15",
        period_start: "2026-03-01",
        period_end: "2026-03-15",
        total_earnings: 1800.0,
        total_deductions: 200.0,
        total_reimbursements: 50.0,
        net_pay: 1650.0,
        status: "pending",
        lines: [],
      },
    ];

    mockGet.mockResolvedValueOnce(mockSettlements);

    const { fetchSettlements } = await import("../../src/services/settlements");

    const result = await fetchSettlements();

    expect(mockGet).toHaveBeenCalledWith("/accounting/settlements");
    expect(result).toEqual(mockSettlements);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("set-001");
    expect(result[0].net_pay).toBe(2250.0);
    expect(result[0].status).toBe("approved");
    expect(result[1].id).toBe("set-002");
    expect(result[1].net_pay).toBe(1650.0);
  });

  // # Tests R-P8-01
  it("returns empty array when no settlements exist", async () => {
    mockGet.mockResolvedValueOnce([]);

    const { fetchSettlements } = await import("../../src/services/settlements");

    const result = await fetchSettlements();

    expect(mockGet).toHaveBeenCalledWith("/accounting/settlements");
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  // # Tests R-P8-01
  it("propagates API errors to the caller", async () => {
    mockGet.mockRejectedValueOnce(new Error("Network error"));

    const { fetchSettlements } = await import("../../src/services/settlements");

    await expect(fetchSettlements()).rejects.toThrow("Network error");
    expect(mockGet).toHaveBeenCalledWith("/accounting/settlements");
  });
});
