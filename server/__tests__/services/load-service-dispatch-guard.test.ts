/**
 * Tests R-P4-06, R-P4-07, R-P4-08: load.service.ts dispatch guard + validateDispatchGuards
 *
 * Verifies:
 *  - load.service.ts uses load.equipment_id as FIRST preference for equipmentId
 *    before falling back to chassis_number / container_number
 *  - validateDispatchGuards passes when equipmentId is provided (regression)
 *  - validateDispatchGuards fails with 'equipment' in error when equipmentId is null
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateDispatchGuards } from "../../services/load-state-machine";

// ── Mocks for load.service.ts integration path ───────────────────────────────

const {
  mockQuery,
  mockExecute,
  mockGetConnection,
  mockBeginTransaction,
  mockCommit,
  mockRollback,
  mockRelease,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockExecute: vi.fn(),
  mockGetConnection: vi.fn(),
  mockBeginTransaction: vi.fn(),
  mockCommit: vi.fn(),
  mockRollback: vi.fn(),
  mockRelease: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: mockExecute,
    getConnection: mockGetConnection,
  },
}));

const mockConnectionObj = {
  beginTransaction: mockBeginTransaction,
  execute: mockExecute,
  commit: mockCommit,
  rollback: mockRollback,
  release: mockRelease,
};

import { loadService } from "../../services/load.service";

// ── R-P4-06: load.service.ts prefers equipment_id ────────────────────────────

describe("R-P4-06 — loadService.transitionLoad uses equipment_id as first preference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnectionObj);
    mockBeginTransaction.mockResolvedValue(undefined);
    mockCommit.mockResolvedValue(undefined);
    mockRollback.mockResolvedValue(undefined);
    mockRelease.mockReturnValue(undefined);
  });

  // Tests R-P4-06
  it("Tests R-P4-06 — looks up equipment by equipment_id when present, ignoring chassis_number", async () => {
    // Load has equipment_id='EQ-001' AND chassis_number='CHASS-999'
    // The equipment lookup query should use 'EQ-001', NOT 'CHASS-999'
    const loadWithEquipmentId = {
      id: "load-abc",
      company_id: "company-aaa",
      status: "planned",
      version: 1,
      driver_id: "driver-1",
      equipment_id: "EQ-001",
      chassis_number: "CHASS-999",
      container_number: null,
    };

    const stops = [
      {
        id: "stop-1",
        load_id: "load-abc",
        type: "Pickup",
        completed: false,
        sequence_order: 0,
      },
      {
        id: "stop-2",
        load_id: "load-abc",
        type: "Dropoff",
        completed: false,
        sequence_order: 1,
      },
    ];

    // mockQuery calls:
    // 1. SELECT * FROM loads (fetch load)
    // 2. SELECT ll.* FROM load_legs (fetch stops)
    // 3. SELECT company_id FROM users WHERE id = ? (driver lookup)
    // 4. SELECT company_id FROM equipment WHERE unit_number = ? OR id = ? (equipment lookup)
    mockQuery
      .mockResolvedValueOnce([[loadWithEquipmentId]]) // loads fetch
      .mockResolvedValueOnce([stops]) // load_legs fetch
      .mockResolvedValueOnce([[{ company_id: "company-aaa" }]]) // driver lookup
      .mockResolvedValueOnce([[{ company_id: "company-aaa" }]]); // equipment lookup

    // mockExecute for UPDATE + INSERT inside transaction
    mockExecute
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE loads
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT dispatch_events

    await loadService.transitionLoad(
      "load-abc",
      "dispatched" as any,
      "company-aaa",
      "user-1",
    );

    // Find the equipment lookup call
    const equipmentLookupCall = mockQuery.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" &&
        c[0].includes("FROM equipment WHERE unit_number = ? OR id = ?"),
    );

    expect(equipmentLookupCall).toBeDefined();
    // Parameters should be ['EQ-001', 'EQ-001'] — NOT 'CHASS-999'
    expect(equipmentLookupCall![1]).toEqual(["EQ-001", "EQ-001"]);
  });

  // Tests R-P4-06
  it("Tests R-P4-06 — falls back to chassis_number when equipment_id is null", async () => {
    const loadWithChassisOnly = {
      id: "load-def",
      company_id: "company-aaa",
      status: "planned",
      version: 1,
      driver_id: "driver-1",
      equipment_id: null,
      chassis_number: "CHASS-999",
      container_number: null,
    };

    const stops = [
      {
        id: "stop-3",
        load_id: "load-def",
        type: "Pickup",
        completed: false,
        sequence_order: 0,
      },
      {
        id: "stop-4",
        load_id: "load-def",
        type: "Dropoff",
        completed: false,
        sequence_order: 1,
      },
    ];

    mockQuery
      .mockResolvedValueOnce([[loadWithChassisOnly]])
      .mockResolvedValueOnce([stops])
      .mockResolvedValueOnce([[{ company_id: "company-aaa" }]])
      .mockResolvedValueOnce([[{ company_id: "company-aaa" }]]);

    mockExecute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await loadService.transitionLoad(
      "load-def",
      "dispatched" as any,
      "company-aaa",
      "user-1",
    );

    const equipmentLookupCall = mockQuery.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" &&
        c[0].includes("FROM equipment WHERE unit_number = ? OR id = ?"),
    );

    expect(equipmentLookupCall).toBeDefined();
    // Should use chassis_number as fallback
    expect(equipmentLookupCall![1]).toEqual(["CHASS-999", "CHASS-999"]);
  });
});

// ── R-P4-07 / R-P4-08: validateDispatchGuards regression assertions ───────────

describe("R-P4-07 — validateDispatchGuards passes with valid equipmentId", () => {
  // Tests R-P4-07
  it("Tests R-P4-07 — passes when equipmentId is provided along with driver and stops", () => {
    expect(() =>
      validateDispatchGuards({
        loadId: "load-1",
        companyId: "company-aaa",
        driverId: "driver-1",
        equipmentId: "EQ-001",
        stops: [
          { type: "Pickup", completed: false },
          { type: "Dropoff", completed: false },
        ],
        driverCompanyId: "company-aaa",
        equipmentCompanyId: "company-aaa",
      }),
    ).not.toThrow();
  });

  // Tests R-P4-07
  it("Tests R-P4-07 — passes when equipmentCompanyId is null (unregistered equipment)", () => {
    expect(() =>
      validateDispatchGuards({
        loadId: "load-1",
        companyId: "company-aaa",
        driverId: "driver-1",
        equipmentId: "EQ-001",
        stops: [
          { type: "Pickup", completed: false },
          { type: "Dropoff", completed: false },
        ],
        driverCompanyId: "company-aaa",
        equipmentCompanyId: null,
      }),
    ).not.toThrow();
  });
});

describe("R-P4-08 — validateDispatchGuards fails with 'equipment' when equipmentId is null", () => {
  // Tests R-P4-08
  it("Tests R-P4-08 — throws BusinessRuleError with 'equipment' in message when equipmentId is null", () => {
    expect(() =>
      validateDispatchGuards({
        loadId: "load-2",
        companyId: "company-aaa",
        driverId: "driver-1",
        equipmentId: null,
        stops: [
          { type: "Pickup", completed: false },
          { type: "Dropoff", completed: false },
        ],
        driverCompanyId: "company-aaa",
        equipmentCompanyId: null,
      }),
    ).toThrow(/equipment/i);
  });

  // Tests R-P4-08
  it("Tests R-P4-08 — error message specifically mentions equipment assignment requirement", () => {
    let caughtError: Error | null = null;
    try {
      validateDispatchGuards({
        loadId: "load-3",
        companyId: "company-aaa",
        driverId: "driver-1",
        equipmentId: null,
        stops: [
          { type: "Pickup", completed: false },
          { type: "Dropoff", completed: false },
        ],
        driverCompanyId: "company-aaa",
        equipmentCompanyId: null,
      });
    } catch (e) {
      caughtError = e as Error;
    }
    expect(caughtError).not.toBeNull();
    expect(caughtError!.message.toLowerCase()).toContain("equipment");
  });
});
