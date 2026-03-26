// Tests R-S14-01, R-S14-02, R-S14-03
/**
 * STORY-014: Frontend Cutover — Bookings
 * Verifies that services/storage/bookings.ts uses API calls (not localStorage)
 * and that STORAGE_KEY_BOOKINGS has been removed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Mock authService before any module that imports from it
vi.mock("../../../services/authService", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer mock-token" }),
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-token"),
  forceRefreshToken: vi.fn().mockResolvedValue("mock-token"),
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  getStoredUsers: vi.fn().mockReturnValue([]),
  getCurrentUser: vi.fn(),
}));
vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

// ---- R-S14-01: No localStorage.*bookings references in services/ ----
describe("R-S14-01: No localStorage.*bookings in services/", () => {
  it("services/storage/bookings.ts does not reference localStorage", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/bookings.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/localStorage/);
  });

  it("services/storageService.ts does not reference localStorage for bookings", () => {
    const src = fs.readFileSync(
      path.resolve("services/storageService.ts"),
      "utf-8",
    );
    // The storageService should not import or re-export a localStorage-based bookings constant
    expect(src).not.toMatch(/STORAGE_KEY_BOOKINGS/);
  });
});

// ---- R-S14-02: STORAGE_KEY_BOOKINGS constant removed ----
describe("R-S14-02: STORAGE_KEY_BOOKINGS removed from codebase", () => {
  it("services/storage/bookings.ts does not export STORAGE_KEY_BOOKINGS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/bookings.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_BOOKINGS");
  });

  it("services/storage/index.ts does not re-export STORAGE_KEY_BOOKINGS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/index.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_BOOKINGS");
  });

  it("services/storageService.ts does not export STORAGE_KEY_BOOKINGS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storageService.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_BOOKINGS");
  });
});

// ---- R-S14-03: Booking CRUD uses API endpoints ----
describe("R-S14-03: bookings service uses /api/bookings endpoints", () => {
  it("services/storage/bookings.ts calls api.get with /bookings for listing", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/bookings.ts"),
      "utf-8",
    );
    expect(src).toMatch(/\/bookings/);
  });

  it("services/storage/bookings.ts uses api client for auth", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/bookings.ts"),
      "utf-8",
    );
    expect(src).toContain('from "../api"');
  });

  it("services/storage/bookings.ts imports api from api module", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/bookings.ts"),
      "utf-8",
    );
    expect(src).toContain("import { api }");
  });

  it("services/storage/bookings.ts has a saveBooking function that uses post or patch", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/bookings.ts"),
      "utf-8",
    );
    expect(src).toMatch(/api\.post|api\.patch/);
  });
});

// ---- Functional unit tests using fetch mock ----
describe("R-S14-03: getBookings / saveBooking functional tests", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  it("getBookings calls GET /api/bookings and returns parsed JSON", async () => {
    const fakeBookings = [
      {
        id: "b1",
        quoteId: "q1",
        companyId: "co-1",
        status: "Accepted",
        requiresAppt: false,
        createdAt: new Date().toISOString(),
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeBookings,
    });

    const { getBookings } = await import(
      "../../../services/storage/bookings"
    );
    const result = await getBookings();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/bookings/);
    expect(result).toEqual(fakeBookings);
  });

  it("saveBooking calls POST /api/bookings for a new booking (no existing id on server)", async () => {
    const newBooking = {
      id: "b-new",
      quoteId: "q-1",
      companyId: "co-1",
      status: "Accepted" as const,
      requiresAppt: false,
      createdAt: new Date().toISOString(),
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...newBooking }),
    });

    const { saveBooking } = await import(
      "../../../services/storage/bookings"
    );
    await saveBooking(newBooking as any);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/bookings/);
    expect(options?.method).toMatch(/POST|PATCH/);
  });

  it("saveBooking calls PATCH /api/bookings/:id when updating an existing booking", async () => {
    const existingBooking = {
      id: "b-existing",
      quoteId: "q-1",
      companyId: "co-1",
      status: "Ready_for_Dispatch" as const,
      requiresAppt: false,
      createdAt: new Date().toISOString(),
      loadId: "load-1",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...existingBooking }),
    });

    const { saveBooking } = await import(
      "../../../services/storage/bookings"
    );
    await saveBooking(existingBooking as any);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/bookings\/b-existing/);
    expect(options?.method).toBe("PATCH");
  });
});
