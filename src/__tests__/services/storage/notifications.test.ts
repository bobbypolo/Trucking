/**
 * Tests for services/storage/notifications.ts
 * API-only implementation — no localStorage.
 * Tests R-P1-24, R-P1-25, R-P1-26
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}));

vi.mock("../../../../services/api", () => ({
  api: mockApi,
  apiFetch: vi.fn(),
}));

import {
  getRawNotificationJobs,
  saveNotificationJob,
} from "../../../../services/storage/notifications";

describe("notifications.ts (API-only)", () => {
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
    vi.clearAllMocks();
  });

  // R-P1-24: no localStorage in notifications.ts
  // R-P1-25: STORAGE_KEY_NOTIFICATION_JOBS not exported
  it("does not export STORAGE_KEY_NOTIFICATION_JOBS", async () => {
    const mod = await import("../../../../services/storage/notifications");
    expect((mod as any).STORAGE_KEY_NOTIFICATION_JOBS).toBeUndefined();
  });

  describe("getRawNotificationJobs", () => {
    it("fetches jobs from API", async () => {
      const serverJobs = [{ ...job, id: "nj-server-1" }];
      mockApi.get.mockResolvedValueOnce(serverJobs);

      const result = await getRawNotificationJobs();

      expect(mockApi.get).toHaveBeenCalledWith("/notification-jobs");
      expect(result).toEqual(serverJobs);
    });

    it("returns empty array when API throws", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("401"));
      const result = await getRawNotificationJobs();
      expect(result).toEqual([]);
    });

    it("returns empty array when fetch throws", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("Network error"));
      const result = await getRawNotificationJobs();
      expect(result).toEqual([]);
    });
  });

  // R-P1-26: saveNotificationJob is async and returns server response
  describe("saveNotificationJob", () => {
    it("POSTs job to API and returns server response", async () => {
      const serverResponse = { ...job, id: "nj-1", status: "SENT" };
      mockApi.post.mockResolvedValueOnce(serverResponse);

      const result = await saveNotificationJob(job);

      expect(mockApi.post).toHaveBeenCalledWith("/notification-jobs", job);
      expect(result).toEqual(serverResponse);
    });

    it("propagates error when API throws", async () => {
      mockApi.post.mockRejectedValueOnce(
        new Error("API Request failed: 500"),
      );
      await expect(saveNotificationJob(job)).rejects.toThrow();
    });

    it("propagates error when fetch throws (no silent catch)", async () => {
      mockApi.post.mockRejectedValueOnce(new Error("API down"));
      await expect(saveNotificationJob(job)).rejects.toThrow("API down");
    });
  });
});
