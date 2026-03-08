import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P2-02-AC2, R-P2-02-AC3

// --- Mock setup (hoisted so vi.mock factory can reference them) ---
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

import { loadService } from "../../services/load.service";
import { LoadStatus } from "../../services/load-state-machine";
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../errors/AppError";

// --- Constants ---
const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";
const USER_ID = "user-001";

const makeLoadRow = (overrides: Record<string, unknown> = {}) => ({
  id: "load-001",
  company_id: COMPANY_A,
  customer_id: "cust-1",
  driver_id: "driver-1",
  dispatcher_id: "disp-1",
  load_number: "LD-001",
  status: "draft",
  carrier_rate: 1500,
  driver_pay: 800,
  pickup_date: "2026-03-10",
  freight_type: "Dry Van",
  commodity: "Electronics",
  weight: 42000,
  container_number: null,
  container_size: null,
  chassis_number: null,
  chassis_provider: null,
  bol_number: "BOL-001",
  notification_emails: "[]",
  contract_id: null,
  gps_history: "[]",
  pod_urls: "[]",
  customer_user_id: null,
  created_at: "2026-03-07T00:00:00.000Z",
  version: 1,
  ...overrides,
});

const makeStopRow = (overrides: Record<string, unknown> = {}) => ({
  id: "stop-001",
  load_id: "load-001",
  type: "Pickup",
  facility_name: "Warehouse A",
  city: "Chicago",
  state: "IL",
  date: "2026-03-10",
  appointment_time: "08:00",
  completed: false,
  sequence_order: 0,
  ...overrides,
});

