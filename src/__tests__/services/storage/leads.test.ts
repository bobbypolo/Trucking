/**
 * Tests for services/storage/leads.ts
 * Leads domain -- API-backed CRUD.
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

import { getLeads, saveLead } from "../../../../services/storage/leads";

describe("leads.ts", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    it("calls GET /api/leads and filters by companyId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleLeads,
      });

      const result = await getLeads("co-1");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/leads");
      expect(result).toHaveLength(2);
      expect(result.every((l) => l.companyId === "co-1")).toBe(true);
    });

    it("handles data.leads wrapper format", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ leads: sampleLeads }),
      });

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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => leadsWithMissing,
      });

      const result = await getLeads("co-1");
      // lead-4 has no companyId, so !l.companyId is true -> included
      expect(result.some((l) => l.id === "lead-4")).toBe(true);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(getLeads("co-1")).rejects.toThrow(
        "Failed to fetch leads: 500",
      );
    });

    it("propagates network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Offline"));

      await expect(getLeads("co-1")).rejects.toThrow("Offline");
    });
  });

  describe("saveLead", () => {
    it("sends PATCH for existing lead (has id)", async () => {
      const lead = sampleLeads[0];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => lead,
      });

      const result = await saveLead(lead as any);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/leads/lead-1");
      expect(opts.method).toBe("PATCH");
      expect(result).toEqual(lead);
    });

    it("sends POST for new lead (no id)", async () => {
      const newLead = {
        callerName: "New Caller",
        customerName: "New Customer",
        companyId: "co-1",
        createdAt: "2026-01-05T00:00:00Z",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...newLead, id: "lead-new" }),
      });

      const result = await saveLead(newLead as any);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/leads");
      expect(opts.method).toBe("POST");
      expect(result.id).toBe("lead-new");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });

      await expect(
        saveLead({ id: "lead-1" } as any),
      ).rejects.toThrow("Failed to save lead: 422");
    });

    it("sends lead data as JSON body", async () => {
      const lead = sampleLeads[0];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => lead,
      });

      await saveLead(lead as any);

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.callerName).toBe("Alice Johnson");
      expect(body.customerName).toBe("Acme Corp");
    });
  });
});
