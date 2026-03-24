import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the api module
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { api } from "../../../services/api";
import {
  getParties,
  saveParty,
  updatePartyStatus,
} from "../../../services/networkService";

describe("networkService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- getParties ---
  describe("getParties", () => {
    it("fetches parties for a given companyId", async () => {
      const parties = [
        { id: "p1", name: "Broker A" },
        { id: "p2", name: "Shipper B" },
      ];
      vi.mocked(api.get).mockResolvedValue(parties);

      const result = await getParties("company-123");
      expect(result).toEqual(parties);
      expect(api.get).toHaveBeenCalledWith("/parties");
    });

    it("returns empty array when api returns null", async () => {
      vi.mocked(api.get).mockResolvedValue(null);

      const result = await getParties("company-123");
      expect(result).toEqual([]);
    });

    it("returns empty array on api error", async () => {
      vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

      const result = await getParties("company-123");
      expect(result).toEqual([]);
    });
  });

  // --- saveParty ---
  describe("saveParty", () => {
    it("sends a POST request with the party data", async () => {
      vi.mocked(api.post).mockResolvedValue({ id: "new-1" });

      const party = { name: "New Broker", type: "Broker" as const };
      const result = await saveParty(party);

      expect(api.post).toHaveBeenCalledWith("/parties", party);
      expect(result).toEqual({ id: "new-1" });
    });

    it("throws on api error", async () => {
      vi.mocked(api.post).mockRejectedValue(new Error("Failed to save"));

      await expect(saveParty({ name: "Test" })).rejects.toThrow(
        "Failed to save",
      );
    });
  });

  // --- updatePartyStatus ---
  describe("updatePartyStatus", () => {
    it("sends PATCH request to update party status", async () => {
      vi.mocked(api.patch).mockResolvedValue(undefined);

      await updatePartyStatus("p1", "active");
      expect(api.patch).toHaveBeenCalledWith("/parties/p1/status", {
        status: "active",
      });
    });

    it("throws on api error", async () => {
      vi.mocked(api.patch).mockRejectedValue(new Error("Not found"));

      await expect(updatePartyStatus("p1", "active")).rejects.toThrow(
        "Not found",
      );
    });
  });
});
