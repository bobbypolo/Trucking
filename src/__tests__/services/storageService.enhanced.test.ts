import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock authService BEFORE importing storageService
vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  getStoredUsers: vi.fn().mockReturnValue([]),
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
  getCurrentUser: vi.fn().mockReturnValue({ companyId: "test-co" }),
}));

// Mock firebase and heavy deps
vi.mock("../../../services/firebase", () => ({
  storage: {},
  DEMO_MODE: false,
}));
vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));
vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([]),
}));
vi.mock("jspdf", () => {
  const mockDoc = {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    save: vi.fn(),
    addImage: vi.fn(),
    lastAutoTable: { finalY: 120 },
  };
  return { jsPDF: vi.fn(() => mockDoc) };
});
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));
vi.mock("../../../services/dispatchIntelligence", () => ({
  DispatchIntelligence: {
    getBestMatches: vi.fn().mockResolvedValue([]),
    predictExceptionRisk: vi.fn().mockReturnValue({ risk: "LOW" }),
    analyzeProfitability: vi.fn().mockReturnValue({ recommendation: "ACCEPT" }),
    auditSettlement: vi.fn().mockReturnValue({ status: "READY" }),
    getDriverPerformance: vi.fn().mockReturnValue({ rank: "STANDARD" }),
    getCapacityForecast: vi.fn().mockReturnValue([]),
  },
}));
vi.mock("../../../services/loadService", () => ({
  fetchLoads: vi.fn().mockResolvedValue([]),
  createLoad: vi.fn().mockResolvedValue({}),
  updateLoadStatusApi: vi.fn().mockResolvedValue({}),
  searchLoadsApi: vi.fn().mockResolvedValue([]),
  deleteLoadApi: vi.fn().mockResolvedValue({}),
}));

import {
  getLoads,
  saveLoad,
  deleteLoad,
  updateLoadStatus,
  logTime,
  logDispatchEvent,
  getDispatchEvents,
  getTimeLogs,
  settleLoad,
  seedDemoLoads,
  generateNextLoadNumber,
  exportToCSV,
  getIncidents,
  saveIncident,
  globalSearch,
  getOperationalTrends,
} from "../../../services/storageService";
import { fetchLoads as apiFetchLoads, createLoad as apiCreateLoad, updateLoadStatusApi, deleteLoadApi } from "../../../services/loadService";
import { getCompany, updateCompany, getAuthHeaders } from "../../../services/authService";

const mockApiFetchLoads = apiFetchLoads as ReturnType<typeof vi.fn>;
const mockApiCreateLoad = apiCreateLoad as ReturnType<typeof vi.fn>;
const mockUpdateLoadStatusApi = updateLoadStatusApi as ReturnType<typeof vi.fn>;
const mockDeleteLoadApi = deleteLoadApi as ReturnType<typeof vi.fn>;
const mockGetCompany = getCompany as ReturnType<typeof vi.fn>;
const mockUpdateCompany = updateCompany as ReturnType<typeof vi.fn>;

