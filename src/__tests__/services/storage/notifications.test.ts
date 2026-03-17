/**
 * Tests for services/storage/notifications.ts
 * Notification Jobs domain -- localStorage CRUD with API sync.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../services/authService", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
  getCurrentUser: vi.fn().mockReturnValue({ companyId: "test-co" }),
}));

import { getCurrentUser } from "../../../../services/authService";
const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

vi.mock("../../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

import {
  STORAGE_KEY_NOTIFICATION_JOBS,
  getRawNotificationJobs,
  saveNotificationJob,
} from "../../../../services/storage/notifications";

describe("notifications.ts", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  describe("STORAGE_KEY_NOTIFICATION_JOBS", () => {
    it("returns tenant-scoped key", () => {
      const key = STORAGE_KEY_NOTIFICATION_JOBS();
      expect(key).toContain("test-co");
      expect(key).toContain("notification_jobs_v1");
    });
  });

  describe("getRawNotificationJobs", () => {
    it("returns empty array when no data exists", () => {
      expect(getRawNotificationJobs()).toEqual([]);
    });

    it("returns parsed jobs from localStorage", () => {
      const jobs = [
        {
          id: "nj-1",
          loadId: "L-100",
          recipients: [{ id: "u1", name: "John", role: "driver", phone: "555-0001" }],
          message: "Your load is delayed",
          channel: "SMS",
          status: "SENT",
          sentBy: "dispatcher-1",
          sentAt: "2026-01-01T00:00:00Z",
        },
      ];
      localStorage.setItem(
        STORAGE_KEY_NOTIFICATION_JOBS(),
        JSON.stringify(jobs),
      );

      const result = getRawNotificationJobs();
      expect(result).toEqual(jobs);
    });

    it("returns empty array on parse error", () => {
      localStorage.setItem(
        STORAGE_KEY_NOTIFICATION_JOBS(),
        "corrupt{json",
      );
      expect(getRawNotificationJobs()).toEqual([]);
    });
  });

  describe("saveNotificationJob", () => {
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

    it("adds new job to beginning of list in localStorage", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveNotificationJob(job);

      const stored = getRawNotificationJobs();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("nj-1");
    });

    it("updates existing job in-place", async () => {
      localStorage.setItem(
        STORAGE_KEY_NOTIFICATION_JOBS(),
        JSON.stringify([job]),
      );
      mockFetch.mockResolvedValueOnce({ ok: true });

      const updated = { ...job, status: "SENT" as const };
      await saveNotificationJob(updated);

      const stored = getRawNotificationJobs();
      expect(stored).toHaveLength(1);
      expect(stored[0].status).toBe("SENT");
    });

    it("syncs to API via POST", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveNotificationJob(job);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/notification-jobs");
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body)).toEqual(job);
    });

    it("still saves to localStorage when API sync fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("API down"));

      await saveNotificationJob(job);

      const stored = getRawNotificationJobs();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("nj-1");
    });

    it("returns the saved job", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await saveNotificationJob(job);
      expect(result).toEqual(job);
    });

    it("preserves existing jobs when adding new one", async () => {
      localStorage.setItem(
        STORAGE_KEY_NOTIFICATION_JOBS(),
        JSON.stringify([
          {
            id: "nj-existing",
            message: "Existing",
            channel: "Email",
            status: "SENT",
            sentBy: "admin",
            sentAt: "2026-01-01",
            recipients: [],
          },
        ]),
      );
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveNotificationJob(job);

      const stored = getRawNotificationJobs();
      expect(stored).toHaveLength(2);
      expect(stored[0].id).toBe("nj-1"); // new at front
      expect(stored[1].id).toBe("nj-existing"); // existing preserved
    });
  });

  describe("tenant isolation", () => {
    it("notification jobs from different tenants use different keys", () => {
      mockGetCurrentUser.mockReturnValue({ companyId: "co-a" });
      const keyA = STORAGE_KEY_NOTIFICATION_JOBS();

      mockGetCurrentUser.mockReturnValue({ companyId: "co-b" });
      const keyB = STORAGE_KEY_NOTIFICATION_JOBS();

      expect(keyA).not.toBe(keyB);
      expect(keyA).toContain("co-a");
      expect(keyB).toContain("co-b");

      // Restore
      mockGetCurrentUser.mockReturnValue({ companyId: "test-co" });
    });
  });
});
