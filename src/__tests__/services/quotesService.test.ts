// Tests R-S12-01, R-S12-02, R-S12-03, R-S12-04, R-S12-05
/**
 * STORY-012: Frontend Cutover — Quotes
 * Verifies that services/storage/quotes.ts uses API calls (not localStorage)
 * and that STORAGE_KEY_QUOTES has been removed.
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

import { getQuotes, saveQuote } from "../../../services/storage/quotes";

// ---- R-S12-01: No localStorage.*quotes references in services/ ----
describe("R-S12-01: No localStorage.*quotes in services/", () => {
  it("services/storage/quotes.ts does not reference localStorage", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/quotes.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/localStorage/);
  });

  it("services/storageService.ts does not export STORAGE_KEY_QUOTES", () => {
    const src = fs.readFileSync(
      path.resolve("services/storageService.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/STORAGE_KEY_QUOTES/);
  });
});

// ---- R-S12-02: STORAGE_KEY_QUOTES constant removed ----
describe("R-S12-02: STORAGE_KEY_QUOTES removed from codebase", () => {
  it("services/storage/quotes.ts does not export STORAGE_KEY_QUOTES", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/quotes.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_QUOTES");
  });

  it("services/storage/index.ts does not re-export STORAGE_KEY_QUOTES", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/index.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_QUOTES");
  });

  it("services/storageService.ts does not export STORAGE_KEY_QUOTES", () => {
    const src = fs.readFileSync(
      path.resolve("services/storageService.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_QUOTES");
  });
});

// ---- R-S12-03 & R-S12-04: API calls used for GET/POST/PATCH ----
describe("R-S12-03, R-S12-04: quotes service uses /api/quotes endpoints", () => {
  it("services/storage/quotes.ts calls fetch with /api/quotes for listing", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/quotes.ts"),
      "utf-8",
    );
    expect(src).toMatch(/\/api\/quotes/);
  });

  it("services/storage/quotes.ts uses getAuthHeaders for auth", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/quotes.ts"),
      "utf-8",
    );
    expect(src).toContain("getAuthHeaders");
  });

  it("services/storage/quotes.ts imports API_URL from config", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/quotes.ts"),
      "utf-8",
    );
    expect(src).toContain("API_URL");
  });

  it("services/storage/quotes.ts has a saveQuote function that uses POST or PATCH", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/quotes.ts"),
      "utf-8",
    );
    expect(src).toMatch(/POST|PATCH/);
  });
});

// ---- R-S12-05: No localStorage usage for quotes in the service file ----
describe("R-S12-05: No localStorage usage for quotes", () => {
  it("services/storage/quotes.ts contains no localStorage references", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/quotes.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)/);
  });

  it("QuoteManager.tsx does not import STORAGE_KEY_QUOTES", () => {
    const src = fs.readFileSync(
      path.resolve("components/QuoteManager.tsx"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_QUOTES");
  });
});

// ---- Functional unit tests using fetch mock ----
describe("R-S12-03, R-S12-04: getQuotes / saveQuote functional tests", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getQuotes calls GET /api/quotes and returns parsed JSON", async () => {
    const fakeQuotes = [
      {
        id: "q1",
        companyId: "co-1",
        status: "Draft",
        linehaul: 1000,
        totalRate: 1200,
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeQuotes,
    });

    const result = await getQuotes();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/quotes/);
    expect(result).toEqual(fakeQuotes);
  });

  it("saveQuote calls PATCH then POST for a new quote not found on server", async () => {
    const newQuote = {
      id: "q-new",
      companyId: "co-1",
      status: "Draft" as const,
      pickup: { city: "Dallas", state: "TX" },
      dropoff: { city: "Houston", state: "TX" },
      equipmentType: "Dry Van" as const,
      linehaul: 800,
      fuelSurcharge: 50,
      accessorials: [],
      totalRate: 850,
      version: 1,
      validUntil: new Date().toISOString(),
      ownerId: "user-1",
      createdAt: new Date().toISOString(),
    };

    // PATCH returns 404 (not found), so saveQuote should fall back to POST
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...newQuote }),
      });

    await saveQuote(newQuote as any);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [patchUrl, patchOptions] = mockFetch.mock.calls[0];
    expect(patchUrl).toMatch(/\/api\/quotes\/q-new/);
    expect(patchOptions?.method).toBe("PATCH");

    const [postUrl, postOptions] = mockFetch.mock.calls[1];
    expect(postUrl).toMatch(/\/api\/quotes$/);
    expect(postOptions?.method).toBe("POST");
  });

  it("saveQuote calls PATCH for an existing quote (PATCH returns 200)", async () => {
    const existingQuote = {
      id: "q-exist",
      companyId: "co-1",
      status: "Sent" as const,
      pickup: { city: "Atlanta", state: "GA" },
      dropoff: { city: "Miami", state: "FL" },
      equipmentType: "Reefer" as const,
      linehaul: 1500,
      fuelSurcharge: 100,
      accessorials: [],
      totalRate: 1600,
      version: 2,
      validUntil: new Date().toISOString(),
      ownerId: "user-1",
      createdAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...existingQuote }),
    });

    await saveQuote(existingQuote as any);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/quotes\/q-exist/);
    expect(options?.method).toBe("PATCH");
  });
});
