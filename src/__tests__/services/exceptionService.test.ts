import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock config
vi.mock("../../../services/config", () => ({
  API_URL: "http://test-api:5000/api",
}));

import {
  getExceptions,
  createException,
  updateException,
  getExceptionEvents,
  getExceptionTypes,
  getDashboardCards,
} from "../../../services/exceptionService";

describe("exceptionService", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- getExceptions ---
  describe("getExceptions", () => {
    it("fetches exceptions with query parameters from filters", async () => {
      const exceptions = [{ id: "exc-1", type: "LATE_DELIVERY" }];
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(exceptions),
      } as Response);

      const result = await getExceptions({ status: "open", severity: "3" });
      expect(result).toEqual(exceptions);
      const url = (globalThis.fetch as any).mock.calls[0][0] as string;
      expect(url).toContain("status=open");
      expect(url).toContain("severity=3");
    });

    it("fetches with empty filters", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      const result = await getExceptions();
      expect(result).toEqual([]);
      const url = (globalThis.fetch as any).mock.calls[0][0] as string;
      expect(url).toContain("/exceptions?");
    });

    it("returns empty array on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await getExceptions();
      expect(result).toEqual([]);
    });

    it("returns empty array on fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const result = await getExceptions();
      expect(result).toEqual([]);
    });
  });

  // --- createException ---
  describe("createException", () => {
    it("sends POST and returns the created exception id", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "exc-new" }),
      } as Response);

      const result = await createException({
        type: "LATE_DELIVERY" as any,
        severity: 3 as any,
      });
      expect(result).toBe("exc-new");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://test-api:5000/api/exceptions",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    it("returns null on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 400,
      } as Response);

      const result = await createException({ type: "TEST" as any });
      expect(result).toBeNull();
    });

    it("returns null on fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const result = await createException({ type: "TEST" as any });
      expect(result).toBeNull();
    });
  });

  // --- updateException ---
  describe("updateException", () => {
    it("sends PATCH with updates and returns true on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as Response);

      const result = await updateException("exc-1", { status: "resolved" });
      expect(result).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://test-api:5000/api/exceptions/exc-1",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "resolved" }),
        }),
      );
    });

    it("returns false on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const result = await updateException("exc-1", { status: "resolved" });
      expect(result).toBe(false);
    });

    it("returns false on fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const result = await updateException("exc-1", { status: "resolved" });
      expect(result).toBe(false);
    });
  });

  // --- getExceptionEvents ---
  describe("getExceptionEvents", () => {
    it("fetches events for a specific exception", async () => {
      const events = [
        { id: "evt-1", type: "STATUS_CHANGE" },
        { id: "evt-2", type: "COMMENT" },
      ];
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(events),
      } as Response);

      const result = await getExceptionEvents("exc-1");
      expect(result).toEqual(events);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://test-api:5000/api/exceptions/exc-1/events",
      );
    });

    it("returns empty array on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await getExceptionEvents("exc-1");
      expect(result).toEqual([]);
    });

    it("returns empty array on fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const result = await getExceptionEvents("exc-1");
      expect(result).toEqual([]);
    });
  });

  // --- getExceptionTypes ---
  describe("getExceptionTypes", () => {
    it("fetches exception types", async () => {
      const types = [
        { typeCode: "LATE", displayName: "Late Delivery" },
        { typeCode: "DMG", displayName: "Damaged Cargo" },
      ];
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(types),
      } as Response);

      const result = await getExceptionTypes();
      expect(result).toEqual(types);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://test-api:5000/api/exception-types",
      );
    });

    it("returns empty array on failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await getExceptionTypes();
      expect(result).toEqual([]);
    });

    it("returns empty array on fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const result = await getExceptionTypes();
      expect(result).toEqual([]);
    });
  });

  // --- getDashboardCards ---
  describe("getDashboardCards", () => {
    it("fetches dashboard cards", async () => {
      const cards = [
        { id: "card-1", title: "Active Exceptions", count: 5 },
      ];
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(cards),
      } as Response);

      const result = await getDashboardCards();
      expect(result).toEqual(cards);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://test-api:5000/api/dashboard/cards",
      );
    });

    it("returns empty array on failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await getDashboardCards();
      expect(result).toEqual([]);
    });

    it("returns empty array on fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const result = await getDashboardCards();
      expect(result).toEqual([]);
    });
  });
});
