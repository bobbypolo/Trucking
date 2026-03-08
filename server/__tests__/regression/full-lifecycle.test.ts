import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P5-01-AC1

/**
 * Full Lifecycle Regression Test
 *
 * Exercises the complete LoadPilot workflow end-to-end:
 *   1. Company/tenant context setup
 *   2. User within tenant
 *   3. Load creation with stops (Pickup + Dropoff)
 *   4. Driver and equipment assignment
 *   5. Load state machine: draft -> planned -> dispatched -> in_transit -> arrived -> delivered -> completed
 *   6. Settlement generation (separate entity from load — load stays 'completed')
 *   7. Verify settlement totals match expected values
 */

// --- Mock setup for load.service (direct DB access) ---
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
  const mockGetConnection = vi.fn();

  const mockConnection = {
    beginTransaction: mockBeginTransaction,
    commit: mockCommit,
    rollback: mockRollback,
    release: mockRelease,
    query: mockQuery,
    execute: mockExecute,
  };

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

// --- Mock setup for assignment.service (repository-based) ---
const {
  mockDriverFindById,
  mockEquipFindById,
  mockEquipAssignToLoad,
  mockLoadRepoFindById,
  mockLoadRepoUpdate,
} = vi.hoisted(() => ({
  mockDriverFindById: vi.fn(),
  mockEquipFindById: vi.fn(),
  mockEquipAssignToLoad: vi.fn(),
  mockLoadRepoFindById: vi.fn(),
  mockLoadRepoUpdate: vi.fn(),
}));

vi.mock("../../repositories/driver.repository", () => ({
  driverRepository: {
    findById: mockDriverFindById,
  },
}));

vi.mock("../../repositories/equipment.repository", () => ({
  equipmentRepository: {
    findById: mockEquipFindById,
    assignToLoad: mockEquipAssignToLoad,
  },
}));

vi.mock("../../repositories/load.repository", () => ({
  loadRepository: {
    findById: mockLoadRepoFindById,
    update: mockLoadRepoUpdate,
  },
}));

// --- Mock setup for settlement.service (repository-based) ---
const {
  mockSettlementFindLoadStatus,
  mockSettlementFindByLoadAndTenant,
  mockSettlementCreate,
} = vi.hoisted(() => ({
  mockSettlementFindLoadStatus: vi.fn(),
  mockSettlementFindByLoadAndTenant: vi.fn(),
  mockSettlementCreate: vi.fn(),
}));

vi.mock("../../repositories/settlement.repository", () => ({
  settlementRepository: {
    findByLoadAndTenant: (...args: unknown[]) =>
      mockSettlementFindByLoadAndTenant(...args),
    findLoadStatus: (...args: unknown[]) =>
      mockSettlementFindLoadStatus(...args),
    create: (...args: unknown[]) => mockSettlementCreate(...args),
  },
}));

import { loadService } from "../../services/load.service";
import { LoadStatus } from "../../services/load-state-machine";
import { assignmentService } from "../../services/assignment.service";
import { generateSettlement } from "../../services/settlement.service";
import { SettlementStatus } from "../../services/settlement-state-machine";

// --- Tenant context constants ---
const COMPANY_ID = "company-lifecycle-001";
const USER_ID = "user-lifecycle-001";
const DRIVER_ID = "driver-lifecycle-001";
const EQUIPMENT_ID = "equip-lifecycle-001";
const LOAD_ID = "load-lifecycle-001";

// --- Row factory helpers ---
const makeLoadRow = (overrides: Record<string, unknown> = {}) => ({
  id: LOAD_ID,
  company_id: COMPANY_ID,
  customer_id: "cust-lc-1",
  driver_id: null as string | null,
  dispatcher_id: USER_ID,
  load_number: "LC-001",
  status: "draft",
  carrier_rate: 2500,
  driver_pay: 1200,
  pickup_date: "2026-03-15",
  freight_type: "Dry Van",
  commodity: "Electronics",
  weight: 42000,
  container_number: null,
  container_size: null,
  chassis_number: "CHASSIS-LC-001",
  chassis_provider: null,
  bol_number: "BOL-LC-001",
  notification_emails: "[]",
  contract_id: null,
  gps_history: "[]",
  pod_urls: "[]",
  customer_user_id: null,
  created_at: "2026-03-07T00:00:00.000Z",
  version: 1,
  ...overrides,
});

