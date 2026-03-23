// Tests R-P1-27, R-P1-28, R-P1-29
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock authService BEFORE importing storageService
vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  getStoredUsers: vi.fn().mockReturnValue([]),
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
  getIdTokenAsync: vi.fn().mockResolvedValue("test-token"),
  getCurrentUser: vi.fn().mockReturnValue({ companyId: "test-co" }),
}));

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
vi.mock("jspdf", () => ({ jsPDF: vi.fn() }));
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));
vi.mock("../../../services/dispatchIntelligence", () => ({
  DispatchIntelligence: vi.fn(),
}));
vi.mock("../../../services/loadService", () => ({
  fetchLoads: vi.fn().mockResolvedValue([]),
  createLoad: vi.fn().mockResolvedValue({}),
  updateLoadStatusApi: vi.fn().mockResolvedValue({}),
  searchLoadsApi: vi.fn().mockResolvedValue([]),
}));

import { getIncidents, seedIncidents } from "../../../services/storageService";

describe("incidents API-only migration (R-P1-27, R-P1-28, R-P1-29)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // R-P1-28: getIncidents is async and fetches from /api/incidents exclusively
  describe("getIncidents — API-only (R-P1-28)", () => {
    it("is an async function", () => {
      expect(getIncidents).toBeTypeOf("function");
      const result = getIncidents();
      expect(result).toBeInstanceOf(Promise);
      result.catch(() => {}); // suppress unhandled rejection
    });

    it("fetches from /api/incidents and returns mapped incidents", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "inc-1",
              description: "Flat tire",
              load_id: "l-1",
              reported_at: "2026-01-01T00:00:00Z",
              sla_deadline: null,
              location_lat: 40.7,
              location_lng: -74.0,
              timeline: [],
              billingItems: [],
            },
          ]),
      } as any);

      const incidents = await getIncidents();

      // Must have called fetch with /api/incidents path
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toMatch(/\/api\/incidents/);

      expect(incidents).toHaveLength(1);
      expect(incidents[0].id).toBe("inc-1");
      // loadId field mapped from load_id
      expect(incidents[0].loadId).toBe("l-1");
    });

    it("does NOT read from localStorage (no getRawIncidents merge)", async () => {
      const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);

      await getIncidents();

      // localStorage.getItem should NOT be called for incidents key
      const incidentCalls = getItemSpy.mock.calls.filter(([key]) =>
        String(key).includes("incidents"),
      );
      expect(incidentCalls).toHaveLength(0);
    });

    it("does NOT write to localStorage after API success", async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: "inc-1", timeline: [], billingItems: [] }]),
      } as any);

      await getIncidents();

      const incidentWrites = setItemSpy.mock.calls.filter(([key]) =>
        String(key).includes("incidents"),
      );
      expect(incidentWrites).toHaveLength(0);
    });

    it("returns empty array when API returns non-ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve([]),
      } as any);

      const incidents = await getIncidents();
      expect(Array.isArray(incidents)).toBe(true);
      expect(incidents).toHaveLength(0);
    });

    it("returns empty array when API throws (network error)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

      const incidents = await getIncidents();
      expect(Array.isArray(incidents)).toBe(true);
      expect(incidents).toHaveLength(0);
    });
  });

  // R-P1-29: seedIncidents is a no-op
  describe("seedIncidents — no-op for backward compat (R-P1-29)", () => {
    it("is exported and returns a resolved promise", async () => {
      const result = seedIncidents([]);
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
    });

    it("does not call fetch or localStorage when invoked", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      await seedIncidents([] as any);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
    });
  });
});
