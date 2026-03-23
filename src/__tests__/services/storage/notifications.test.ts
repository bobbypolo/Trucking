/**
 * Tests for services/storage/notifications.ts
 * API-only implementation — no localStorage.
 * Tests R-P1-24, R-P1-25, R-P1-26
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
  getRawNotificationJobs,
  saveNotificationJob,
} from "../../../../services/storage/notifications";

describe("notifications.ts (API-only)", () => {
  const mockFetch = vi.fn();

  const job = {
    id: "nj-1",
    loadId: "L-100",
    recipients: [
      { id: "u1", name: "John", role: "driver", phone: "555-0001" },
    ],
    message: "Load delayed",
    channel: "SMS" as const,
    status: "PENDING" as const,
    sentBy: "dispatcher-1",
    sentAt: "2026-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // R-P1-24: no localStorage in notifications.ts (structural — covered by grep in AC)
  // R-P1-25: STORAGE_KEY_NOTIFICATION_JOBS not exported (verified by import above)
  it("does not export STORAGE_KEY_NOTIFICATION_JOBS", async () => {
    const mod = await import("../../../../services/storage/notifications");
    expect((mod as any).STORAGE_KEY_NOTIFICATION_JOBS).toBeUndefined();
  });

  describe("getRawNotificationJobs", () => {
    it("fetches jobs from API", async () => {
      const serverJobs = [
        { ...job, id: "nj-server-1" },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serverJobs,
      });

      const result = await getRawNotificationJobs();
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/notification-jobs");
      expect(result).toEqual(serverJobs);
    });

    it("returns empty array when API returns non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      const result = await getRawNotificationJobs();
      expect(result).toEqual([]);
    });

    it("returns empty array when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const result = await getRawNotificationJobs();
      expect(result).toEqual([]);
    });
  });

  // R-P1-26: saveNotificationJob is async and returns server response
  describe("saveNotificationJob", () => {
    it("POSTs job to API and returns server response", async () => {
      const serverResponse = { ...job, id: "nj-1", status: "SENT" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serverResponse,
      });

      const result = await saveNotificationJob(job);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/notification-jobs");
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body)).toEqual(job);
      expect(result).toEqual(serverResponse);
    });

    it("propagates error when API returns non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(saveNotificationJob(job)).rejects.toThrow();
    });

    it("propagates error when fetch throws (no silent catch)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("API down"));
      await expect(saveNotificationJob(job)).rejects.toThrow("API down");
    });

    it("sends auth headers with request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => job,
      });

      await saveNotificationJob(job);

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers).toMatchObject({
        Authorization: "Bearer test-token",
      });
    });
  });
});
