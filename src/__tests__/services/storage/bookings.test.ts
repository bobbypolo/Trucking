/**
 * Tests for services/storage/bookings.ts
 * Bookings domain -- API-backed CRUD.
 * Enhances branch coverage beyond existing tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../services/authService", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
  getCurrentUser: vi.fn(),
}));

vi.mock("../../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

import {
  getBookings,
  saveBooking,
} from "../../../../services/storage/bookings";

describe("bookings.ts", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    it("calls GET /api/bookings and returns all bookings without filter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleBookings,
      });

      const result = await getBookings();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/bookings");
      expect(result).toEqual(sampleBookings);
    });

    it("filters by companyId when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleBookings,
      });

      const result = await getBookings("co-1");

      expect(result).toHaveLength(1);
      expect(result[0].companyId).toBe("co-1");
    });

    it("returns all bookings when companyId is undefined", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleBookings,
      });

      const result = await getBookings(undefined);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no bookings match companyId filter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleBookings,
      });

      const result = await getBookings("nonexistent-co");
      expect(result).toEqual([]);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(getBookings()).rejects.toThrow(
        "Failed to fetch bookings: 500",
      );
    });

    it("propagates network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection reset"));

      await expect(getBookings()).rejects.toThrow("Connection reset");
    });
  });

  describe("saveBooking", () => {
    it("sends PATCH for booking with existing id", async () => {
      const booking = sampleBookings[0];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => booking,
      });

      const result = await saveBooking(booking as any);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/bookings/b-1");
      expect(opts.method).toBe("PATCH");
      expect(opts.headers["Content-Type"]).toBe("application/json");
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...newBooking, id: "b-new" }),
      });

      const result = await saveBooking(newBooking as any);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/bookings");
      expect(opts.method).toBe("POST");
      expect(result.id).toBe("b-new");
    });

    it("throws on non-ok response for PATCH", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });

      await expect(
        saveBooking(sampleBookings[0] as any),
      ).rejects.toThrow("Failed to save booking: 422");
    });

    it("throws on non-ok response for POST", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      await expect(
        saveBooking({ id: "", quoteId: "q-1" } as any),
      ).rejects.toThrow("Failed to save booking: 400");
    });

    it("sends booking data as JSON body", async () => {
      const booking = sampleBookings[1];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => booking,
      });

      await saveBooking(booking as any);

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.requiresAppt).toBe(true);
      expect(body.appointmentWindow.start).toBe("2026-01-10T08:00:00Z");
    });
  });
});
