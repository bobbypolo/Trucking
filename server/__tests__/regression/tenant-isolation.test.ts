import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";

// Tests R-P5-01-AC2 (tenant isolation)

/**
 * Tenant Isolation Regression Test
 *
 * Verifies cross-tenant data access is blocked at every layer:
 *   - Middleware layer (requireTenant)
 *   - Service layer (assignmentService cross-tenant checks)
 *   - Repository layer (all queries scoped by company_id)
 *   - Load service (tenant-scoped load fetches)
 *   - Settlement service (tenant-scoped settlement operations)
 */

// --- Mock setup for assignment.service ---
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

// --- Mock setup for load.service (direct DB) ---
const { mockQuery, mockExecute, mockGetConnection } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockExecute = vi.fn();
  const mockGetConnection = vi.fn();
  return { mockQuery, mockExecute, mockGetConnection };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: mockExecute,
    getConnection: mockGetConnection,
  },
}));

// --- Mock setup for settlement.service ---
const { mockSettlementFindLoadStatus, mockSettlementFindByLoadAndTenant } =
  vi.hoisted(() => ({
    mockSettlementFindLoadStatus: vi.fn(),
    mockSettlementFindByLoadAndTenant: vi.fn(),
  }));

vi.mock("../../repositories/settlement.repository", () => ({
  settlementRepository: {
    findByLoadAndTenant: (...args: unknown[]) =>
      mockSettlementFindByLoadAndTenant(...args),
    findLoadStatus: (...args: unknown[]) =>
      mockSettlementFindLoadStatus(...args),
    create: vi.fn(),
  },
}));

import { requireTenant } from "../../middleware/requireTenant";
import { assignmentService } from "../../services/assignment.service";
import { loadService } from "../../services/load.service";
import { generateSettlement } from "../../services/settlement.service";
import { LoadStatus } from "../../services/load-state-machine";
import {
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
} from "../../errors/AppError";

// --- Constants ---
const TENANT_A = "company-alpha";
const TENANT_B = "company-beta";

