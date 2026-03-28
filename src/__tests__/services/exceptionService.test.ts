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

    it("returns empty array when api throws", async () => {
      mockGet.mockRejectedValueOnce(new Error("500 Internal Server Error"));

      const result = await getExceptions();
      expect(result).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockGet.mockRejectedValueOnce(new Error("offline"));
      const result = await getExceptions();
      expect(result).toEqual([]);
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

    it("returns null when api throws on bad request", async () => {
      mockPost.mockRejectedValueOnce(new Error("400 Bad Request"));

      const result = await createException({ type: "TEST" as any });
      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      mockPost.mockRejectedValueOnce(new Error("offline"));
      const result = await createException({ type: "TEST" as any });
      expect(result).toBeNull();
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

    it("returns false when api throws on not found", async () => {
      mockPatch.mockRejectedValueOnce(new Error("404 Not Found"));

      const result = await updateException("exc-1", { status: "resolved" });
      expect(result).toBe(false);
    });

    it("returns false on network error", async () => {
      mockPatch.mockRejectedValueOnce(new Error("offline"));
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
      mockGet.mockResolvedValueOnce(events);

      const result = await getExceptionEvents("exc-1");
      expect(result).toEqual(events);
      expect(mockGet).toHaveBeenCalledWith("/exceptions/exc-1/events");
    });

    it("returns empty array when api throws", async () => {
      mockGet.mockRejectedValueOnce(new Error("500 Internal Server Error"));

      const result = await getExceptionEvents("exc-1");
      expect(result).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockGet.mockRejectedValueOnce(new Error("offline"));
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
      mockGet.mockResolvedValueOnce(types);

      const result = await getExceptionTypes();
      expect(result).toEqual(types);
      expect(mockGet).toHaveBeenCalledWith("/exception-types");
    });

    it("returns empty array when api throws", async () => {
      mockGet.mockRejectedValueOnce(new Error("500 Internal Server Error"));

      const result = await getExceptionTypes();
      expect(result).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockGet.mockRejectedValueOnce(new Error("offline"));
      const result = await getExceptionTypes();
      expect(result).toEqual([]);
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

    it("returns empty array when api throws", async () => {
      mockGet.mockRejectedValueOnce(new Error("500 Internal Server Error"));

      const result = await getDashboardCards();
      expect(result).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockGet.mockRejectedValueOnce(new Error("offline"));
      const result = await getDashboardCards();
      expect(result).toEqual([]);
    });
  });
});
