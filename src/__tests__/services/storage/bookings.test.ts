/**
 * Tests for services/storage/bookings.ts
 * Bookings domain -- API-backed CRUD via api client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}));

vi.mock("../../../../services/api", () => ({
  api: mockApi,
  apiFetch: vi.fn(),
}));

import {
  getBookings,
  saveBooking,
} from "../../../../services/storage/bookings";

describe("bookings.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleBookings = [
    {
      id: "b-1",
      quoteId: "q-1",
      companyId: "co-1",
      status: "Accepted",
      requiresAppt: false,
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "b-2",
      quoteId: "q-2",
      companyId: "co-2",
      status: "Ready_for_Dispatch",
      requiresAppt: true,
      appointmentWindow: {
        start: "2026-01-10T08:00:00Z",
        end: "2026-01-10T12:00:00Z",
      },
      createdAt: "2026-01-02T00:00:00Z",
    },
  ];

  describe("getBookings", () => {
    it("calls api.get /bookings and returns all bookings without filter", async () => {
      mockApi.get.mockResolvedValueOnce(sampleBookings);

      const result = await getBookings();

      expect(mockApi.get).toHaveBeenCalledWith("/bookings");
      expect(result).toEqual(sampleBookings);
    });

    it("filters by companyId when provided", async () => {
      mockApi.get.mockResolvedValueOnce(sampleBookings);

      const result = await getBookings("co-1");

      expect(result).toHaveLength(1);
      expect(result[0].companyId).toBe("co-1");
    });

    it("returns all bookings when companyId is undefined", async () => {
      mockApi.get.mockResolvedValueOnce(sampleBookings);

      const result = await getBookings(undefined);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no bookings match companyId filter", async () => {
      mockApi.get.mockResolvedValueOnce(sampleBookings);

      const result = await getBookings("nonexistent-co");
      expect(result).toEqual([]);
    });

    it("throws on API error", async () => {
      mockApi.get.mockRejectedValueOnce(
        new Error("API Request failed: 500"),
      );

      await expect(getBookings()).rejects.toThrow(
        "API Request failed: 500",
      );
    });

    it("propagates network error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("Connection reset"));

      await expect(getBookings()).rejects.toThrow("Connection reset");
    });
  });

  describe("saveBooking", () => {
    it("sends PATCH for booking with existing id", async () => {
      const booking = sampleBookings[0];
      mockApi.patch.mockResolvedValueOnce(booking);

      const result = await saveBooking(booking as any);

      expect(mockApi.patch).toHaveBeenCalledWith("/bookings/b-1", booking);
      expect(result).toEqual(booking);
    });

    it("sends POST for booking without id", async () => {
      const newBooking = {
        id: "",
        quoteId: "q-3",
        companyId: "co-1",
        status: "Accepted" as const,
        requiresAppt: false,
        createdAt: "2026-01-03T00:00:00Z",
      };
      mockApi.post.mockResolvedValueOnce({ ...newBooking, id: "b-new" });

      const result = await saveBooking(newBooking as any);

      expect(mockApi.post).toHaveBeenCalledWith("/bookings", newBooking);
      expect(result.id).toBe("b-new");
    });

    it("throws on API error for PATCH", async () => {
      mockApi.patch.mockRejectedValueOnce(
        new Error("API Request failed: 422"),
      );

      await expect(
        saveBooking(sampleBookings[0] as any),
      ).rejects.toThrow("API Request failed: 422");
    });

    it("throws on API error for POST", async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error("API Request failed: 400"),
      );

      await expect(
        saveBooking({ id: "", quoteId: "q-1" } as any),
      ).rejects.toThrow("API Request failed: 400");
    });
  });
});