function mockReq(
  user: {
    uid: string;
    tenantId: string;
    role: string;
    email: string;
    firebaseUid: string;
  } | null,
  params: Record<string, string> = {},
  body: Record<string, unknown> = {},
): Request {
  return {
    user,
    params,
    body,
    headers: {},
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as unknown as Response;
}

const userTenantA = {
  uid: "user-a-001",
  tenantId: TENANT_A,
  role: "dispatcher",
  email: "dispatcher@alpha.com",
  firebaseUid: "fb-uid-alpha-001",
};

const userTenantB = {
  uid: "user-b-001",
  tenantId: TENANT_B,
  role: "dispatcher",
  email: "dispatcher@beta.com",
  firebaseUid: "fb-uid-beta-001",
};

describe("R-P5-01-AC2: Tenant Isolation Regression", () => {
  let nextFn: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
  });

  describe("Middleware layer: requireTenant blocks cross-tenant URL params", () => {
    it("Tenant A user cannot access Tenant B resources via URL param", () => {
      const req = mockReq(userTenantA, { companyId: TENANT_B });
      const res = mockRes();

      requireTenant(req, res, nextFn);

      expect(nextFn).toHaveBeenCalledOnce();
      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.statusCode).toBe(403);
      expect(err.error_code).toBe("TENANT_MISMATCH_001");
    });

    it("Tenant B user cannot access Tenant A resources via URL param", () => {
      const req = mockReq(userTenantB, { companyId: TENANT_A });
      const res = mockRes();

      requireTenant(req, res, nextFn);

      expect(nextFn).toHaveBeenCalledOnce();
      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.statusCode).toBe(403);
    });

    it("Tenant A user cannot POST body with Tenant B company_id", () => {
      const req = mockReq(userTenantA, {}, { company_id: TENANT_B });
      const res = mockRes();

      requireTenant(req, res, nextFn);

      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.statusCode).toBe(403);
    });

    it("Tenant A user cannot POST body with Tenant B companyId (camelCase)", () => {
      const req = mockReq(userTenantA, {}, { companyId: TENANT_B });
      const res = mockRes();

      requireTenant(req, res, nextFn);

      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.statusCode).toBe(403);
    });

    it("same-tenant access is allowed", () => {
      const req = mockReq(userTenantA, { companyId: TENANT_A });
      const res = mockRes();

      requireTenant(req, res, nextFn);

      expect(nextFn).toHaveBeenCalledOnce();
      expect(nextFn.mock.calls[0][0]).toBeUndefined();
    });

    it("rejects requests with no user context (auth not called)", () => {
      const req = mockReq(null, { companyId: TENANT_A });
      const res = mockRes();

      requireTenant(req, res, nextFn);

      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(ForbiddenError);
    });
  });

  describe("Service layer: assignmentService blocks cross-tenant driver assignment", () => {
    it("rejects assigning a driver from Tenant B to a Tenant A load", async () => {
      mockLoadRepoFindById.mockResolvedValueOnce({
        id: "load-001",
        company_id: TENANT_A,
        status: "draft",
      });
      // Driver exists but belongs to Tenant B
      mockDriverFindById.mockResolvedValueOnce({
        id: "driver-b-001",
        company_id: TENANT_B,
        name: "Driver B",
        role: "driver",
        compliance_status: "Eligible",
      });

      await expect(
        assignmentService.assignDriver("load-001", "driver-b-001", TENANT_A),
      ).rejects.toThrow(ForbiddenError);
    });

    it("returns 403 status code for cross-tenant driver assignment", async () => {
      mockLoadRepoFindById.mockResolvedValueOnce({
        id: "load-001",
        company_id: TENANT_A,
        status: "draft",
      });
      mockDriverFindById.mockResolvedValueOnce({
        id: "driver-b-001",
        company_id: TENANT_B,
        compliance_status: "Eligible",
      });

      try {
        await assignmentService.assignDriver(
          "load-001",
          "driver-b-001",
          TENANT_A,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenError);
        expect((err as ForbiddenError).statusCode).toBe(403);
      }
    });
  });

  describe("Service layer: assignmentService blocks cross-tenant equipment assignment", () => {
    it("rejects assigning equipment from Tenant B to a Tenant A load", async () => {
      mockLoadRepoFindById.mockResolvedValueOnce({
        id: "load-001",
        company_id: TENANT_A,
        status: "draft",
      });
      mockEquipFindById.mockResolvedValueOnce({
        id: "equip-b-001",
        company_id: TENANT_B,
        unit_number: "TRK-B-100",
        type: "Truck",
        status: "Active",
        version: 1,
        assigned_load_id: null,
      });

      try {
        await assignmentService.assignEquipment(
          "load-001",
          "equip-b-001",
          TENANT_A,
          1,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenError);
        expect((err as ForbiddenError).statusCode).toBe(403);
      }
    });
  });

  describe("Service layer: loadService enforces tenant scoping on transitions", () => {
    it("returns NotFoundError when load belongs to different tenant", async () => {
      // Query scoped by company_id returns no rows (load exists but belongs to Tenant A)
      mockQuery.mockResolvedValueOnce([[], []]);

      await expect(
        loadService.transitionLoad(
          "load-001",
          LoadStatus.PLANNED,
          TENANT_B,
          "user-b-001",
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("dispatch guards reject cross-tenant driver during dispatch", async () => {
      // Load belongs to TENANT_A with a driver from TENANT_B
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "load-001",
            company_id: TENANT_A,
            status: "planned",
            version: 2,
            driver_id: "driver-b-001",
            chassis_number: "CHASSIS-001",
          },
        ],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          { type: "Pickup", completed: false },
          { type: "Dropoff", completed: false },
        ],
        [],
      ]);
      // Driver lookup returns TENANT_B
      mockQuery.mockResolvedValueOnce([[{ company_id: TENANT_B }], []]);
      // Equipment lookup returns TENANT_A
      mockQuery.mockResolvedValueOnce([[{ company_id: TENANT_A }], []]);

      await expect(
        loadService.transitionLoad(
          "load-001",
          LoadStatus.DISPATCHED,
          TENANT_A,
          "user-a-001",
        ),
      ).rejects.toThrow(BusinessRuleError);
    });
  });

  describe("Service layer: settlement operations enforce tenant scoping", () => {
    it("returns NotFoundError when generating settlement for wrong tenant load", async () => {
      // Load not found for this tenant
      mockSettlementFindLoadStatus.mockResolvedValueOnce(null);

      await expect(
        generateSettlement({
          loadId: "load-001",
          driverId: "driver-001",
          companyId: TENANT_B,
          userId: "user-b-001",
          settlementDate: "2026-03-16",
          lines: [{ description: "Line Haul", amount: 1500, type: "earning" }],
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("Repository layer: all queries include company_id WHERE clause", () => {
    it("load.service query includes company_id parameter", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      try {
        await loadService.transitionLoad(
          "load-001",
          LoadStatus.PLANNED,
          TENANT_A,
          "user-a-001",
        );
      } catch {
        // Expected NotFoundError
      }

      // Verify the first query included company_id
      const queryCall = mockQuery.mock.calls[0];
      const sql = queryCall[0] as string;
      const params = queryCall[1] as unknown[];

      expect(sql).toContain("company_id");
      expect(params).toContain(TENANT_A);
    });

    it("settlement repository scopes load status check by company_id", async () => {
      mockSettlementFindLoadStatus.mockResolvedValueOnce(null);

      try {
        await generateSettlement({
          loadId: "load-001",
          driverId: "driver-001",
          companyId: TENANT_A,
          userId: "user-001",
          settlementDate: "2026-03-16",
          lines: [{ description: "Line Haul", amount: 1500, type: "earning" }],
        });
      } catch {
        // Expected
      }

      // The settlement service calls findLoadStatus with both loadId and companyId
      expect(mockSettlementFindLoadStatus).toHaveBeenCalledWith(
        "load-001",
        TENANT_A,
      );
    });
  });
});
