/**
 * Tests for services/storage/calls.ts
 * Call Sessions domain -- API-backed CRUD.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../services/authService", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
  getCurrentUser: vi.fn(),
}));

vi.mock("../../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-link-id"),
}));

import {
  getRawCalls,
  saveCallSession,
  attachToRecord,
  linkSessionToRecord,
} from "../../../../services/storage/calls";

describe("calls.ts", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const serverSession = {
    id: "sess-1",
    start_time: "2026-01-01T10:00:00Z",
    end_time: "2026-01-01T10:30:00Z",
    duration_seconds: 1800,
    status: "COMPLETED",
    assigned_to: "user-1",
    team: "dispatch",
    notes: "Call about load delay",
    participants: [{ id: "p1", name: "John", role: "dispatcher" }],
    links: [
      {
        id: "link-1",
        entityType: "LOAD",
        entityId: "L-100",
        isPrimary: true,
        createdAt: "2026-01-01T10:00:00Z",
        createdBy: "user-1",
      },
    ],
    last_activity_at: "2026-01-01T10:30:00Z",
  };

  describe("getRawCalls", () => {
    it("maps snake_case server response to camelCase", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [serverSession] }),
      });

      const result = await getRawCalls();

      expect(result).toHaveLength(1);
      expect(result[0].startTime).toBe("2026-01-01T10:00:00Z");
      expect(result[0].endTime).toBe("2026-01-01T10:30:00Z");
      expect(result[0].durationSeconds).toBe(1800);
      expect(result[0].assignedTo).toBe("user-1");
      expect(result[0].lastActivityAt).toBe("2026-01-01T10:30:00Z");
    });

    it("defaults lastActivityAt to start_time when last_activity_at is missing", async () => {
      const sessionNoActivity = {
        ...serverSession,
        last_activity_at: undefined,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [sessionNoActivity] }),
      });

      const result = await getRawCalls();
      expect(result[0].lastActivityAt).toBe(serverSession.start_time);
    });

    it("defaults participants and links to empty arrays when missing", async () => {
      const minimal = {
        id: "sess-2",
        start_time: "2026-01-01T10:00:00Z",
        status: "ACTIVE",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [minimal] }),
      });

      const result = await getRawCalls();
      expect(result[0].participants).toEqual([]);
      expect(result[0].links).toEqual([]);
    });

    it("returns empty array on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      expect(await getRawCalls()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("offline"));
      expect(await getRawCalls()).toEqual([]);
    });

    it("handles empty sessions list", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [] }),
      });
      expect(await getRawCalls()).toEqual([]);
    });

    it("handles missing sessions key in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });
      const result = await getRawCalls();
      expect(result).toEqual([]);
    });
  });

  describe("saveCallSession", () => {
    const session = {
      id: "sess-1",
      startTime: "2026-01-01T10:00:00Z",
      endTime: "2026-01-01T10:30:00Z",
      durationSeconds: 1800,
      status: "COMPLETED" as const,
      assignedTo: "user-1",
      team: "dispatch",
      notes: "Test notes",
      participants: [],
      links: [],
      lastActivityAt: "2026-01-01T10:30:00Z",
    };

    it("sends PUT with snake_case body", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveCallSession(session);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/call-sessions/sess-1");
      expect(opts.method).toBe("PUT");
      const body = JSON.parse(opts.body);
      expect(body.start_time).toBe("2026-01-01T10:00:00Z");
      expect(body.end_time).toBe("2026-01-01T10:30:00Z");
      expect(body.duration_seconds).toBe(1800);
      expect(body.assigned_to).toBe("user-1");
    });

    it("falls back to POST when PUT fails", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true });

      await saveCallSession(session);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [postUrl, postOpts] = mockFetch.mock.calls[1];
      expect(postUrl).toBe("http://localhost:5000/api/call-sessions");
      expect(postOpts.method).toBe("POST");
      const body = JSON.parse(postOpts.body);
      expect(body.id).toBe("sess-1");
    });

    it("throws when both PUT and POST fail", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(saveCallSession(session)).rejects.toThrow(
        "Failed to save call session: 500",
      );
    });
  });

  describe("attachToRecord", () => {
    it("attaches a record link to an existing call session", async () => {
      // First call: getRawCalls
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            {
              id: "sess-1",
              start_time: "2026-01-01T10:00:00Z",
              status: "ACTIVE",
              participants: [],
              links: [],
            },
          ],
        }),
      });
      // Second call: saveCallSession (PUT)
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await attachToRecord(
        "sess-1",
        "LOAD",
        "L-100",
        "John Doe",
      );

      expect(result).not.toBeNull();
      expect(result!.links).toHaveLength(1);
      expect(result!.links[0].entityType).toBe("LOAD");
      expect(result!.links[0].entityId).toBe("L-100");
      expect(result!.links[0].isPrimary).toBe(true); // first link is primary
      expect(result!.links[0].createdBy).toBe("John Doe");
    });

    it("marks new link as non-primary when session already has links", async () => {
      const existingLink = {
        id: "link-1",
        entityType: "LOAD",
        entityId: "L-50",
        isPrimary: true,
        createdAt: "2026-01-01",
        createdBy: "System",
      };
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sessions: [
              {
                id: "sess-1",
                start_time: "2026-01-01T10:00:00Z",
                status: "ACTIVE",
                participants: [],
                links: [existingLink],
              },
            ],
          }),
        })
        .mockResolvedValueOnce({ ok: true });

      const result = await attachToRecord(
        "sess-1",
        "DRIVER",
        "D-1",
        "Jane",
      );

      expect(result!.links).toHaveLength(2);
      expect(result!.links[1].isPrimary).toBe(false);
    });

    it("returns null when session is not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [] }),
      });

      const result = await attachToRecord(
        "nonexistent",
        "LOAD",
        "L-1",
        "User",
      );
      expect(result).toBeNull();
    });
  });

  describe("linkSessionToRecord", () => {
    it("links a session to a record with isPrimary=true", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sessions: [
              {
                id: "sess-1",
                start_time: "2026-01-01",
                status: "ACTIVE",
                participants: [],
                links: [],
              },
            ],
          }),
        })
        .mockResolvedValueOnce({ ok: true });

      await linkSessionToRecord("sess-1", "L-100", "LOAD");

      // Should have called saveCallSession with the link
      const [, opts] = mockFetch.mock.calls[1];
      const body = JSON.parse(opts.body);
      expect(body.links).toHaveLength(1);
    });

    it("does nothing when session is not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [] }),
      });

      await linkSessionToRecord("nonexistent", "L-100", "LOAD");

      // Should only call getRawCalls, not saveCallSession
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it("appends link to existing links", async () => {
      const existingLink = {
        id: "existing",
        entityType: "LOAD",
        entityId: "L-50",
        isPrimary: true,
        createdAt: "2026-01-01",
        createdBy: "System",
      };
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sessions: [
              {
                id: "sess-1",
                start_time: "2026-01-01",
                status: "ACTIVE",
                participants: [],
                links: [existingLink],
              },
            ],
          }),
        })
        .mockResolvedValueOnce({ ok: true });

      await linkSessionToRecord("sess-1", "D-1", "DRIVER");

      const [, opts] = mockFetch.mock.calls[1];
      const body = JSON.parse(opts.body);
      expect(body.links).toHaveLength(2);
    });
  });
});
