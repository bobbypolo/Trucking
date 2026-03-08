import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P2-03-AC1, R-P2-03-AC2

// --- Mock setup (hoisted so vi.mock factory can reference them) ---
const {
  mockDriverFindById,
  mockEquipFindById,
  mockEquipAssignToLoad,
  mockLoadFindById,
  mockLoadUpdate,
} = vi.hoisted(() => {
  return {
    mockDriverFindById: vi.fn(),
    mockEquipFindById: vi.fn(),
    mockEquipAssignToLoad: vi.fn(),
    mockLoadFindById: vi.fn(),
    mockLoadUpdate: vi.fn(),
  };
});

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
    findById: mockLoadFindById,
    update: mockLoadUpdate,
  },
}));

import { assignmentService } from "../../services/assignment.service";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
} from "../../errors/AppError";

// --- Constants ---
const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";

const makeLoadRow = (overrides: Record<string, unknown> = {}) => ({
  id: "load-001",
  company_id: COMPANY_A,
  driver_id: null,
  status: "draft",
  version: 1,
  ...overrides,
});

const makeDriverRow = (overrides: Record<string, unknown> = {}) => ({
  id: "driver-001",
  company_id: COMPANY_A,
  name: "John Doe",
  role: "driver",
  compliance_status: "Eligible",
  version: 1,
  ...overrides,
});

const makeEquipmentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "equip-001",
  company_id: COMPANY_A,
  unit_number: "TRK-100",
  type: "Truck",
  status: "Active",
  version: 1,
  assigned_load_id: null,
  ...overrides,
});

