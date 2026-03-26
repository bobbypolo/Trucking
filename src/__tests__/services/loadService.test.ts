import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the api module at the boundary
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  fetchLoads,
  createLoad,
  updateLoadStatusApi,
  deleteLoadApi,
  searchLoadsApi,
} from "../../../services/loadService";
import { api } from "../../../services/api";

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  postFormData: ReturnType<typeof vi.fn>;
};

describe("loadService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── mapRowToLoadData (tested indirectly via fetchLoads) ─────────────
  describe("fetchLoads / mapRowToLoadData", () => {
    it("returns empty array when API returns empty", async () => {
      mockApi.get.mockResolvedValue([]);
      const loads = await fetchLoads();
      expect(loads).toEqual([]);
      expect(mockApi.get).toHaveBeenCalledWith("/loads");
    });

    it("maps snake_case backend rows to camelCase frontend", async () => {
      mockApi.get.mockResolvedValue([
        {
          id: "load-1",
          company_id: "comp-1",
          driver_id: "drv-1",
          dispatcher_id: "disp-1",
          customer_id: "cust-1",
          load_number: "LD-1000",
          status: "draft",
          carrier_rate: 2500,
          driver_pay: 1200,
          pickup_date: "2026-03-15",
          freight_type: "Dry Van",
          commodity: "Electronics",
          weight: 40000,
          container_number: "CONT-001",
          container_size: "53ft",
          chassis_number: "CHS-001",
          chassis_provider: "DCLI",
          bol_number: "BOL-123",
          notification_emails: '["test@test.com"]',
          contract_id: "contract-1",
          legs: [],
          created_at: "2026-03-15T00:00:00Z",
          version: 2,
          customer_user_id: "cuser-1",
        },
      ]);

      const loads = await fetchLoads();
      expect(loads).toHaveLength(1);

      const load = loads[0];
      expect(load.id).toBe("load-1");
      expect(load.companyId).toBe("comp-1");
      expect(load.driverId).toBe("drv-1");
      expect(load.dispatcherId).toBe("disp-1");
      expect(load.brokerId).toBe("cust-1");
      expect(load.loadNumber).toBe("LD-1000");
      expect(load.status).toBe("draft");
      expect(load.carrierRate).toBe(2500);
      expect(load.driverPay).toBe(1200);
      expect(load.pickupDate).toBe("2026-03-15");
      expect(load.freightType).toBe("Dry Van");
      expect(load.commodity).toBe("Electronics");
      expect(load.weight).toBe(40000);
      expect(load.containerNumber).toBe("CONT-001");
      expect(load.containerSize).toBe("53ft");
      expect(load.chassisNumber).toBe("CHS-001");
      expect(load.chassisProvider).toBe("DCLI");
      expect(load.bolNumber).toBe("BOL-123");
      expect(load.notificationEmails).toEqual(["test@test.com"]);
      expect(load.contractId).toBe("contract-1");
      expect(load.version).toBe(2);
      expect(load.customerUserId).toBe("cuser-1");
    });

    it("maps camelCase backend rows (already transformed)", async () => {
      mockApi.get.mockResolvedValue([
        {
          id: "load-2",
          companyId: "comp-2",
          driverId: "drv-2",
          dispatcherId: "disp-2",
          brokerId: "cust-2",
          loadNumber: "LD-2000",
          status: "in_transit",
          carrierRate: 3000,
          driverPay: 1500,
          pickupDate: "2026-03-16",
          legs: [],
          version: 1,
        },
      ]);

      const loads = await fetchLoads();
      expect(loads[0].companyId).toBe("comp-2");
      expect(loads[0].driverId).toBe("drv-2");
      expect(loads[0].loadNumber).toBe("LD-2000");
    });

    it("handles legs mapping with snake_case fields", async () => {
      mockApi.get.mockResolvedValue([
        {
          id: "load-3",
          load_number: "LD-3000",
          status: "planned",
          legs: [
            {
              id: "leg-1",
              type: "Pickup",
              city: "Chicago",
              state: "IL",
              facility_name: "Warehouse A",
              date: "2026-03-15",
              appointment_time: "09:00",
              completed: false,
            },
            {
              id: "leg-2",
              type: "Dropoff",
              city: "Detroit",
              state: "MI",
              facility_name: "Factory B",
              date: "2026-03-16",
              appointment_time: "14:00",
              completed: false,
            },
          ],
        },
      ]);

      const loads = await fetchLoads();
      const load = loads[0];
      expect(load.legs).toHaveLength(2);
      expect(load.legs[0].location.city).toBe("Chicago");
      expect(load.legs[0].location.state).toBe("IL");
      expect(load.legs[0].location.facilityName).toBe("Warehouse A");
      expect(load.legs[1].location.city).toBe("Detroit");

      // pickup/dropoff derived from legs
      expect(load.pickup.city).toBe("Chicago");
      expect(load.pickup.state).toBe("IL");
      expect(load.dropoff.city).toBe("Detroit");
      expect(load.dropoff.state).toBe("MI");
    });

    it("handles notification_emails as string (JSON parse)", async () => {
      mockApi.get.mockResolvedValue([
        {
          id: "load-4",
          load_number: "LD-4000",
          status: "draft",
          notification_emails: '["a@b.com","c@d.com"]',
          legs: [],
        },
      ]);

      const loads = await fetchLoads();
      expect(loads[0].notificationEmails).toEqual(["a@b.com", "c@d.com"]);
    });

    it("handles notification_emails as array", async () => {
      mockApi.get.mockResolvedValue([
        {
          id: "load-5",
          load_number: "LD-5000",
          status: "draft",
          notification_emails: ["e@f.com"],
          legs: [],
        },
      ]);

      const loads = await fetchLoads();
      expect(loads[0].notificationEmails).toEqual(["e@f.com"]);
    });

    it("defaults to empty array when notification_emails missing", async () => {
      mockApi.get.mockResolvedValue([
        {
          id: "load-6",
          load_number: "LD-6000",
          status: "draft",
          legs: [],
        },
      ]);

      const loads = await fetchLoads();
      expect(loads[0].notificationEmails).toEqual([]);
    });

    it("defaults to empty pickup/dropoff when no legs", async () => {
      mockApi.get.mockResolvedValue([
        {
          id: "load-7",
          load_number: "LD-7000",
          status: "draft",
          legs: [],
        },
      ]);

      const loads = await fetchLoads();
      expect(loads[0].pickup).toEqual({
        city: "",
        state: "",
        facilityName: "",
      });
      expect(loads[0].dropoff).toEqual({
        city: "",
        state: "",
        facilityName: "",
      });
    });

    it("handles missing carrier_rate and driver_pay (defaults to 0)", async () => {
      mockApi.get.mockResolvedValue([
        {
          id: "load-8",
          load_number: "LD-8000",
          status: "draft",
          legs: [],
        },
      ]);

      const loads = await fetchLoads();
      expect(loads[0].carrierRate).toBe(0);
      expect(loads[0].driverPay).toBe(0);
    });

    it("defaults loadNumber to UNKNOWN when missing", async () => {
      mockApi.get.mockResolvedValue([
        { id: "load-9", status: "draft", legs: [] },
      ]);

      const loads = await fetchLoads();
      expect(loads[0].loadNumber).toBe("UNKNOWN");
    });

    it("defaults version to 1 when missing", async () => {
      mockApi.get.mockResolvedValue([
        { id: "load-10", load_number: "LD-10", status: "draft", legs: [] },
      ]);

      const loads = await fetchLoads();
      expect(loads[0].version).toBe(1);
    });
  });

  // ─── createLoad / mapLoadDataToPayload ───────────────────────────────
  describe("createLoad / mapLoadDataToPayload", () => {
    it("sends mapped payload to API", async () => {
      mockApi.post.mockResolvedValue({});

      const load = {
        id: "new-load",
        companyId: "comp-1",
        driverId: "drv-1",
        dispatcherId: "disp-1",
        brokerId: "cust-1",
        loadNumber: "LD-NEW",
        status: "draft" as const,
        carrierRate: 3000,
        driverPay: 1500,
        pickupDate: "2026-03-20",
        freightType: "Dry Van",
        commodity: "Furniture",
        weight: 35000,
        containerNumber: "C-001",
        chassisNumber: "CH-001",
        bolNumber: "BOL-NEW",
        notificationEmails: ["notify@test.com"],
        contractId: "contract-1",
        customerUserId: "cuser-1",
        legs: [
          {
            id: "leg-1",
            type: "Pickup" as const,
            location: { city: "Chicago", state: "IL", facilityName: "WH-A" },
            date: "2026-03-20",
            appointmentTime: "08:00",
            completed: false,
          },
        ],
        pickup: { city: "Chicago", state: "IL", facilityName: "WH-A" },
        dropoff: { city: "Detroit", state: "MI", facilityName: "Factory" },
        createdAt: 1710000000000,
        version: 1,
      } as any;

      await createLoad(load);

      expect(mockApi.post).toHaveBeenCalledWith(
        "/loads",
        expect.objectContaining({
          id: "new-load",
          customer_id: "cust-1",
          driver_id: "drv-1",
          dispatcher_id: "disp-1",
          load_number: "LD-NEW",
          status: "draft",
          carrier_rate: 3000,
          driver_pay: 1500,
          pickup_date: "2026-03-20",
          freight_type: "Dry Van",
          commodity: "Furniture",
          weight: 35000,
          container_number: "C-001",
          chassis_number: "CH-001",
          bol_number: "BOL-NEW",
          notification_emails: ["notify@test.com"],
          contract_id: "contract-1",
          customerUserId: "cuser-1",
        }),
      );

      // Verify legs mapping
      const payload = mockApi.post.mock.calls[0][1];
      expect(payload.legs[0].facility_name).toBe("WH-A");
      expect(payload.legs[0].city).toBe("Chicago");
      expect(payload.legs[0].state).toBe("IL");
      expect(payload.legs[0].sequence_order).toBe(0);
    });

    it("handles missing optional fields gracefully", async () => {
      mockApi.post.mockResolvedValue({});

      const minimalLoad = {
        id: "min-load",
        loadNumber: "LD-MIN",
        status: "draft",
        carrierRate: 0,
        driverPay: 0,
        pickupDate: "2026-03-20",
        legs: [],
        pickup: { city: "", state: "", facilityName: "" },
        dropoff: { city: "", state: "", facilityName: "" },
        createdAt: 0,
        version: 1,
      } as any;

      await createLoad(minimalLoad);
      expect(mockApi.post).toHaveBeenCalledWith(
        "/loads",
        expect.objectContaining({ id: "min-load" }),
      );
    });
  });

  // ─── updateLoadStatusApi ─────────────────────────────────────────────
  describe("updateLoadStatusApi", () => {
    it("sends PATCH request with status and dispatcher_id", async () => {
      mockApi.patch.mockResolvedValue({});

      await updateLoadStatusApi("load-1", "dispatched", "disp-1");

      expect(mockApi.patch).toHaveBeenCalledWith("/loads/load-1/status", {
        status: "dispatched",
        dispatcher_id: "disp-1",
      });
    });

    it("propagates API errors", async () => {
      mockApi.patch.mockRejectedValue(new Error("Conflict"));
      await expect(
        updateLoadStatusApi("load-1", "delivered", "disp-1"),
      ).rejects.toThrow("Conflict");
    });
  });

  // ─── deleteLoadApi ───────────────────────────────────────────────────
  describe("deleteLoadApi", () => {
    it("sends DELETE request for given load", async () => {
      mockApi.delete.mockResolvedValue({});

      await deleteLoadApi("load-1");

      expect(mockApi.delete).toHaveBeenCalledWith("/loads/load-1");
    });

    it("propagates API errors on delete", async () => {
      mockApi.delete.mockRejectedValue(new Error("Not Found"));
      await expect(deleteLoadApi("nonexistent")).rejects.toThrow("Not Found");
    });
  });

  // ─── searchLoadsApi ──────────────────────────────────────────────────
  describe("searchLoadsApi", () => {
    const mockLoads = [
      {
        id: "1",
        load_number: "LD-1001",
        status: "draft",
        legs: [
          {
            id: "l1",
            type: "Pickup",
            city: "Chicago",
            state: "IL",
            facility_name: "Warehouse Alpha",
            date: "2026-03-15",
          },
          {
            id: "l2",
            type: "Dropoff",
            city: "Detroit",
            state: "MI",
            facility_name: "Factory Beta",
            date: "2026-03-16",
          },
        ],
      },
      {
        id: "2",
        load_number: "LD-1002",
        status: "delivered",
        legs: [
          {
            id: "l3",
            type: "Pickup",
            city: "Dallas",
            state: "TX",
            facility_name: "Hub Central",
            date: "2026-03-10",
          },
          {
            id: "l4",
            type: "Dropoff",
            city: "Houston",
            state: "TX",
            facility_name: "Port Terminal",
            date: "2026-03-11",
          },
        ],
      },
    ];

    beforeEach(() => {
      mockApi.get.mockResolvedValue(mockLoads);
    });

    it("returns first 10 results when query is empty", async () => {
      const results = await searchLoadsApi("");
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it("filters by load number", async () => {
      const results = await searchLoadsApi("1001");
      expect(results).toHaveLength(1);
      expect(results[0].loadNumber).toBe("LD-1001");
    });

    it("filters by pickup city", async () => {
      const results = await searchLoadsApi("Chicago");
      expect(results).toHaveLength(1);
      expect(results[0].pickup.city).toBe("Chicago");
    });

    it("filters by dropoff city", async () => {
      const results = await searchLoadsApi("Houston");
      expect(results).toHaveLength(1);
    });

    it("filters by pickup facilityName", async () => {
      const results = await searchLoadsApi("Hub Central");
      expect(results).toHaveLength(1);
      expect(results[0].loadNumber).toBe("LD-1002");
    });

    it("filters by dropoff facilityName", async () => {
      const results = await searchLoadsApi("Factory Beta");
      expect(results).toHaveLength(1);
      expect(results[0].loadNumber).toBe("LD-1001");
    });

    it("search is case-insensitive", async () => {
      const results = await searchLoadsApi("chicago");
      expect(results).toHaveLength(1);
    });

    it("returns empty when no match", async () => {
      const results = await searchLoadsApi("NonexistentPlace");
      expect(results).toHaveLength(0);
    });
  });
});
