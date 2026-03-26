// Tests R-S13-01, R-S13-02, R-S13-03
/**
 * STORY-013: Frontend Cutover — Leads
 * Verifies that services/storage/leads.ts uses API calls (not browser storage)
 * and that STORAGE_KEY_LEADS has been removed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Use vi.hoisted so mock fns are available when vi.mock factory runs (hoisted)
const { mockApiGet, mockApiPost, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    patch: mockApiPatch,
  },
}));

import { getLeads, saveLead } from "../../../services/storage/leads";

// ---- R-S13-01: No localStorage.*leads references in services/ ----
describe("R-S13-01: No localStorage.*leads in services/", () => {
  it("services/storage/leads.ts does not reference localStorage", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/leads.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/localStorage/);
  });

  it("services/storageService.ts does not export STORAGE_KEY_LEADS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storageService.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/STORAGE_KEY_LEADS/);
  });
});

// ---- R-S13-02: STORAGE_KEY_LEADS constant removed ----
describe("R-S13-02: STORAGE_KEY_LEADS removed from codebase", () => {
  it("services/storage/leads.ts does not export STORAGE_KEY_LEADS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/leads.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/STORAGE_KEY_LEADS/);
  });

  it("services/storage/index.ts does not re-export STORAGE_KEY_LEADS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/index.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/STORAGE_KEY_LEADS/);
  });

  it("services/storageService.ts does not export STORAGE_KEY_LEADS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storageService.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/STORAGE_KEY_LEADS/);
  });
});

// ---- R-S13-03: Lead CRUD uses API endpoints ----
describe("R-S13-03: Lead CRUD uses API endpoints", () => {
  it("services/storage/leads.ts imports api from api module", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/leads.ts"),
      "utf-8",
    );
    expect(src).toMatch(/from "\.\.\/api"/);
  });

  it("services/storage/leads.ts uses api client for auth", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/leads.ts"),
      "utf-8",
    );
    expect(src).toMatch(/api\.get|api\.post|api\.patch/);
  });

  it("services/storage/leads.ts has a getLeads function that uses GET /leads", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/leads.ts"),
      "utf-8",
    );
    expect(src).toMatch(/api\.get/);
    expect(src).toMatch(/\/leads/);
  });

  it("services/storage/leads.ts contains no localStorage references", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/leads.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/localStorage/);
  });

  it("getLeads calls api.get(/leads) and returns parsed JSON", async () => {
    const mockLeads = [
      {
        id: "lead-1",
        companyId: "co-1",
        callerName: "Test Caller",
        customerName: "Test Customer",
        createdAt: new Date().toISOString(),
      },
    ];

    mockApiGet.mockResolvedValueOnce(mockLeads);

    const leads = await getLeads("co-1");

    expect(mockApiGet).toHaveBeenCalledWith("/leads");
    expect(leads).toEqual(mockLeads);
  });

  it("saveLead calls api.post for a new lead (no id)", async () => {
    const newLead = {
      id: "",
      companyId: "co-1",
      callerName: "New Caller",
      customerName: "New Customer",
      createdAt: new Date().toISOString(),
    };
    const savedLead = { ...newLead, id: "lead-new" };

    mockApiPost.mockResolvedValueOnce(savedLead);

    const result = await saveLead(newLead);

    expect(mockApiPost).toHaveBeenCalledWith("/leads", newLead);
    expect(result).toEqual(savedLead);
  });

  it("saveLead calls api.patch for an existing lead (has id)", async () => {
    const existingLead = {
      id: "lead-123",
      companyId: "co-1",
      callerName: "Existing Caller",
      customerName: "Existing Customer",
      createdAt: new Date().toISOString(),
    };

    mockApiPatch.mockResolvedValueOnce(existingLead);

    await saveLead(existingLead);

    expect(mockApiPatch).toHaveBeenCalledWith("/leads/lead-123", existingLead);
  });
});
