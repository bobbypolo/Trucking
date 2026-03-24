import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the api module
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock("../../../services/api", () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
    delete: vi.fn(),
    postFormData: vi.fn(),
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
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
  });

  // --- getExceptions ---
  describe("getExceptions", () => {
    it("fetches exceptions with query parameters from filters", async () => {
      const exceptions = [{ id: "exc-1", type: "LATE_DELIVERY" }];
      mockGet.mockResolvedValue(exceptions);

      const result = await getExceptions({ status: "open", severity: "3" });
      expect(result).toEqual(exceptions);
      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain("status=open");
      expect(url).toContain("severity=3");
    });

    it("fetches with empty filters", async () => {
      mockGet.mockResolvedValue([]);

      const result = await getExceptions();
      expect(result).toEqual([]);
      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain("/exceptions?");
    });

    it("returns empty array on non-OK response", async () => {
      mockGet.mockRejectedValue(new Error("API Request failed: 500"));

      const result = await getExceptions();
      expect(result).toEqual([]);
    });

    it("returns empty array on fetch error", async () => {
      mockGet.mockRejectedValue(new Error("offline"));
      const result = await getExceptions();
      expect(result).toEqual([]);
    });
  });

  // --- createException ---
  describe("createException", () => {
    it("sends POST and returns the created exception id", async () => {
      mockPost.mockResolvedValue({ id: "exc-new" });

      const result = await createException({
        type: "LATE_DELIVERY" as any,
        severity: 3 as any,
      });
      expect(result).toBe("exc-new");
      expect(mockPost).toHaveBeenCalledWith(
        "/exceptions",
        expect.objectContaining({
          type: "LATE_DELIVERY",
          severity: 3,
        }),
      );
    });

    it("returns null on non-OK response", async () => {
      mockPost.mockRejectedValue(new Error("API Request failed: 400"));

      const result = await createException({ type: "TEST" as any });
      expect(result).toBeNull();
    });

    it("returns null on fetch error", async () => {
      mockPost.mockRejectedValue(new Error("offline"));
      const result = await createException({ type: "TEST" as any });
      expect(result).toBeNull();
    });
  });

  // --- updateException ---
  describe("updateException", () => {
    it("sends PATCH with updates and returns true on success", async () => {
      mockPatch.mockResolvedValue({});

      const result = await updateException("exc-1", { status: "resolved" });
      expect(result).toBe(true);
      expect(mockPatch).toHaveBeenCalledWith("/exceptions/exc-1", {
        status: "resolved",
      });
    });

    it("returns false on non-OK response", async () => {
      mockPatch.mockRejectedValue(new Error("API Request failed: 404"));

      const result = await updateException("exc-1", { status: "resolved" });
      expect(result).toBe(false);
    });

    it("returns false on fetch error", async () => {
      mockPatch.mockRejectedValue(new Error("offline"));
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
      mockGet.mockResolvedValue(events);

      const result = await getExceptionEvents("exc-1");
      expect(result).toEqual(events);
      expect(mockGet).toHaveBeenCalledWith("/exceptions/exc-1/events");
    });

    it("returns empty array on non-OK response", async () => {
      mockGet.mockRejectedValue(new Error("API Request failed: 500"));

      const result = await getExceptionEvents("exc-1");
      expect(result).toEqual([]);
    });

    it("returns empty array on fetch error", async () => {
      mockGet.mockRejectedValue(new Error("offline"));
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
      mockGet.mockResolvedValue(types);

      const result = await getExceptionTypes();
      expect(result).toEqual(types);
      expect(mockGet).toHaveBeenCalledWith("/exception-types");
    });

    it("returns empty array on failure", async () => {
      mockGet.mockRejectedValue(new Error("API Request failed: 500"));

      const result = await getExceptionTypes();
      expect(result).toEqual([]);
    });

    it("returns empty array on fetch error", async () => {
      mockGet.mockRejectedValue(new Error("offline"));
      const result = await getExceptionTypes();
      expect(result).toEqual([]);
    });
  });

  // --- getDashboardCards ---
  describe("getDashboardCards", () => {
    it("fetches dashboard cards", async () => {
      const cards = [{ id: "card-1", title: "Active Exceptions", count: 5 }];
      mockGet.mockResolvedValue(cards);

      const result = await getDashboardCards();
      expect(result).toEqual(cards);
      expect(mockGet).toHaveBeenCalledWith("/dashboard/cards");
    });

    it("returns empty array on failure", async () => {
      mockGet.mockRejectedValue(new Error("API Request failed: 500"));

      const result = await getDashboardCards();
      expect(result).toEqual([]);
    });

    it("returns empty array on fetch error", async () => {
      mockGet.mockRejectedValue(new Error("offline"));
      const result = await getDashboardCards();
      expect(result).toEqual([]);
    });
  });
});
