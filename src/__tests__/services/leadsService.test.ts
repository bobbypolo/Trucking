// Tests R-S13-01, R-S13-02, R-S13-03
/**
 * STORY-013: Frontend Cutover — Leads
 * Verifies that services/storage/leads.ts uses API calls (not browser storage)
 * and that STORAGE_KEY_LEADS has been removed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Mock authService so the module can be imported without Firebase
vi.mock("../../../services/authService", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
}));

// Mock config to provide a stable API_URL
vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
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
  it("services/storage/leads.ts imports API_URL from config", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/leads.ts"),
      "utf-8",
    );
    expect(src).toMatch(/API_URL/);
  });

  it("services/storage/leads.ts uses getAuthHeaders for auth", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/leads.ts"),
      "utf-8",
    );
    expect(src).toMatch(/getAuthHeaders/);
  });

  it("services/storage/leads.ts has a getLeads function that uses GET /api/leads", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/leads.ts"),
      "utf-8",
    );
    expect(src).toMatch(/fetch\(/);
    expect(src).toMatch(/\/leads/);
  });

  it("services/storage/leads.ts contains no localStorage references", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/leads.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/localStorage/);
  });

  it("getLeads calls GET /api/leads and returns parsed JSON", async () => {
    const mockLeads = [
      {
        id: "lead-1",
        companyId: "co-1",
        callerName: "Test Caller",
        customerName: "Test Customer",
        createdAt: new Date().toISOString(),
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockLeads),
    });
    vi.stubGlobal("fetch", fetchMock);

    const leads = await getLeads("co-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/leads"),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(leads).toEqual(mockLeads);

    vi.unstubAllGlobals();
  });

  it("saveLead calls POST for a new lead (no id)", async () => {
    const newLead = {
      id: "",
      companyId: "co-1",
      callerName: "New Caller",
      customerName: "New Customer",
      createdAt: new Date().toISOString(),
    };
    const savedLead = { ...newLead, id: "lead-new" };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(savedLead),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveLead(newLead);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/leads"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(savedLead);

    vi.unstubAllGlobals();
  });

  it("saveLead calls PATCH for an existing lead (has id)", async () => {
    const existingLead = {
      id: "lead-123",
      companyId: "co-1",
      callerName: "Existing Caller",
      customerName: "Existing Customer",
      createdAt: new Date().toISOString(),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(existingLead),
    });
    vi.stubGlobal("fetch", fetchMock);

    await saveLead(existingLead);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/leads/lead-123"),
      expect.objectContaining({ method: "PATCH" }),
    );

    vi.unstubAllGlobals();
  });
});
