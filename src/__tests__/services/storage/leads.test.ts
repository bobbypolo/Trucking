/**
 * Tests for services/storage/leads.ts
 * Leads domain -- API-backed CRUD via api client.
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

import { getLeads, saveLead } from "../../../../services/storage/leads";

describe("leads.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleLeads = [
    {
      id: "lead-1",
      companyId: "co-1",
      callerName: "Alice Johnson",
      callerPhone: "555-0001",
      customerName: "Acme Corp",
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "lead-2",
      companyId: "co-1",
      callerName: "Bob Smith",
      customerName: "Beta Inc",
      createdAt: "2026-01-02T00:00:00Z",
    },
    {
      id: "lead-3",
      companyId: "co-2",
      callerName: "Charlie",
      customerName: "Gamma LLC",
      createdAt: "2026-01-03T00:00:00Z",
    },
  ];

  describe("getLeads", () => {
    it("calls api.get /leads and filters by companyId", async () => {
      mockApi.get.mockResolvedValueOnce(sampleLeads);

      const result = await getLeads("co-1");

      expect(mockApi.get).toHaveBeenCalledWith("/leads");
      expect(result).toHaveLength(2);
      expect(result.every((l: any) => l.companyId === "co-1")).toBe(true);
    });

    it("handles data.leads wrapper format", async () => {
      mockApi.get.mockResolvedValueOnce({ leads: sampleLeads });

      const result = await getLeads("co-1");
      expect(result).toHaveLength(2);
    });

    it("includes leads without companyId (unscoped)", async () => {
      const leadsWithMissing = [
        ...sampleLeads,
        {
          id: "lead-4",
          callerName: "No company",
          customerName: "None",
          createdAt: "2026-01-04",
        },
      ];
      mockApi.get.mockResolvedValueOnce(leadsWithMissing);

      const result = await getLeads("co-1");
      expect(result.some((l: any) => l.id === "lead-4")).toBe(true);
    });

    it("throws on API error", async () => {
      mockApi.get.mockRejectedValueOnce(
        new Error("API Request failed: 500"),
      );

      await expect(getLeads("co-1")).rejects.toThrow(
        "API Request failed: 500",
      );
    });

    it("propagates network errors", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("Offline"));

      await expect(getLeads("co-1")).rejects.toThrow("Offline");
    });
  });

  describe("saveLead", () => {
    it("sends PATCH for existing lead (has id)", async () => {
      const lead = sampleLeads[0];
      mockApi.patch.mockResolvedValueOnce(lead);

      const result = await saveLead(lead as any);

      expect(mockApi.patch).toHaveBeenCalledWith("/leads/lead-1", lead);
      expect(result).toEqual(lead);
    });

    it("sends POST for new lead (no id)", async () => {
      const newLead = {
        callerName: "New Caller",
        customerName: "New Customer",
        companyId: "co-1",
        createdAt: "2026-01-05T00:00:00Z",
      };
      mockApi.post.mockResolvedValueOnce({ ...newLead, id: "lead-new" });

      const result = await saveLead(newLead as any);

      expect(mockApi.post).toHaveBeenCalledWith("/leads", newLead);
      expect(result.id).toBe("lead-new");
    });

    it("throws on API error", async () => {
      mockApi.patch.mockRejectedValueOnce(
        new Error("API Request failed: 422"),
      );

      await expect(saveLead({ id: "lead-1" } as any)).rejects.toThrow(
        "API Request failed: 422",
      );
    });
  });
});
