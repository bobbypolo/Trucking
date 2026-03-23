import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests R-W2-01a, R-W2-01b
// Verifies 401/403 interception in apiFetch()

vi.mock("../../../services/config", () => ({
  API_URL: "http://test-api:5000/api",
}));

vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-jwt-token"),
}));

import { apiFetch } from "../../../services/api";

describe("apiFetch 401/403 interception", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
    vi.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // R-W2-01a: 401 emits auth:session-expired custom event
  it("emits auth:session-expired CustomEvent on 401 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    } as Response);

    await expect(apiFetch("/loads")).rejects.toThrow();

    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:session-expired" }),
    );
  });

  // R-W2-01b: 403 throws ForbiddenError (check via name property)
  it("throws ForbiddenError on 403 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Forbidden" }),
    } as Response);

    try {
      await apiFetch("/admin");
      expect.fail("should have thrown");
    } catch (e: any) {
      expect(e.name).toBe("ForbiddenError");
    }
  });

  it("ForbiddenError has correct name property", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Forbidden" }),
    } as Response);

    try {
      await apiFetch("/admin");
      expect.fail("should have thrown");
    } catch (e: any) {
      expect(e.name).toBe("ForbiddenError");
    }
  });

  it("does NOT emit session-expired event on 403", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Forbidden" }),
    } as Response);

    await expect(apiFetch("/admin")).rejects.toThrow();
    expect(window.dispatchEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:session-expired" }),
    );
  });

  it("does NOT emit session-expired event on 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    } as Response);

    await expect(apiFetch("/loads")).rejects.toThrow();
    expect(window.dispatchEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:session-expired" }),
    );
  });
});