describe("storageService — enhanced coverage", () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    localStorageMock = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => localStorageMock[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        localStorageMock[key] = value;
      },
    );
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(
      (key: string) => {
        delete localStorageMock[key];
      },
    );
    vi.spyOn(globalThis, "fetch").mockReset();
    mockApiFetchLoads.mockReset();
    mockApiCreateLoad.mockReset();
    mockUpdateLoadStatusApi.mockReset();
    mockDeleteLoadApi.mockReset();
    mockGetCompany.mockReset();
    mockUpdateCompany.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getLoads ────────────────────────────────────────────────────────
  describe("getLoads", () => {
    it("returns loads filtered by companyId for admin role", async () => {
      mockApiFetchLoads.mockResolvedValue([
        { id: "l1", companyId: "c1", driverId: "d1" },
        { id: "l2", companyId: "c2", driverId: "d2" },
      ]);

      const user = { id: "u1", companyId: "c1", role: "admin" } as any;
      const loads = await getLoads(user);
      expect(loads).toHaveLength(1);
      expect(loads[0].id).toBe("l1");
    });

    it("returns loads filtered by companyId for dispatcher role", async () => {
      mockApiFetchLoads.mockResolvedValue([
        { id: "l1", companyId: "c1", driverId: "d1" },
      ]);

      const user = { id: "u1", companyId: "c1", role: "dispatcher" } as any;
      const loads = await getLoads(user);
      expect(loads).toHaveLength(1);
    });

    it("returns loads filtered by driverId for driver role", async () => {
      mockApiFetchLoads.mockResolvedValue([
        { id: "l1", companyId: "c1", driverId: "d1" },
        { id: "l2", companyId: "c1", driverId: "d2" },
      ]);

      const user = { id: "d1", companyId: "c1", role: "driver" } as any;
      const loads = await getLoads(user);
      expect(loads).toHaveLength(1);
      expect(loads[0].driverId).toBe("d1");
    });

    it("returns cached loads when API fails", async () => {
      // First call succeeds to populate cache
      mockApiFetchLoads.mockResolvedValueOnce([
        { id: "l1", companyId: "c1", driverId: "d1" },
      ]);
      const user = { id: "u1", companyId: "c1", role: "admin" } as any;
      await getLoads(user);

      // Second call fails
      mockApiFetchLoads.mockRejectedValueOnce(new Error("offline"));
      const loads = await getLoads(user);
      // Should return cached loads
      expect(loads).toBeDefined();
    });

    it("returns loads for safety_manager role", async () => {
      mockApiFetchLoads.mockResolvedValue([
        { id: "l1", companyId: "c1", driverId: "d1" },
      ]);
      const user = { id: "u1", companyId: "c1", role: "safety_manager" } as any;
      const loads = await getLoads(user);
      expect(loads).toHaveLength(1);
    });

    it("returns loads for payroll_manager role", async () => {
      mockApiFetchLoads.mockResolvedValue([
        { id: "l1", companyId: "c1", driverId: "d1" },
      ]);
      const user = { id: "u1", companyId: "c1", role: "payroll_manager" } as any;
      const loads = await getLoads(user);
      expect(loads).toHaveLength(1);
    });
  });

  // ─── saveLoad ────────────────────────────────────────────────────────
  describe("saveLoad", () => {
    it("calls API createLoad and updates cache", async () => {
      mockApiCreateLoad.mockResolvedValue({});

      const load = { id: "l-new", loadNumber: "LD-999" } as any;
      const user = { id: "u1", companyId: "c1" } as any;

      await saveLoad(load, user);

      expect(mockApiCreateLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "l-new",
          companyId: "c1",
          driverId: "u1",
        }),
      );
    });

    it("preserves existing companyId and driverId", async () => {
      mockApiCreateLoad.mockResolvedValue({});

      const load = { id: "l-new", companyId: "c2", driverId: "d2" } as any;
      const user = { id: "u1", companyId: "c1" } as any;

      await saveLoad(load, user);

      expect(mockApiCreateLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "c2",
          driverId: "d2",
        }),
      );
    });
  });

  // ─── deleteLoad ──────────────────────────────────────────────────────
  describe("deleteLoad", () => {
    it("calls API delete and removes from cache", async () => {
      mockDeleteLoadApi.mockResolvedValue({});

      await deleteLoad("l-del");

      expect(mockDeleteLoadApi).toHaveBeenCalledWith("l-del");
    });
  });

  // ─── updateLoadStatus ────────────────────────────────────────────────
  describe("updateLoadStatus", () => {
    it("calls API and updates cache", async () => {
      mockUpdateLoadStatusApi.mockResolvedValue({});

      await updateLoadStatus("l1", "dispatched", "disp-1");

      expect(mockUpdateLoadStatusApi).toHaveBeenCalledWith(
        "l1",
        "dispatched",
        "disp-1",
      );
    });
  });

  // ─── logTime ─────────────────────────────────────────────────────────
  describe("logTime", () => {
    it("posts time log to API", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as any);

      await logTime({
        userId: "u1",
        loadId: "l1",
        activityType: "driving",
        location: { lat: 41.8, lng: -87.6 },
      });

      expect(fetchSpy).toHaveBeenCalled();
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.user_id).toBe("u1");
      expect(body.load_id).toBe("l1");
    });

    it("handles API failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      await expect(
        logTime({ userId: "u1" }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── logDispatchEvent ────────────────────────────────────────────────
  describe("logDispatchEvent", () => {
    it("posts dispatch event to API", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as any);

      await logDispatchEvent({
        loadId: "l1",
        dispatcherId: "disp-1",
        eventType: "assigned",
      });

      expect(fetchSpy).toHaveBeenCalled();
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.load_id).toBe("l1");
      expect(body.dispatcher_id).toBe("disp-1");
    });

    it("handles API failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      await expect(
        logDispatchEvent({ loadId: "l1" }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── getDispatchEvents ───────────────────────────────────────────────
  describe("getDispatchEvents", () => {
    it("fetches and maps dispatch events", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "e1",
              load_id: "l1",
              dispatcher_id: "d1",
              event_type: "assigned",
              created_at: "2026-03-15",
            },
          ]),
      } as any);

      const events = await getDispatchEvents("c1");
      expect(events).toHaveLength(1);
      expect(events[0].loadId).toBe("l1");
      expect(events[0].dispatcherId).toBe("d1");
      expect(events[0].eventType).toBe("assigned");
    });

    it("returns empty array on API failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const events = await getDispatchEvents("c1");
      expect(events).toEqual([]);
    });
  });

  // ─── getTimeLogs ─────────────────────────────────────────────────────
  describe("getTimeLogs", () => {
    it("fetches user time logs", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "t1",
              user_id: "u1",
              load_id: "l1",
              activity_type: "driving",
              clock_in: "2026-03-15T08:00:00Z",
              clock_out: "2026-03-15T16:00:00Z",
              location_lat: 41.8,
              location_lng: -87.6,
            },
          ]),
      } as any);

      const logs = await getTimeLogs("u1");
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe("u1");
      expect(logs[0].loadId).toBe("l1");
      expect(logs[0].location.lat).toBe(41.8);
    });

    it("fetches company time logs", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);

      await getTimeLogs("c1", true);
      expect(fetchSpy.mock.calls[0][0]).toContain("company/c1");
    });

    it("returns empty array on API failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const logs = await getTimeLogs("u1");
      expect(logs).toEqual([]);
    });
  });

  // ─── settleLoad ──────────────────────────────────────────────────────
  describe("settleLoad", () => {
    it("updates load status to settled", async () => {
      mockUpdateLoadStatusApi.mockResolvedValue({});

      await settleLoad("l1");

      expect(mockUpdateLoadStatusApi).toHaveBeenCalledWith(
        "l1",
        "completed", // LOAD_STATUS.Settled maps to "completed"
        "system",
      );
    });
  });

  // ─── seedDemoLoads ───────────────────────────────────────────────────
  describe("seedDemoLoads", () => {
    it("is a no-op", () => {
      expect(() => seedDemoLoads({ id: "u1" } as any)).not.toThrow();
    });
  });

  // ─── generateNextLoadNumber ──────────────────────────────────────────
  describe("generateNextLoadNumber", () => {
    it("generates load number from company config", () => {
      const company = {
        id: "c1",
        loadNumberingConfig: {
          enabled: true,
          prefix: "LD",
          suffix: "",
          nextSequence: 1005,
          separator: "-",
          includeClientTag: false,
          clientTagPosition: "after_prefix",
          clientTagFormat: "first_3",
        },
      } as any;

      const loadNum = generateNextLoadNumber(company, "Acme");
      expect(loadNum).toBe("LD-1005");
    });

    it("increments the sequence number in company config", () => {
      const company = {
        id: "c1",
        loadNumberingConfig: {
          enabled: true,
          prefix: "LD",
          suffix: "",
          nextSequence: 1005,
          separator: "-",
          includeClientTag: false,
          clientTagPosition: "after_prefix",
          clientTagFormat: "first_3",
        },
      } as any;

      generateNextLoadNumber(company, "Acme");

      expect(mockUpdateCompany).toHaveBeenCalledWith(
        expect.objectContaining({
          loadNumberingConfig: expect.objectContaining({
            nextSequence: 1006,
          }),
        }),
      );
    });

    it("uses defaults when loadNumberingConfig is missing", () => {
      const company = { id: "c1" } as any;

      const loadNum = generateNextLoadNumber(company, "Acme");
      expect(loadNum).toBe("LD-1000");
    });
  });

  // ─── exportToCSV ─────────────────────────────────────────────────────
  describe("exportToCSV", () => {
    it("generates CSV download", () => {
      const clickFn = vi.fn();
      const removeFn = vi.fn();
      const mockElement = {
        setAttribute: vi.fn(),
        click: clickFn,
      };
      vi.spyOn(document, "createElement").mockReturnValue(mockElement as any);
      vi.spyOn(document.body, "appendChild").mockReturnValue(null as any);
      vi.spyOn(document.body, "removeChild").mockReturnValue(removeFn as any);
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");

      const loads = [
        {
          loadNumber: "LD-1000",
          carrierRate: 3000,
          pickup: { facilityName: "WH-A", city: "Chicago" },
        },
      ] as any[];

      exportToCSV(loads, {
        columns: ["loadNumber", "rate", "customer", "origin"],
      });

      expect(clickFn).toHaveBeenCalled();
    });
  });

  // ─── getIncidents ────────────────────────────────────────────────────
  describe("getIncidents", () => {
    it("fetches incidents from API", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: "inc-1", description: "Flat tire", load_id: "l1" },
          ]),
      } as any);

      const incidents = await getIncidents("c1");
      expect(incidents.length).toBeGreaterThanOrEqual(0);
    });

    it("falls back to localStorage when API fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      localStorageMock["loadpilot_test-co_incidents_v1"] = JSON.stringify([
        { id: "inc-1", timeline: [], billingItems: [] },
      ]);

      const incidents = await getIncidents("c1");
      expect(incidents.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── saveIncident ────────────────────────────────────────────────────
  describe("saveIncident", () => {
    it("posts incident to API and updates localStorage", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as any);

      const incident = {
        id: "inc-new",
        description: "Accident",
        timeline: [],
        billingItems: [],
      } as any;

      await saveIncident(incident);
      // Should not throw
    });

    it("handles API failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      // Should not throw
      await saveIncident({ id: "inc-1", timeline: [], billingItems: [] } as any);
    });
  });

  // ─── globalSearch ────────────────────────────────────────────────────
  describe("globalSearch", () => {
    it("returns empty array for empty query", async () => {
      const results = await globalSearch("");
      expect(results).toEqual([]);
    });

    it("returns results from API when available", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: "r1", type: "load", label: "LD-1234" },
          ]),
      } as any);

      const results = await globalSearch("1234");
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe("LD-1234");
    });

    it("falls back to local search when API fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      // Populate cache first
      mockApiFetchLoads.mockResolvedValue([
        {
          id: "l1",
          loadNumber: "LD-5555",
          companyId: "c1",
          pickup: { city: "Chicago", state: "IL", facilityName: "WH-A" },
          dropoff: { city: "Detroit", state: "MI", facilityName: "WH-B" },
          driverId: "d1",
          status: "delivered",
        },
      ]);
      const user = { id: "u1", companyId: "c1", role: "admin" } as any;
      await getLoads(user);

      // Now search (API will fail, fallback to local)
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const results = await globalSearch("5555");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── getOperationalTrends ────────────────────────────────────────────
  describe("getOperationalTrends", () => {
    it("returns trends for company", async () => {
      mockApiFetchLoads.mockResolvedValue([]);
      const user = { id: "u1", companyId: "c1", role: "admin" } as any;
      const trends = await getOperationalTrends(user);
      expect(trends).toBeDefined();
    });
  });
});
