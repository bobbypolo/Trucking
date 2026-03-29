import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock fns are available when vi.mock factory runs (hoisted)
const { mockGet, mockPost, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
  api: {
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
  },
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
    vi.clearAllMocks();
  });

  // --- getExceptions ---
  describe("getExceptions", () => {
    it("fetches exceptions with query parameters from filters", async () => {
      const exceptions = [{ id: "exc-1", type: "LATE_DELIVERY" }];
      mockGet.mockResolvedValueOnce(exceptions);

      const result = await getExceptions({ status: "open", severity: "3" });
      expect(result).toEqual(exceptions);
      const endpoint: string = mockGet.mock.calls[0][0];
      expect(endpoint).toContain("status=open");
      expect(endpoint).toContain("severity=3");
    });

    it("fetches with empty filters", async () => {
      mockGet.mockResolvedValueOnce([]);

      const result = await getExceptions();
      expect(result).toEqual([]);
      const endpoint: string = mockGet.mock.calls[0][0];
      expect(endpoint).toContain("/exceptions?");
    });

    // R-P2-03: getExceptions throws on API failure
    it("throws when api returns server error", async () => {
      mockGet.mockRejectedValueOnce(new Error("500 Internal Server Error"));

      await expect(getExceptions()).rejects.toThrow("500 Internal Server Error");
    });

    it("throws on network error", async () => {
      mockGet.mockRejectedValueOnce(new Error("offline"));
      await expect(getExceptions()).rejects.toThrow("offline");
    });
  });

  // --- createException ---
  describe("createException", () => {
    it("sends POST and returns the created exception id", async () => {
      mockPost.mockResolvedValueOnce({ id: "exc-new" });

      const result = await createException({
        type: "LATE_DELIVERY" as any,
        severity: 3 as any,
      });
      expect(result).toBe("exc-new");
      expect(mockPost).toHaveBeenCalledWith(
        "/exceptions",
        expect.objectContaining({ type: "LATE_DELIVERY", severity: 3 }),
      );
    });

    // R-P2-04: createException throws on failure
    it("throws when api returns bad request", async () => {
      mockPost.mockRejectedValueOnce(new Error("400 Bad Request"));

      await expect(createException({ type: "TEST" as any })).rejects.toThrow("400 Bad Request");
    });

    it("throws on network error", async () => {
      mockPost.mockRejectedValueOnce(new Error("offline"));
      await expect(createException({ type: "TEST" as any })).rejects.toThrow("offline");
    });
  });

  // --- updateException ---
  describe("updateException", () => {
    it("sends PATCH with updates and returns true on success", async () => {
      mockPatch.mockResolvedValueOnce(undefined);

      const result = await updateException("exc-1", { status: "resolved" });
      expect(result).toBe(true);
      expect(mockPatch).toHaveBeenCalledWith("/exceptions/exc-1", {
        status: "resolved",
      });
    });

    // R-P2-04: updateException throws on failure
    it("throws when api returns not found", async () => {
      mockPatch.mockRejectedValueOnce(new Error("404 Not Found"));

      await expect(updateException("exc-1", { status: "resolved" })).rejects.toThrow("404 Not Found");
    });

    it("throws on network error", async () => {
      mockPatch.mockRejectedValueOnce(new Error("offline"));
      await expect(updateException("exc-1", { status: "resolved" })).rejects.toThrow("offline");
    });
  });

  // --- getExceptionEvents ---
  describe("getExceptionEvents", () => {
    it("fetches events for a specific exception", async () => {
      const events = [
        { id: "evt-1", type: "STATUS_CHANGE" },
        { id: "evt-2", type: "COMMENT" },
      ];
      mockGet.mockResolvedValueOnce(events);

      const result = await getExceptionEvents("exc-1");
      expect(result).toEqual(events);
      expect(mockGet).toHaveBeenCalledWith("/exceptions/exc-1/events");
    });

    // R-P2-03: getExceptionEvents throws on failure
    it("throws when api returns server error", async () => {
      mockGet.mockRejectedValueOnce(new Error("500 Internal Server Error"));

      await expect(getExceptionEvents("exc-1")).rejects.toThrow("500 Internal Server Error");
    });

    it("throws on network error", async () => {
      mockGet.mockRejectedValueOnce(new Error("offline"));
      await expect(getExceptionEvents("exc-1")).rejects.toThrow("offline");
    });
  });

  // --- getExceptionTypes ---
  describe("getExceptionTypes", () => {
    it("fetches exception types", async () => {
      const types = [
        { typeCode: "LATE", displayName: "Late Delivery" },
        { typeCode: "DMG", displayName: "Damaged Cargo" },
      ];
      mockGet.mockResolvedValueOnce(types);

      const result = await getExceptionTypes();
      expect(result).toEqual(types);
      expect(mockGet).toHaveBeenCalledWith("/exception-types");
    });

    // R-P2-03: getExceptionTypes throws on failure
    it("throws when api returns server error", async () => {
      mockGet.mockRejectedValueOnce(new Error("500 Internal Server Error"));

      await expect(getExceptionTypes()).rejects.toThrow("500 Internal Server Error");
    });

    it("throws on network error", async () => {
      mockGet.mockRejectedValueOnce(new Error("offline"));
      await expect(getExceptionTypes()).rejects.toThrow("offline");
    });
  });

  // --- getDashboardCards ---
  describe("getDashboardCards", () => {
    it("fetches dashboard cards", async () => {
      const cards = [{ id: "card-1", title: "Active Exceptions", count: 5 }];
      mockGet.mockResolvedValueOnce(cards);

      const result = await getDashboardCards();
      expect(result).toEqual(cards);
      expect(mockGet).toHaveBeenCalledWith("/dashboard/cards");
    });

    // R-P2-03: getDashboardCards throws on failure
    it("throws when api returns server error", async () => {
      mockGet.mockRejectedValueOnce(new Error("500 Internal Server Error"));

      await expect(getDashboardCards()).rejects.toThrow("500 Internal Server Error");
    });

    it("throws on network error", async () => {
      mockGet.mockRejectedValueOnce(new Error("offline"));
      await expect(getDashboardCards()).rejects.toThrow("offline");
    });
  });
});
