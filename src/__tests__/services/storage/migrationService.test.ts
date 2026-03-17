/**
 * Tests for services/storage/migrationService.ts
 * One-time localStorage -> Server migration utility.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../services/authService", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
  getCurrentUser: vi.fn().mockReturnValue({ companyId: "test-co" }),
}));

vi.mock("../../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

import {
  getLocalDataSummary,
  isMigrationComplete,
  markMigrationComplete,
  exportDomainAsJson,
  discardDomain,
  importDomain,
} from "../../../../services/storage/migrationService";

describe("migrationService.ts", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  describe("getLocalDataSummary", () => {
    it("returns empty array when no localStorage data exists", () => {
      const result = getLocalDataSummary();
      expect(result).toEqual([]);
    });

    it("detects data stored under tenant-scoped keys", () => {
      const key = "loadpilot_test-co_contacts_v1";
      localStorage.setItem(
        key,
        JSON.stringify([{ id: "c1", name: "John" }]),
      );

      const result = getLocalDataSummary();
      expect(result.length).toBe(1);
      expect(result[0].domain).toBe("contacts");
      expect(result[0].count).toBe(1);
    });

    it("reports correct count for multiple items", () => {
      const key = "loadpilot_test-co_leads_v1";
      localStorage.setItem(
        key,
        JSON.stringify([
          { id: "l1", callerName: "A" },
          { id: "l2", callerName: "B" },
          { id: "l3", callerName: "C" },
        ]),
      );

      const result = getLocalDataSummary();
      const leadEntry = result.find((r) => r.domain === "leads");
      expect(leadEntry).toBeDefined();
      expect(leadEntry!.count).toBe(3);
    });

    it("skips domains with empty arrays", () => {
      const key = "loadpilot_test-co_contacts_v1";
      localStorage.setItem(key, JSON.stringify([]));

      const result = getLocalDataSummary();
      expect(result.find((r) => r.domain === "contacts")).toBeUndefined();
    });

    it("skips domains with unparseable data", () => {
      const key = "loadpilot_test-co_contacts_v1";
      localStorage.setItem(key, "not-json{{{");

      const result = getLocalDataSummary();
      expect(result.find((r) => r.domain === "contacts")).toBeUndefined();
    });

    it("skips non-array data", () => {
      const key = "loadpilot_test-co_contacts_v1";
      localStorage.setItem(key, JSON.stringify({ id: "obj" }));

      const result = getLocalDataSummary();
      expect(result.find((r) => r.domain === "contacts")).toBeUndefined();
    });

    it("detects multiple domains with data", () => {
      localStorage.setItem(
        "loadpilot_test-co_contacts_v1",
        JSON.stringify([{ id: "c1" }]),
      );
      localStorage.setItem(
        "loadpilot_test-co_providers_v1",
        JSON.stringify([{ id: "p1" }, { id: "p2" }]),
      );

      const result = getLocalDataSummary();
      expect(result.length).toBe(2);
      const contacts = result.find((r) => r.domain === "contacts");
      const providers = result.find((r) => r.domain === "providers");
      expect(contacts!.count).toBe(1);
      expect(providers!.count).toBe(2);
    });
  });

  describe("isMigrationComplete / markMigrationComplete", () => {
    it("returns false when migration has not been completed", () => {
      expect(isMigrationComplete()).toBe(false);
    });

    it("returns true after markMigrationComplete is called", () => {
      markMigrationComplete();
      expect(isMigrationComplete()).toBe(true);
    });

    it("persists migration complete flag in localStorage", () => {
      markMigrationComplete();
      expect(localStorage.getItem("loadpilot_migration_complete")).toBe(
        "true",
      );
    });
  });

  describe("exportDomainAsJson", () => {
    it("does nothing for unknown domain", () => {
      const createElementSpy = vi.spyOn(document, "createElement");
      exportDomainAsJson("nonexistent-domain");
      expect(createElementSpy).not.toHaveBeenCalled();
      createElementSpy.mockRestore();
    });

    it("does nothing when no data exists for domain", () => {
      const createElementSpy = vi.spyOn(document, "createElement");
      exportDomainAsJson("contacts");
      expect(createElementSpy).not.toHaveBeenCalled();
      createElementSpy.mockRestore();
    });

    it("creates download link when domain has data", () => {
      localStorage.setItem(
        "loadpilot_test-co_contacts_v1",
        JSON.stringify([{ id: "c1" }]),
      );

      const mockAnchor = {
        href: "",
        download: "",
        click: vi.fn(),
      };
      vi.spyOn(document, "createElement").mockReturnValue(
        mockAnchor as any,
      );
      vi.spyOn(document.body, "appendChild").mockImplementation(
        (el) => el,
      );
      vi.spyOn(document.body, "removeChild").mockImplementation(
        (el) => el,
      );
      const mockCreateObjectURL = vi.fn().mockReturnValue("blob:test");
      const mockRevokeObjectURL = vi.fn();
      vi.stubGlobal("URL", {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      });

      exportDomainAsJson("contacts");

      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toContain("contacts");
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe("discardDomain", () => {
    it("removes localStorage data for the specified domain", () => {
      const key = "loadpilot_test-co_contacts_v1";
      localStorage.setItem(key, JSON.stringify([{ id: "c1" }]));

      discardDomain("contacts");

      expect(localStorage.getItem(key)).toBeNull();
    });

    it("does nothing for unknown domain", () => {
      const itemCount = localStorage.length;
      discardDomain("nonexistent-domain");
      expect(localStorage.length).toBe(itemCount);
    });
  });

  describe("importDomain", () => {
    it("returns zero report for unknown domain with error", async () => {
      const report = await importDomain("nonexistent-domain");

      expect(report.domain).toBe("nonexistent-domain");
      expect(report.found).toBe(0);
      expect(report.errors).toContain("Unknown domain");
    });

    it("returns zero report when no localStorage data exists", async () => {
      const report = await importDomain("contacts");

      expect(report.domain).toBe("contacts");
      expect(report.found).toBe(0);
      expect(report.imported).toBe(0);
      expect(report.errors).toHaveLength(0);
    });

    it("returns error when localStorage data is not parseable", async () => {
      localStorage.setItem(
        "loadpilot_test-co_contacts_v1",
        "not-valid-json{",
      );

      const report = await importDomain("contacts");

      expect(report.found).toBe(0);
      expect(report.errors).toContain("Failed to parse localStorage data");
    });

    it("imports items successfully via POST", async () => {
      localStorage.setItem(
        "loadpilot_test-co_contacts_v1",
        JSON.stringify([
          { id: "c1", name: "Alice" },
          { id: "c2", name: "Bob" },
        ]),
      );

      mockFetch.mockResolvedValue({ ok: true, status: 201 });

      const report = await importDomain("contacts");

      expect(report.found).toBe(2);
      expect(report.imported).toBe(2);
      expect(report.failed).toBe(0);
      // localStorage data should be removed after full success
      expect(
        localStorage.getItem("loadpilot_test-co_contacts_v1"),
      ).toBeNull();
    });

    it("skips items without id", async () => {
      localStorage.setItem(
        "loadpilot_test-co_contacts_v1",
        JSON.stringify([
          { name: "No ID" },
          { id: "c2", name: "Has ID" },
        ]),
      );

      mockFetch.mockResolvedValue({ ok: true });

      const report = await importDomain("contacts");

      expect(report.found).toBe(2);
      expect(report.skipped).toBe(1);
      expect(report.imported).toBe(1);
      expect(report.errors.some((e) => e.includes("missing id"))).toBe(true);
    });

    it("treats 409 (duplicate) as success", async () => {
      localStorage.setItem(
        "loadpilot_test-co_contacts_v1",
        JSON.stringify([{ id: "c1", name: "Alice" }]),
      );

      mockFetch.mockResolvedValueOnce({ ok: false, status: 409 });

      const report = await importDomain("contacts");

      expect(report.imported).toBe(1);
      expect(report.failed).toBe(0);
    });

    it("records failed items on server error", async () => {
      localStorage.setItem(
        "loadpilot_test-co_contacts_v1",
        JSON.stringify([{ id: "c1", name: "Alice" }]),
      );

      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const report = await importDomain("contacts");

      expect(report.failed).toBe(1);
      expect(report.errors.some((e) => e.includes("500"))).toBe(true);
      // localStorage data should NOT be removed when there are failures
      expect(
        localStorage.getItem("loadpilot_test-co_contacts_v1"),
      ).not.toBeNull();
    });

    it("records failed items on network error", async () => {
      localStorage.setItem(
        "loadpilot_test-co_contacts_v1",
        JSON.stringify([{ id: "c1", name: "Alice" }]),
      );

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const report = await importDomain("contacts");

      expect(report.failed).toBe(1);
      expect(
        report.errors.some((e) => e.includes("Network error")),
      ).toBe(true);
    });

    it("calls onProgress callback with current and total count", async () => {
      localStorage.setItem(
        "loadpilot_test-co_leads_v1",
        JSON.stringify([
          { id: "l1", callerName: "A" },
          { id: "l2", callerName: "B" },
        ]),
      );

      mockFetch.mockResolvedValue({ ok: true });

      const progressCalls: [number, number][] = [];
      await importDomain("leads", (imported, total) => {
        progressCalls.push([imported, total]);
      });

      expect(progressCalls).toEqual([
        [1, 2],
        [2, 2],
      ]);
    });

    it("sends X-Import-Source header with migration identifier", async () => {
      localStorage.setItem(
        "loadpilot_test-co_contacts_v1",
        JSON.stringify([{ id: "c1", name: "Alice" }]),
      );

      mockFetch.mockResolvedValueOnce({ ok: true });

      await importDomain("contacts");

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers["X-Import-Source"]).toBe("local-migration");
    });

    it("handles non-array parsed data by treating as empty", async () => {
      localStorage.setItem(
        "loadpilot_test-co_contacts_v1",
        JSON.stringify({ id: "c1" }),
      );

      const report = await importDomain("contacts");

      expect(report.found).toBe(0);
      expect(report.imported).toBe(0);
    });
  });
});
