import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests R-P1-03
 *
 * Verifies fetchNotifications() calls api.get('/notification-jobs')
 * and returns NotificationItem[].
 */

// Mock the api module
const mockGet = vi.fn();
vi.mock("../../src/services/api", () => ({
  default: {
    get: mockGet,
  },
}));

// Mock firebase config (transitive dependency of api.ts)
vi.mock("../../src/config/firebase", () => ({
  auth: { currentUser: null },
}));

describe("R-P1-03: fetchNotifications service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P1-03
  it("calls api.get with /notification-jobs and returns NotificationItem[]", async () => {
    const mockNotifications = [
      {
        id: "notif-1",
        channel: "push",
        message: "Load assigned to you",
        status: "SENT",
        sent_at: "2026-04-12T10:00:00Z",
        created_at: "2026-04-12T09:59:00Z",
      },
      {
        id: "notif-2",
        channel: "email",
        message: "Settlement ready for review",
        status: "SENT",
        sent_at: "2026-04-12T11:00:00Z",
        created_at: "2026-04-12T10:59:00Z",
      },
    ];

    mockGet.mockResolvedValueOnce(mockNotifications);

    const { fetchNotifications } =
      await import("../../src/services/notifications");

    const result = await fetchNotifications();

    expect(mockGet).toHaveBeenCalledWith("/notification-jobs");
    expect(result).toEqual(mockNotifications);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("notif-1");
    expect(result[0].message).toBe("Load assigned to you");
    expect(result[1].id).toBe("notif-2");
    expect(result[1].message).toBe("Settlement ready for review");
  });

  // # Tests R-P1-03
  it("returns empty array when no notifications exist", async () => {
    mockGet.mockResolvedValueOnce([]);

    const { fetchNotifications } =
      await import("../../src/services/notifications");

    const result = await fetchNotifications();

    expect(mockGet).toHaveBeenCalledWith("/notification-jobs");
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  // # Tests R-P1-03
  it("propagates API errors to the caller", async () => {
    mockGet.mockRejectedValueOnce(new Error("Network error"));

    const { fetchNotifications } =
      await import("../../src/services/notifications");

    await expect(fetchNotifications()).rejects.toThrow("Network error");
    expect(mockGet).toHaveBeenCalledWith("/notification-jobs");
  });
});