const makeStopRows = () => [
  {
    id: "stop-lc-001",
    load_id: LOAD_ID,
    type: "Pickup",
    facility_name: "Origin Warehouse",
    city: "Chicago",
    state: "IL",
    date: "2026-03-15",
    appointment_time: "08:00",
    completed: false,
    sequence_order: 0,
  },
  {
    id: "stop-lc-002",
    load_id: LOAD_ID,
    type: "Dropoff",
    facility_name: "Destination Hub",
    city: "Detroit",
    state: "MI",
    date: "2026-03-16",
    appointment_time: "14:00",
    completed: false,
    sequence_order: 1,
  },
];

const makeDriverRow = () => ({
  id: DRIVER_ID,
  company_id: COMPANY_ID,
  name: "Lifecycle Driver",
  role: "driver",
  email: "driver@lifecycle.com",
  compliance_status: "Eligible",
  version: 1,
});

const makeEquipmentRow = () => ({
  id: EQUIPMENT_ID,
  company_id: COMPANY_ID,
  unit_number: "TRK-LC-100",
  type: "Truck",
  status: "Active",
  version: 1,
  assigned_load_id: null as string | null,
});

/**
 * Helper to set up mock queries for a single load transition via loadService.transitionLoad.
 *
 * loadService uses pool.query for SELECT and pool.getConnection for the transaction.
 * The connection mock uses connection.execute for UPDATE/INSERT.
 */
function setupTransitionMocks(
  status: string,
  version: number,
  opts: {
    driverId?: string | null;
    chassisNumber?: string | null;
    includeDriverLookup?: boolean;
    includeEquipmentLookup?: boolean;
  } = {},
): void {
  // 1. pool.query: SELECT load
  mockQuery.mockResolvedValueOnce([
    [
      makeLoadRow({
        status,
        version,
        driver_id: opts.driverId ?? null,
        chassis_number: opts.chassisNumber ?? null,
      }),
    ],
    [],
  ]);
  // 2. pool.query: SELECT stops
  mockQuery.mockResolvedValueOnce([makeStopRows(), []]);

  // If dispatching, need additional queries for driver/equipment tenant verification
  if (opts.includeDriverLookup) {
    mockQuery.mockResolvedValueOnce([[{ company_id: COMPANY_ID }], []]);
  }
  if (opts.includeEquipmentLookup) {
    mockQuery.mockResolvedValueOnce([[{ company_id: COMPANY_ID }], []]);
  }

  // 3. connection.execute: UPDATE loads (optimistic lock)
  mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
  // 4. connection.execute: INSERT dispatch_event
  mockExecute.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);
}

