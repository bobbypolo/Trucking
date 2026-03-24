import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the api client used by networkService
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import {
  getParties,
  saveParty,
  updatePartyStatus,
} from "../../../services/networkService";
import { api } from "../../../services/api";

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

describe("networkService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- getParties ---
  describe("getParties", () => {
    it("calls api.get for both /clients and /providers and merges results", async () => {
      const clients = [{ id: "c1", name: "Shipper A" }];
      const providers = [{ id: "p1", name: "Carrier B" }];

      mockApi.get.mockImplementation((endpoint: string) => {
        if (endpoint === "/clients") return Promise.resolve(clients);
        if (endpoint === "/providers") return Promise.resolve(providers);
        return Promise.resolve([]);
      });

      const result = await getParties("company-123");

      expect(mockApi.get).toHaveBeenCalledWith("/clients");
      expect(mockApi.get).toHaveBeenCalledWith("/providers");
      expect(result).toHaveLength(2);
      // Client mapped with isCustomer=true
      expect(result.find((p) => p.id === "c1")).toMatchObject({
        id: "c1",
        isCustomer: true,
        isVendor: false,
      });
      // Provider mapped with isVendor=true
      expect(result.find((p) => p.id === "p1")).toMatchObject({
        id: "p1",
        isCustomer: false,
        isVendor: true,
      });
    });

    it("returns empty array when both endpoints reject", async () => {
      mockApi.get.mockRejectedValue(new Error("Network error"));

      const result = await getParties("company-123");
      expect(result).toEqual([]);
    });

    it("returns only clients when providers rejects", async () => {
      const clients = [{ id: "c1", name: "Shipper A" }];

      mockApi.get.mockImplementation((endpoint: string) => {
        if (endpoint === "/clients") return Promise.resolve(clients);
        return Promise.reject(new Error("providers unavailable"));
      });

      const result = await getParties("company-123");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c1");
    });

    it("returns only providers when clients rejects", async () => {
      const providers = [{ id: "p1", name: "Carrier B" }];

      mockApi.get.mockImplementation((endpoint: string) => {
        if (endpoint === "/providers") return Promise.resolve(providers);
        return Promise.reject(new Error("clients unavailable"));
      });

      const result = await getParties("company-123");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("p1");
    });
  });

  // --- saveParty ---
  describe("saveParty", () => {
    it("posts to /providers for a vendor party", async () => {
      mockApi.post.mockResolvedValue({});

      const party = { name: "Fast Carrier", type: "Carrier" as const };
      await saveParty(party);

      expect(mockApi.post).toHaveBeenCalledWith("/providers", party);
    });

    it("posts to /providers when isVendor is true", async () => {
      mockApi.post.mockResolvedValue({});

      const party = { name: "Fuel Vendor", isVendor: true };
      await saveParty(party);

      expect(mockApi.post).toHaveBeenCalledWith("/providers", party);
    });

    it("posts to /clients for a non-vendor party", async () => {
      mockApi.post.mockResolvedValue({});

      const party = { name: "New Shipper", type: "Shipper" as const };
      await saveParty(party);

      expect(mockApi.post).toHaveBeenCalledWith("/clients", party);
    });

    it("posts to /clients for a broker party", async () => {
      mockApi.post.mockResolvedValue({});

      const party = { name: "Load Broker", type: "Broker" as const };
      await saveParty(party);

      expect(mockApi.post).toHaveBeenCalledWith("/clients", party);
    });

    it("throws when api.post rejects", async () => {
      mockApi.post.mockRejectedValue(new Error("Server error"));

      await expect(saveParty({ name: "Test" })).rejects.toThrow("Server error");
    });
  });

  // --- updatePartyStatus ---
  describe("updatePartyStatus", () => {
    it("patches /providers/:id first on success", async () => {
      mockApi.patch.mockResolvedValue({});

      await updatePartyStatus("p1", "active");

      expect(mockApi.patch).toHaveBeenCalledWith("/providers/p1", {
        status: "active",
      });
      expect(mockApi.patch).toHaveBeenCalledTimes(1);
    });

    it("falls back to /clients/:id when /providers patch throws", async () => {
      mockApi.patch
        .mockRejectedValueOnce(new Error("Not found in providers"))
        .mockResolvedValueOnce({});

      await updatePartyStatus("c1", "inactive");

      expect(mockApi.patch).toHaveBeenNthCalledWith(1, "/providers/c1", {
        status: "inactive",
      });
      expect(mockApi.patch).toHaveBeenNthCalledWith(2, "/clients/c1", {
        status: "inactive",
      });
      expect(mockApi.patch).toHaveBeenCalledTimes(2);
    });

    it("throws when both providers and clients patch fail", async () => {
      mockApi.patch.mockRejectedValue(new Error("Connection refused"));

      await expect(updatePartyStatus("x1", "active")).rejects.toThrow(
        "Connection refused",
      );
    });
  });
});
