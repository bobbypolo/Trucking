import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock config
vi.mock("../../../services/config", () => ({
  API_URL: "http://test-api:5000/api",
}));

// Mock authService
vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-jwt-token"),
}));

import { apiFetch, api } from "../../../services/api";
import { getIdTokenAsync } from "../../../services/authService";

describe("api", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
    vi.mocked(getIdTokenAsync).mockResolvedValue("mock-jwt-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- apiFetch ---
  describe("apiFetch", () => {
    it("prepends API_URL to the endpoint", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
      } as Response);

      await apiFetch("/loads");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://test-api:5000/api/loads",
        expect.anything(),
      );
    });

    it("includes Authorization header with Bearer token", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await apiFetch("/loads");
      const opts = (globalThis.fetch as any).mock.calls[0][1];
      expect(opts.headers["Authorization"]).toBe("Bearer mock-jwt-token");
    });

    it("includes Content-Type: application/json by default", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await apiFetch("/loads");
      const opts = (globalThis.fetch as any).mock.calls[0][1];
      expect(opts.headers["Content-Type"]).toBe("application/json");
    });

    it("omits Authorization header when token is null", async () => {
      vi.mocked(getIdTokenAsync).mockResolvedValue(null as any);
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await apiFetch("/loads");
      const opts = (globalThis.fetch as any).mock.calls[0][1];
      expect(opts.headers["Authorization"]).toBeUndefined();
    });

    it("returns parsed JSON on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "load-1", status: "active" }),
      } as Response);

      const result = await apiFetch("/loads/1");
      expect(result).toEqual({ id: "load-1", status: "active" });
    });

    it("throws with error message from response body on non-OK", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: "Forbidden: insufficient role" }),
      } as Response);

      await expect(apiFetch("/admin")).rejects.toThrow(
        "Forbidden: insufficient role",
      );
    });

    it("throws with status code when response body has no error field", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      } as Response);

      await expect(apiFetch("/loads")).rejects.toThrow(
        "API Request failed: 500",
      );
    });

    it("throws with status code when response body JSON parse fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error("not json")),
      } as Response);

      await expect(apiFetch("/loads")).rejects.toThrow(
        "API Request failed: 502",
      );
    });

    it("merges custom headers with defaults", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await apiFetch("/loads", {
        headers: { "X-Custom": "value" } as any,
      });
      const opts = (globalThis.fetch as any).mock.calls[0][1];
      expect(opts.headers["X-Custom"]).toBe("value");
      expect(opts.headers["Content-Type"]).toBe("application/json");
    });

    it("passes through additional RequestInit options", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await apiFetch("/loads", {
        method: "POST",
        body: JSON.stringify({ name: "test" }),
      });
      const opts = (globalThis.fetch as any).mock.calls[0][1];
      expect(opts.method).toBe("POST");
      expect(opts.body).toBe(JSON.stringify({ name: "test" }));
    });
  });

  // --- api convenience methods ---
  describe("api.get", () => {
    it("sends a GET request to the endpoint", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      await api.get("/loads");
      const opts = (globalThis.fetch as any).mock.calls[0][1];
      expect(opts.method).toBe("GET");
    });
  });

  describe("api.post", () => {
    it("sends a POST request with JSON body", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "new-1" }),
      } as Response);

      await api.post("/loads", { name: "New Load" });
      const opts = (globalThis.fetch as any).mock.calls[0][1];
      expect(opts.method).toBe("POST");
      expect(opts.body).toBe(JSON.stringify({ name: "New Load" }));
    });
  });

  describe("api.patch", () => {
    it("sends a PATCH request with JSON body", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await api.patch("/loads/1", { status: "delivered" });
      const opts = (globalThis.fetch as any).mock.calls[0][1];
      expect(opts.method).toBe("PATCH");
      expect(opts.body).toBe(JSON.stringify({ status: "delivered" }));
    });
  });

  describe("api.delete", () => {
    it("sends a DELETE request to the endpoint", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await api.delete("/loads/1");
      const opts = (globalThis.fetch as any).mock.calls[0][1];
      expect(opts.method).toBe("DELETE");
    });
  });
});
