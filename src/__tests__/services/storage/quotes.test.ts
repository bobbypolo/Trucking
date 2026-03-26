/**
 * Tests for services/storage/quotes.ts
 * Quotes domain -- server-backed CRUD via api client.
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

import { getQuotes, saveQuote } from "../../../../services/storage/quotes";

describe("quotes.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    it("calls api.get /quotes and returns array", async () => {
      mockApi.get.mockResolvedValueOnce([sampleQuote]);

      const result = await getQuotes();

      expect(mockApi.get).toHaveBeenCalledWith("/quotes");
      expect(result).toEqual([sampleQuote]);
    });

    it("throws on API error", async () => {
      mockApi.get.mockRejectedValueOnce(
        new Error("API Request failed: 403"),
      );

      await expect(getQuotes()).rejects.toThrow(
        "API Request failed: 403",
      );
    });

    it("propagates network errors", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("Network error"));

      await expect(getQuotes()).rejects.toThrow("Network error");
    });
  });

  describe("saveQuote", () => {
    it("tries PATCH first for existing quote", async () => {
      mockApi.patch.mockResolvedValueOnce(sampleQuote);

      const result = await saveQuote(sampleQuote as any);

      expect(mockApi.patch).toHaveBeenCalledWith(
        "/quotes/q-1",
        sampleQuote,
      );
      expect(result).toEqual(sampleQuote);
    });

    it("falls back to POST when PATCH returns 404", async () => {
      mockApi.patch.mockRejectedValueOnce(
        new Error("API Request failed: 404"),
      );
      mockApi.post.mockResolvedValueOnce(sampleQuote);

      await saveQuote(sampleQuote as any);

      expect(mockApi.patch).toHaveBeenCalledOnce();
      expect(mockApi.post).toHaveBeenCalledWith("/quotes", sampleQuote);
    });

    it("throws when POST also fails after 404", async () => {
      mockApi.patch.mockRejectedValueOnce(
        new Error("API Request failed: 404"),
      );
      mockApi.post.mockRejectedValueOnce(
        new Error("API Request failed: 500"),
      );

      await expect(saveQuote(sampleQuote as any)).rejects.toThrow(
        "API Request failed: 500",
      );
    });

    it("throws when PATCH returns non-404 error", async () => {
      mockApi.patch.mockRejectedValueOnce(
        new Error("API Request failed: 422"),
      );

      await expect(saveQuote(sampleQuote as any)).rejects.toThrow(
        "API Request failed: 422",
      );
    });

    it("returns server response on successful PATCH", async () => {
      const serverResponse = { ...sampleQuote, status: "Sent" };
      mockApi.patch.mockResolvedValueOnce(serverResponse);

      const result = await saveQuote(sampleQuote as any);
      expect(result.status).toBe("Sent");
    });
  });
});