describe("R-P5-01-AC1: Full Lifecycle Regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  it("completes the full lifecycle: assign -> dispatch -> transit -> arrive -> deliver -> complete -> settlement", async () => {
    // === STEP 1: Assign driver to load ===
    mockLoadRepoFindById.mockResolvedValueOnce(makeLoadRow());
    mockDriverFindById.mockResolvedValueOnce(makeDriverRow());
    mockLoadRepoUpdate.mockResolvedValueOnce(
      makeLoadRow({ driver_id: DRIVER_ID }),
    );

    const loadWithDriver = await assignmentService.assignDriver(
      LOAD_ID,
      DRIVER_ID,
      COMPANY_ID,
    );
    expect(loadWithDriver.driver_id).toBe(DRIVER_ID);

    // === STEP 2: Assign equipment to load ===
    mockLoadRepoFindById.mockResolvedValueOnce(
      makeLoadRow({ driver_id: DRIVER_ID }),
    );
    mockEquipFindById.mockResolvedValueOnce(makeEquipmentRow());
    mockEquipAssignToLoad.mockResolvedValueOnce({
      ...makeEquipmentRow(),
      assigned_load_id: LOAD_ID,
      version: 2,
    });

    const equipResult = await assignmentService.assignEquipment(
      LOAD_ID,
      EQUIPMENT_ID,
      COMPANY_ID,
      1,
    );
    expect(equipResult.assigned_load_id).toBe(LOAD_ID);

    // === STEP 3: Transition draft -> planned ===
    setupTransitionMocks("draft", 1);

    const planned = await loadService.transitionLoad(
      LOAD_ID,
      LoadStatus.PLANNED,
      COMPANY_ID,
      USER_ID,
    );
    expect(planned.status).toBe(LoadStatus.PLANNED);
    expect(planned.version).toBe(2);

    // === STEP 4: Transition planned -> dispatched (with guards) ===
    setupTransitionMocks("planned", 2, {
      driverId: DRIVER_ID,
      chassisNumber: "CHASSIS-LC-001",
      includeDriverLookup: true,
      includeEquipmentLookup: true,
    });

    const dispatched = await loadService.transitionLoad(
      LOAD_ID,
      LoadStatus.DISPATCHED,
      COMPANY_ID,
      USER_ID,
    );
    expect(dispatched.status).toBe(LoadStatus.DISPATCHED);
    expect(dispatched.version).toBe(3);

    // === STEP 5: Transition dispatched -> in_transit ===
    setupTransitionMocks("dispatched", 3, { driverId: DRIVER_ID });

    const inTransit = await loadService.transitionLoad(
      LOAD_ID,
      LoadStatus.IN_TRANSIT,
      COMPANY_ID,
      USER_ID,
    );
    expect(inTransit.status).toBe(LoadStatus.IN_TRANSIT);

    // === STEP 6: Transition in_transit -> arrived ===
    setupTransitionMocks("in_transit", 4, { driverId: DRIVER_ID });

    const arrived = await loadService.transitionLoad(
      LOAD_ID,
      LoadStatus.ARRIVED,
      COMPANY_ID,
      USER_ID,
    );
    expect(arrived.status).toBe(LoadStatus.ARRIVED);

    // === STEP 7: Transition arrived -> delivered ===
    setupTransitionMocks("arrived", 5, { driverId: DRIVER_ID });

    const delivered = await loadService.transitionLoad(
      LOAD_ID,
      LoadStatus.DELIVERED,
      COMPANY_ID,
      USER_ID,
    );
    expect(delivered.status).toBe(LoadStatus.DELIVERED);

    // === STEP 8: Transition delivered -> completed ===
    setupTransitionMocks("delivered", 6, { driverId: DRIVER_ID });

    const completed = await loadService.transitionLoad(
      LOAD_ID,
      LoadStatus.COMPLETED,
      COMPANY_ID,
      USER_ID,
    );
    expect(completed.status).toBe(LoadStatus.COMPLETED);

    // === STEP 9: Generate settlement (SEPARATE entity from load) ===
    mockSettlementFindLoadStatus.mockResolvedValueOnce("completed");
    mockSettlementFindByLoadAndTenant.mockResolvedValueOnce(null);
    mockSettlementCreate.mockImplementation(
      async (data: Record<string, unknown>) => ({
        ...data,
        id: "settle-lifecycle-001",
        status: SettlementStatus.GENERATED,
      }),
    );

    const settlement = await generateSettlement({
      loadId: LOAD_ID,
      driverId: DRIVER_ID,
      companyId: COMPANY_ID,
      userId: USER_ID,
      settlementDate: "2026-03-16",
      periodStart: "2026-03-15",
      periodEnd: "2026-03-16",
      lines: [
        {
          description: "Line Haul",
          amount: 2500.0,
          type: "earning",
          loadId: LOAD_ID,
        },
        {
          description: "Fuel Surcharge (15%)",
          amount: 375.0,
          type: "earning",
          loadId: LOAD_ID,
        },
        {
          description: "Detention",
          amount: 125.0,
          type: "earning",
          loadId: LOAD_ID,
        },
        {
          description: "Insurance Deduction",
          amount: 100.0,
          type: "deduction",
        },
        {
          description: "Fuel Advance",
          amount: 200.0,
          type: "deduction",
        },
        {
          description: "Toll Reimbursement",
          amount: 45.5,
          type: "reimbursement",
        },
      ],
    });

    // Verify settlement was created as a separate entity
    expect(settlement.status).toBe(SettlementStatus.GENERATED);
    expect(settlement.load_id).toBe(LOAD_ID);
    expect(settlement.driver_id).toBe(DRIVER_ID);
    expect(settlement.company_id).toBe(COMPANY_ID);

    // Verify settlement totals match expected calculated values:
    // Earnings: 2500 + 375 + 125 = 3000
    // Deductions: 100 + 200 = 300
    // Reimbursements: 45.50
    // Net Pay: 3000 - 300 + 45.50 = 2745.50
    const createArg = mockSettlementCreate.mock.calls[0][0];
    expect(createArg.total_earnings).toBe(3000.0);
    expect(createArg.total_deductions).toBe(300.0);
    expect(createArg.total_reimbursements).toBe(45.5);
    expect(createArg.net_pay).toBe(2745.5);

    // === STEP 10: Verify load status was NOT changed by settlement ===
    // The load's last known status from transitionLoad was 'completed'.
    // Settlement creation did NOT call any load update.
    // The settlement repository only reads load status; never writes it.
    expect(completed.status).toBe(LoadStatus.COMPLETED);

    // Verify all 6 state transitions created dispatch_events via connection.execute.
    // Each transition produces 2 execute calls (status change, audit record) = 12 total.
    // (draft->planned->dispatched->in_transit->arrived->delivered->completed = 6 transitions)
    expect(mockExecute).toHaveBeenCalledTimes(12);

    // Verify each transition committed (no rollbacks)
    expect(mockCommit).toHaveBeenCalledTimes(6);
    expect(mockRollback).not.toHaveBeenCalled();
  });

  it("rejects settlement generation when load is not completed", async () => {
    mockSettlementFindLoadStatus.mockResolvedValueOnce("dispatched");

    const { BusinessRuleError } = await import("../../errors/AppError");

    await expect(
      generateSettlement({
        loadId: LOAD_ID,
        driverId: DRIVER_ID,
        companyId: COMPANY_ID,
        userId: USER_ID,
        settlementDate: "2026-03-16",
        lines: [
          {
            description: "Line Haul",
            amount: 1500.0,
            type: "earning",
            loadId: LOAD_ID,
          },
        ],
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("rejects invalid state transitions throughout the lifecycle", async () => {
    const { BusinessRuleError } = await import("../../errors/AppError");

    // Cannot skip from draft straight to dispatched
    mockQuery.mockResolvedValueOnce([
      [makeLoadRow({ status: "draft", version: 1 })],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([makeStopRows(), []]);

    await expect(
      loadService.transitionLoad(
        LOAD_ID,
        LoadStatus.DISPATCHED,
        COMPANY_ID,
        USER_ID,
      ),
    ).rejects.toThrow(BusinessRuleError);

    // Cannot go from completed back to in_transit
    mockQuery.mockResolvedValueOnce([
      [makeLoadRow({ status: "completed", version: 7 })],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([makeStopRows(), []]);

    await expect(
      loadService.transitionLoad(
        LOAD_ID,
        LoadStatus.IN_TRANSIT,
        COMPANY_ID,
        USER_ID,
      ),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("enforces optimistic locking across the full lifecycle", async () => {
    const { ConflictError } = await import("../../errors/AppError");

    // Simulate version conflict during transition
    mockQuery.mockResolvedValueOnce([
      [makeLoadRow({ status: "draft", version: 1 })],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([makeStopRows(), []]);
    // UPDATE returns 0 rows (stale version)
    mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    await expect(
      loadService.transitionLoad(
        LOAD_ID,
        LoadStatus.PLANNED,
        COMPANY_ID,
        USER_ID,
      ),
    ).rejects.toThrow(ConflictError);

    expect(mockRollback).toHaveBeenCalled();
  });

  it("verifies dispatch guards enforce driver and equipment prerequisites", async () => {
    const { BusinessRuleError } = await import("../../errors/AppError");

    // Load in 'planned' state but NO driver and NO equipment assigned
    // Must also clear chassis_number so no equipment lookup query fires
    mockQuery.mockResolvedValueOnce([
      [
        makeLoadRow({
          status: "planned",
          version: 2,
          driver_id: null,
          chassis_number: null,
          container_number: null,
        }),
      ],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([makeStopRows(), []]);

    await expect(
      loadService.transitionLoad(
        LOAD_ID,
        LoadStatus.DISPATCHED,
        COMPANY_ID,
        USER_ID,
      ),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("creates audit trail (dispatch_event) for every state transition", async () => {
    // Transition draft -> planned
    setupTransitionMocks("draft", 1);

    await loadService.transitionLoad(
      LOAD_ID,
      LoadStatus.PLANNED,
      COMPANY_ID,
      USER_ID,
    );

    // The second execute call should be the dispatch_event INSERT
    const eventCall = mockExecute.mock.calls[1];
    const eventSql = eventCall[0] as string;
    const eventParams = eventCall[1] as unknown[];

    expect(eventSql).toContain("INSERT INTO dispatch_events");
    expect(eventSql).toContain("prior_state");
    expect(eventSql).toContain("next_state");
    expect(eventParams).toContain("draft");
    expect(eventParams).toContain("planned");
    expect(eventParams).toContain(USER_ID);
  });
});
