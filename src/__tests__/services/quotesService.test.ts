// Tests R-S12-01, R-S12-02, R-S12-03, R-S12-04, R-S12-05
/**
 * STORY-012: Frontend Cutover — Quotes
 * Verifies that services/storage/quotes.ts uses API calls (not localStorage)
 * and that STORAGE_KEY_QUOTES has been removed.
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
  it("services/storage/quotes.ts uses api client for /quotes endpoints", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/quotes.ts"),
      "utf-8",
    );
    expect(src).toMatch(/\/quotes/);
  });

  it("services/storage/quotes.ts imports api from api module", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/quotes.ts"),
      "utf-8",
    );
    expect(src).toMatch(/from "\.\.\/api"/);
  });

  it("services/storage/quotes.ts uses api.get, api.post, or api.patch", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/quotes.ts"),
      "utf-8",
    );
    expect(src).toMatch(/api\.get|api\.post|api\.patch/);
  });

  it("services/storage/quotes.ts has a saveQuote function that uses patch or post", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/quotes.ts"),
      "utf-8",
    );
    expect(src).toMatch(/api\.patch|api\.post/);
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

// ---- Functional unit tests using api mock ----
describe("R-S12-03, R-S12-04: getQuotes / saveQuote functional tests", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
  });

  it("getQuotes calls api.get(/quotes) and returns parsed JSON", async () => {
    const fakeQuotes = [
      {
        id: "q1",
        companyId: "co-1",
        status: "Draft",
        linehaul: 1000,
        totalRate: 1200,
      },
    ];
    mockApiGet.mockResolvedValueOnce(fakeQuotes);

    const result = await getQuotes();

    expect(mockApiGet).toHaveBeenCalledWith("/quotes");
    expect(result).toEqual(fakeQuotes);
  });

  it("saveQuote calls api.patch then api.post for a new quote not found on server", async () => {
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

    // api.patch throws with 404 message, so saveQuote should fall back to api.post
    mockApiPatch.mockRejectedValueOnce(new Error("API Request failed: 404"));
    mockApiPost.mockResolvedValueOnce({ ...newQuote });

    await saveQuote(newQuote as any);

    expect(mockApiPatch).toHaveBeenCalledWith("/quotes/q-new", newQuote);
    expect(mockApiPost).toHaveBeenCalledWith("/quotes", newQuote);
  });

  it("saveQuote calls api.patch for an existing quote (PATCH succeeds)", async () => {
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

    mockApiPatch.mockResolvedValueOnce({ ...existingQuote });

    await saveQuote(existingQuote as any);

    expect(mockApiPatch).toHaveBeenCalledWith("/quotes/q-exist", existingQuote);
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