describe("R-P2-02: Load Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  describe("AC3: transitionLoad — atomic status + event + version", () => {
    it("successfully transitions draft to planned within a transaction", async () => {
      // Mock: fetch load with version
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 1 })],
        [],
      ]);
      // Mock: fetch stops (not needed for draft->planned, but service fetches them)
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);

      // Inside transaction:
      // Mock: UPDATE loads SET status, version WHERE id AND version (optimistic lock)
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      // Mock: INSERT dispatch_event
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);

      const result = await loadService.transitionLoad(
        "load-001",
        LoadStatus.PLANNED,
        COMPANY_A,
        USER_ID,
      );

      expect(result).toBeDefined();
      // Transaction lifecycle
      expect(mockGetConnection).toHaveBeenCalledOnce();
      expect(mockBeginTransaction).toHaveBeenCalledOnce();
      expect(mockCommit).toHaveBeenCalledOnce();
      expect(mockRollback).not.toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalledOnce();
    });

    it("increments version on successful transition", async () => {
      // Load at version 5
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 5 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);

      await loadService.transitionLoad(
        "load-001",
        LoadStatus.PLANNED,
        COMPANY_A,
        USER_ID,
      );

      // The UPDATE should use version = 5 in WHERE and set version = 6
      const updateCall = mockExecute.mock.calls[0];
      const updateSql = updateCall[0] as string;
      const updateParams = updateCall[1] as unknown[];
      expect(updateSql).toContain("version");
      // Params should include: new_status, new_version, load_id, company_id, old_version
      expect(updateParams).toContain(6); // new version
      expect(updateParams).toContain(5); // old version in WHERE
    });

    it("creates dispatch_event record for every transition", async () => {
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 1 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);

      await loadService.transitionLoad(
        "load-001",
        LoadStatus.PLANNED,
        COMPANY_A,
        USER_ID,
      );

      // Second execute call is the dispatch_event insert
      const eventCall = mockExecute.mock.calls[1];
      const eventSql = eventCall[0] as string;
      const eventParams = eventCall[1] as unknown[];
      expect(eventSql).toContain("INSERT INTO dispatch_events");
      expect(eventParams).toContain("load-001"); // load_id
      expect(eventParams).toContain(USER_ID); // dispatcher_id
    });

    it("throws ConflictError when version is stale (optimistic locking)", async () => {
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 3 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);
      // UPDATE returns 0 affected rows (stale version)
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      await expect(
        loadService.transitionLoad(
          "load-001",
          LoadStatus.PLANNED,
          COMPANY_A,
          USER_ID,
        ),
      ).rejects.toThrow(ConflictError);

      // Transaction should be rolled back
      expect(mockRollback).toHaveBeenCalledOnce();
      expect(mockCommit).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when load does not exist", async () => {
      mockQuery.mockResolvedValueOnce([[], []]); // no rows

      await expect(
        loadService.transitionLoad(
          "nonexistent",
          LoadStatus.PLANNED,
          COMPANY_A,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when load belongs to different tenant", async () => {
      mockQuery.mockResolvedValueOnce([[], []]); // query scoped by company_id returns nothing

      await expect(
        loadService.transitionLoad(
          "load-001",
          LoadStatus.PLANNED,
          COMPANY_B,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws BusinessRuleError for invalid transition", async () => {
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 1 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);

      await expect(
        loadService.transitionLoad(
          "load-001",
          LoadStatus.COMPLETED,
          COMPANY_A,
          USER_ID,
        ),
      ).rejects.toThrow(BusinessRuleError);

      // No transaction should be started for invalid transitions
      expect(mockGetConnection).not.toHaveBeenCalled();
    });

    it("rolls back transaction on unexpected error", async () => {
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 1 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);
      // UPDATE succeeds
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      // INSERT dispatch_event fails
      mockExecute.mockRejectedValueOnce(new Error("DB connection lost"));

      await expect(
        loadService.transitionLoad(
          "load-001",
          LoadStatus.PLANNED,
          COMPANY_A,
          USER_ID,
        ),
      ).rejects.toThrow("DB connection lost");

      expect(mockRollback).toHaveBeenCalledOnce();
      expect(mockCommit).not.toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalledOnce();
    });
  });

  describe("AC2: transitionLoad — dispatch guard enforcement", () => {
    it("validates dispatch guards when transitioning to dispatched", async () => {
      const load = makeLoadRow({
        status: "planned",
        version: 1,
        driver_id: "driver-1",
        chassis_number: "CHASSIS-001",
      });
      mockQuery.mockResolvedValueOnce([[load], []]);
      // Stops include pickup and dropoff
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);

      // For dispatch, we also need to look up driver and equipment company_ids
      // Mock: driver company lookup
      mockQuery.mockResolvedValueOnce([[{ company_id: COMPANY_A }], []]);
      // Mock: equipment lookup by chassis_number
      mockQuery.mockResolvedValueOnce([[{ company_id: COMPANY_A }], []]);

      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);

      await expect(
        loadService.transitionLoad(
          "load-001",
          LoadStatus.DISPATCHED,
          COMPANY_A,
          USER_ID,
        ),
      ).resolves.toBeDefined();
    });

    it("rejects dispatch when driver is missing", async () => {
      const load = makeLoadRow({
        status: "planned",
        version: 1,
        driver_id: null,
      });
      mockQuery.mockResolvedValueOnce([[load], []]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);

      try {
        await loadService.transitionLoad(
          "load-001",
          LoadStatus.DISPATCHED,
          COMPANY_A,
          USER_ID,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleError);
        expect((err as Error).message).toMatch(/driver/i);
      }
    });

    it("rejects dispatch when pickup stop is missing", async () => {
      const load = makeLoadRow({
        status: "planned",
        version: 1,
        driver_id: "driver-1",
        chassis_number: "CHASSIS-001",
      });
      mockQuery.mockResolvedValueOnce([[load], []]);
      // Only dropoff stop
      mockQuery.mockResolvedValueOnce([
        [makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 })],
        [],
      ]);
      // Driver company lookup
      mockQuery.mockResolvedValueOnce([[{ company_id: COMPANY_A }], []]);
      // Equipment company lookup
      mockQuery.mockResolvedValueOnce([[{ company_id: COMPANY_A }], []]);

      try {
        await loadService.transitionLoad(
          "load-001",
          LoadStatus.DISPATCHED,
          COMPANY_A,
          USER_ID,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleError);
        expect((err as Error).message).toMatch(/pickup/i);
      }
    });

    it("rejects dispatch when dropoff stop is missing", async () => {
      const load = makeLoadRow({
        status: "planned",
        version: 1,
        driver_id: "driver-1",
        chassis_number: "CHASSIS-001",
      });
      mockQuery.mockResolvedValueOnce([[load], []]);
      // Only pickup stop
      mockQuery.mockResolvedValueOnce([[makeStopRow({ type: "Pickup" })], []]);
      // Driver company lookup
      mockQuery.mockResolvedValueOnce([[{ company_id: COMPANY_A }], []]);
      // Equipment company lookup
      mockQuery.mockResolvedValueOnce([[{ company_id: COMPANY_A }], []]);

      try {
        await loadService.transitionLoad(
          "load-001",
          LoadStatus.DISPATCHED,
          COMPANY_A,
          USER_ID,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleError);
        expect((err as Error).message).toMatch(/dropoff/i);
      }
    });

    it("does not run dispatch guards for non-dispatch transitions", async () => {
      // draft -> planned should not trigger dispatch guards
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 1 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);

      // Should succeed even without driver/equipment because it's not a dispatch transition
      const draftLoad = makeLoadRow({
        status: "draft",
        version: 1,
        driver_id: null,
      });
      mockQuery.mockResolvedValueOnce([[draftLoad], []]);
      mockQuery.mockResolvedValueOnce([[], []]); // no stops
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);

      // draft -> cancelled should work without driver/stops
      await expect(
        loadService.transitionLoad(
          "load-001",
          LoadStatus.CANCELLED,
          COMPANY_A,
          USER_ID,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe("AC3: dispatch_event includes transition metadata in formal columns", () => {
    it("event INSERT includes actor_id, prior_state, next_state, correlation_id columns", async () => {
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 1 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);

      await loadService.transitionLoad(
        "load-001",
        LoadStatus.PLANNED,
        COMPANY_A,
        USER_ID,
      );

      // Second execute call is dispatch_event INSERT
      const eventCall = mockExecute.mock.calls[1];
      const eventSql = eventCall[0] as string;
      const eventParams = eventCall[1] as unknown[];

      // SQL should reference formal audit columns
      expect(eventSql).toContain("actor_id");
      expect(eventSql).toContain("prior_state");
      expect(eventSql).toContain("next_state");
      expect(eventSql).toContain("correlation_id");

      // Params should include prior_state and next_state as direct values
      expect(eventParams).toContain("draft"); // prior_state
      expect(eventParams).toContain("planned"); // next_state
      expect(eventParams).toContain(USER_ID); // actor_id
    });
  });
});