describe("R-P2-03: Assignment Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: assignDriver — validates driver exists, same company, eligible compliance", () => {
    it("successfully assigns a driver to a load", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockDriverFindById.mockResolvedValueOnce(makeDriverRow());
      mockLoadUpdate.mockResolvedValueOnce(
        makeLoadRow({ driver_id: "driver-001" }),
      );

      const result = await assignmentService.assignDriver(
        "load-001",
        "driver-001",
        COMPANY_A,
      );

      expect(result.driver_id).toBe("driver-001");
      expect(mockLoadUpdate).toHaveBeenCalledWith(
        "load-001",
        { driver_id: "driver-001" },
        COMPANY_A,
      );
    });

    it("throws NotFoundError when load does not exist", async () => {
      mockLoadFindById.mockResolvedValueOnce(null);

      await expect(
        assignmentService.assignDriver("load-999", "driver-001", COMPANY_A),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when driver does not exist", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockDriverFindById.mockResolvedValueOnce(null);

      await expect(
        assignmentService.assignDriver("load-001", "driver-999", COMPANY_A),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when driver belongs to different company (cross-tenant)", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      // Driver exists but is found when queried with its own company, not COMPANY_A
      mockDriverFindById.mockResolvedValueOnce(null);

      await expect(
        assignmentService.assignDriver("load-001", "driver-001", COMPANY_A),
      ).rejects.toThrow(NotFoundError);

      // More explicit cross-tenant: driver found with different company_id
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockDriverFindById.mockResolvedValueOnce(
        makeDriverRow({ company_id: COMPANY_B }),
      );

      await expect(
        assignmentService.assignDriver("load-001", "driver-001", COMPANY_A),
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws BusinessRuleError when driver compliance is Restricted", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockDriverFindById.mockResolvedValueOnce(
        makeDriverRow({ compliance_status: "Restricted" }),
      );

      await expect(
        assignmentService.assignDriver("load-001", "driver-001", COMPANY_A),
      ).rejects.toThrow(BusinessRuleError);
    });

    it("returns 403 status code for cross-tenant assignment attempt", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockDriverFindById.mockResolvedValueOnce(
        makeDriverRow({ company_id: COMPANY_B }),
      );

      try {
        await assignmentService.assignDriver(
          "load-001",
          "driver-001",
          COMPANY_A,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenError);
        expect((err as ForbiddenError).statusCode).toBe(403);
      }
    });
  });

  describe("AC1: assignEquipment — validates equipment exists, same company, correct status", () => {
    it("successfully assigns equipment to a load", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockEquipFindById.mockResolvedValueOnce(makeEquipmentRow());
      mockEquipAssignToLoad.mockResolvedValueOnce(
        makeEquipmentRow({ assigned_load_id: "load-001", version: 2 }),
      );

      const result = await assignmentService.assignEquipment(
        "load-001",
        "equip-001",
        COMPANY_A,
        1, // expected version
      );

      expect(result.assigned_load_id).toBe("load-001");
      expect(result.version).toBe(2);
    });

    it("throws NotFoundError when load does not exist", async () => {
      mockLoadFindById.mockResolvedValueOnce(null);

      await expect(
        assignmentService.assignEquipment(
          "load-999",
          "equip-001",
          COMPANY_A,
          1,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when equipment does not exist", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockEquipFindById.mockResolvedValueOnce(null);

      await expect(
        assignmentService.assignEquipment(
          "load-001",
          "equip-999",
          COMPANY_A,
          1,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when equipment belongs to different company (cross-tenant)", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockEquipFindById.mockResolvedValueOnce(
        makeEquipmentRow({ company_id: COMPANY_B }),
      );

      try {
        await assignmentService.assignEquipment(
          "load-001",
          "equip-001",
          COMPANY_A,
          1,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenError);
        expect((err as ForbiddenError).statusCode).toBe(403);
      }
    });

    it("throws BusinessRuleError when equipment status is Out of Service", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockEquipFindById.mockResolvedValueOnce(
        makeEquipmentRow({ status: "Out of Service" }),
      );

      await expect(
        assignmentService.assignEquipment(
          "load-001",
          "equip-001",
          COMPANY_A,
          1,
        ),
      ).rejects.toThrow(BusinessRuleError);
    });

    it("throws BusinessRuleError when equipment status is Removed", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockEquipFindById.mockResolvedValueOnce(
        makeEquipmentRow({ status: "Removed" }),
      );

      await expect(
        assignmentService.assignEquipment(
          "load-001",
          "equip-001",
          COMPANY_A,
          1,
        ),
      ).rejects.toThrow(BusinessRuleError);
    });
  });

  describe("AC2: assignEquipment — optimistic locking enforcement", () => {
    it("throws ConflictError when version mismatch (equipment already modified)", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockEquipFindById.mockResolvedValueOnce(makeEquipmentRow({ version: 5 }));
      // assignToLoad returns null when version doesn't match
      mockEquipAssignToLoad.mockResolvedValueOnce(null);

      await expect(
        assignmentService.assignEquipment(
          "load-001",
          "equip-001",
          COMPANY_A,
          5,
        ),
      ).rejects.toThrow(ConflictError);
    });

    it("returns 409 status code for concurrent assignment conflict", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockEquipFindById.mockResolvedValueOnce(makeEquipmentRow({ version: 1 }));
      mockEquipAssignToLoad.mockResolvedValueOnce(null);

      try {
        await assignmentService.assignEquipment(
          "load-001",
          "equip-001",
          COMPANY_A,
          1,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect((err as ConflictError).statusCode).toBe(409);
      }
    });

    it("simulates concurrent assignment: first succeeds, second gets 409", async () => {
      // First assignment succeeds
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockEquipFindById.mockResolvedValueOnce(makeEquipmentRow({ version: 1 }));
      mockEquipAssignToLoad.mockResolvedValueOnce(
        makeEquipmentRow({ assigned_load_id: "load-001", version: 2 }),
      );

      const result1 = await assignmentService.assignEquipment(
        "load-001",
        "equip-001",
        COMPANY_A,
        1,
      );
      expect(result1.assigned_load_id).toBe("load-001");

      // Second concurrent assignment: caller read equipment before first assignment completed,
      // so they see version=1 and assigned_load_id=null (stale read).
      // But the actual UPDATE fails because version is now 2 in the database.
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow({ id: "load-002" }));
      mockEquipFindById.mockResolvedValueOnce(
        makeEquipmentRow({ version: 1, assigned_load_id: null }),
      );
      // assignToLoad returns null because DB version is 2, not 1
      mockEquipAssignToLoad.mockResolvedValueOnce(null);

      await expect(
        assignmentService.assignEquipment(
          "load-002",
          "equip-001",
          COMPANY_A,
          1, // stale version from before first assignment
        ),
      ).rejects.toThrow(ConflictError);
    });

    it("throws BusinessRuleError when equipment is already assigned to another load", async () => {
      mockLoadFindById.mockResolvedValueOnce(makeLoadRow());
      mockEquipFindById.mockResolvedValueOnce(
        makeEquipmentRow({ assigned_load_id: "load-other", version: 3 }),
      );

      await expect(
        assignmentService.assignEquipment(
          "load-001",
          "equip-001",
          COMPANY_A,
          3,
        ),
      ).rejects.toThrow(BusinessRuleError);
    });
  });
});
