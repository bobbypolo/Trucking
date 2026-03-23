import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests R-P1-10, R-P1-11, R-P1-12
// Verifies 401 token refresh + single retry logic in apiFetch()

vi.mock("../../../services/config", () => ({
  API_URL: "http://test-api:5000/api",
}));

const mockGetIdTokenAsync = vi.fn().mockResolvedValue("mock-jwt-token");
const mockForceRefreshToken = vi.fn().mockResolvedValue("refreshed-jwt-token");

vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: (...args: unknown[]) => mockGetIdTokenAsync(...args),
  forceRefreshToken: (...args: unknown[]) => mockForceRefreshToken(...args),
}));

import { apiFetch } from "../../../services/api";

describe("apiFetch 401 token refresh + single retry", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
    vi.spyOn(window, "dispatchEvent");
    mockGetIdTokenAsync.mockClear();
    mockGetIdTokenAsync.mockResolvedValue("mock-jwt-token");
    mockForceRefreshToken.mockClear();
    mockForceRefreshToken.mockResolvedValue("refreshed-jwt-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // R-P1-10: On first 401, token is force-refreshed and request retried once
  it("force-refreshes token and retries once on first 401", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    // First call returns 401, second call (retry) returns 200
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: "success" }),
      } as Response);

    const result = await apiFetch("/loads");

    // forceRefreshToken was called after the first 401
    expect(mockForceRefreshToken).toHaveBeenCalledTimes(1);
    // fetch was called twice: original + retry
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The retry request uses the refreshed token
    const retryOpts = fetchMock.mock.calls[1][1] as RequestInit;
    expect((retryOpts.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer refreshed-jwt-token",
    );
    // Returns the successful response
    expect(result).toEqual({ data: "success" });
  });

  // R-P1-11: If retry succeeds with fresh token, no auth:session-expired event dispatched
  it("does NOT dispatch auth:session-expired if retry succeeds", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    // First 401, then success on retry
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: "recovered" }),
      } as Response);

    await apiFetch("/loads");

    expect(window.dispatchEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:session-expired" }),
    );
  });

  // R-P1-12: If retry also returns 401, auth:session-expired event dispatched and error thrown
  it("dispatches auth:session-expired and throws if retry also returns 401", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    // Both calls return 401
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      } as Response);

    await expect(apiFetch("/loads")).rejects.toThrow(
      "Unauthorized: session expired",
    );

    expect(mockForceRefreshToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:session-expired" }),
    );
  });

  it("does not retry on non-401 errors (e.g. 500)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    } as Response);

    await expect(apiFetch("/loads")).rejects.toThrow("API Request failed: 500");

    expect(mockForceRefreshToken).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 403 errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Forbidden" }),
    } as Response);

    await expect(apiFetch("/admin")).rejects.toThrow("Forbidden");

    expect(mockForceRefreshToken).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("handles forceRefreshToken returning null gracefully", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    mockForceRefreshToken.mockResolvedValueOnce(null);

    // First call returns 401, retry also returns 401 (no valid token)
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      } as Response);

    await expect(apiFetch("/loads")).rejects.toThrow(
      "Unauthorized: session expired",
    );

    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:session-expired" }),
    );
  });
});
