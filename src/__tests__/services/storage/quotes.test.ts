/**
 * Tests for services/storage/quotes.ts
 * Quotes domain -- server-backed CRUD via /api/quotes.
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

import { getQuotes, saveQuote } from "../../../../services/storage/quotes";

describe("quotes.ts", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sampleQuote = {
    id: "q-1",
    companyId: "co-1",
    status: "Draft" as const,
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Detroit", state: "MI" },
    equipmentType: "DRY_VAN" as any,
    linehaul: 2500,
    fuelSurcharge: 300,
    accessorials: [],
    totalRate: 2800,
    createdAt: "2026-01-01T00:00:00Z",
  };

  describe("getQuotes", () => {
    it("calls GET /api/quotes and returns array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [sampleQuote],
      });

      const result = await getQuotes();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/quotes");
      expect(result).toEqual([sampleQuote]);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

      await expect(getQuotes()).rejects.toThrow(
        "GET /api/quotes failed: 403",
      );
    });

    it("propagates network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(getQuotes()).rejects.toThrow("Network error");
    });
  });

  describe("saveQuote", () => {
    it("tries PATCH first for existing quote", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleQuote,
      });

      const result = await saveQuote(sampleQuote as any);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/quotes/q-1");
      expect(opts.method).toBe("PATCH");
      expect(result).toEqual(sampleQuote);
    });

    it("falls back to POST when PATCH returns 404", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => sampleQuote,
        });

      await saveQuote(sampleQuote as any);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [postUrl, postOpts] = mockFetch.mock.calls[1];
      expect(postUrl).toBe("http://localhost:5000/api/quotes");
      expect(postOpts.method).toBe("POST");
    });

    it("throws when POST also fails after 404", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(saveQuote(sampleQuote as any)).rejects.toThrow(
        "POST /api/quotes failed: 500",
      );
    });

    it("throws when PATCH returns non-404 error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });

      await expect(saveQuote(sampleQuote as any)).rejects.toThrow(
        "PATCH /api/quotes/q-1 failed: 422",
      );
    });

    it("returns server response on successful PATCH", async () => {
      const serverResponse = { ...sampleQuote, status: "Sent" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serverResponse,
      });

      const result = await saveQuote(sampleQuote as any);
      expect(result.status).toBe("Sent");
    });

    it("sends full quote payload in body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleQuote,
      });

      await saveQuote(sampleQuote as any);

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.linehaul).toBe(2500);
      expect(body.pickup.city).toBe("Chicago");
    });
  });
});
