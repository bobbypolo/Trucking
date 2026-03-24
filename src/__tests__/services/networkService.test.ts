import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock boundaries only: config (API_URL) and auth (token provider)
vi.mock("../../../services/config", () => ({
  API_URL: "http://test-api:5000/api",
}));

vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-jwt-token"),
  forceRefreshToken: vi.fn().mockResolvedValue("refreshed-jwt-token"),
}));

import {
  getParties,
  saveParty,
  updatePartyStatus,
} from "../../../services/networkService";

describe("networkService", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- getParties ---
  describe("getParties", () => {
    it("fetches parties for a given companyId", async () => {
      const parties = [
        { id: "p1", name: "Broker A" },
        { id: "p2", name: "Shipper B" },
      ];
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(parties),
      } as Response);

      const result = await getParties("company-123");
      expect(result).toEqual(parties);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://test-api:5000/api/parties/company-123",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-jwt-token",
          }),
        }),
      );
    });

    it("returns empty array on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Not found" }),
      } as Response);

      const result = await getParties("company-123");
      expect(result).toEqual([]);
    });

    it("returns empty array on fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

      const result = await getParties("company-123");
      expect(result).toEqual([]);
    });
  });

  // --- saveParty ---
  describe("saveParty", () => {
    it("sends a POST request with the party data", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "p1" }),
      } as Response);

      const party = { name: "New Broker", type: "Broker" as const };
      await saveParty(party);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://test-api:5000/api/parties",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer mock-jwt-token",
          }),
          body: JSON.stringify(party),
        }),
      );
    });

    it("throws on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Bad request" }),
      } as Response);

      await expect(saveParty({ name: "Test" })).rejects.toThrow("Bad request");
    });

    it("throws on fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Connection refused"),
      );

      await expect(saveParty({ name: "Test" })).rejects.toThrow(
        "Connection refused",
      );
    });
  });

  // --- updatePartyStatus ---
  describe("updatePartyStatus", () => {
    it("throws 'not implemented' error", async () => {
      await expect(updatePartyStatus("p1", "active")).rejects.toThrow(
        "updatePartyStatus not implemented",
      );
    });
  });
});
