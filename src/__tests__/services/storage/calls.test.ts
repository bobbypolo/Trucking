/**
 * Tests for services/storage/calls.ts
 * Call Sessions domain -- API-backed CRUD via api client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi, mockApiFetch } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
  mockApiFetch: vi.fn(),
}));

vi.mock("../../../../services/api", () => ({
  api: mockApi,
  apiFetch: mockApiFetch,
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
  beforeEach(() => {
    vi.clearAllMocks();
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
      mockApi.get.mockResolvedValueOnce({ sessions: [serverSession] });

      const result = await getRawCalls();

      expect(mockApi.get).toHaveBeenCalledWith("/call-sessions");
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
      mockApi.get.mockResolvedValueOnce({ sessions: [sessionNoActivity] });

      const result = await getRawCalls();
      expect(result[0].lastActivityAt).toBe(serverSession.start_time);
    });

    it("defaults participants and links to empty arrays when missing", async () => {
      const minimal = {
        id: "sess-2",
        start_time: "2026-01-01T10:00:00Z",
        status: "ACTIVE",
      };
      mockApi.get.mockResolvedValueOnce({ sessions: [minimal] });

      const result = await getRawCalls();
      expect(result[0].participants).toEqual([]);
      expect(result[0].links).toEqual([]);
    });

    it("throws on API error instead of returning empty array", async () => {
      // Tests R-P2-21
      mockApi.get.mockRejectedValueOnce(new Error("401 Unauthorized"));
      await expect(getRawCalls()).rejects.toThrow("401 Unauthorized");
    });

    it("throws on network error instead of returning empty array", async () => {
      // Tests R-P2-21
      mockApi.get.mockRejectedValueOnce(new Error("offline"));
      await expect(getRawCalls()).rejects.toThrow("offline");
    });

    it("handles empty sessions list", async () => {
      mockApi.get.mockResolvedValueOnce({ sessions: [] });
      expect(await getRawCalls()).toEqual([]);
    });

    it("handles missing sessions key in response", async () => {
      mockApi.get.mockResolvedValueOnce({});
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

    it("sends PUT via apiFetch with snake_case body", async () => {
      mockApiFetch.mockResolvedValueOnce({});

      await saveCallSession(session);

      expect(mockApiFetch).toHaveBeenCalledOnce();
      const [endpoint, opts] = mockApiFetch.mock.calls[0];
      expect(endpoint).toBe("/call-sessions/sess-1");
      expect(opts.method).toBe("PUT");
      const body = JSON.parse(opts.body);
      expect(body.start_time).toBe("2026-01-01T10:00:00Z");
      expect(body.end_time).toBe("2026-01-01T10:30:00Z");
      expect(body.duration_seconds).toBe(1800);
      expect(body.assigned_to).toBe("user-1");
    });

    it("falls back to POST when PUT fails", async () => {
      mockApiFetch.mockRejectedValueOnce(new Error("404"));
      mockApi.post.mockResolvedValueOnce({});

      await saveCallSession(session);

      expect(mockApiFetch).toHaveBeenCalledOnce();
      expect(mockApi.post).toHaveBeenCalledOnce();
      const [endpoint, postBody] = mockApi.post.mock.calls[0];
      expect(endpoint).toBe("/call-sessions");
      expect(postBody.id).toBe("sess-1");
    });

    it("throws when both PUT and POST fail", async () => {
      mockApiFetch.mockRejectedValueOnce(new Error("PUT failed"));
      mockApi.post.mockRejectedValueOnce(
        new Error("Failed to save call session: 500"),
      );

      await expect(saveCallSession(session)).rejects.toThrow(
        "Failed to save call session: 500",
      );
    });
  });

  describe("attachToRecord", () => {
    it("attaches a record link to an existing call session", async () => {
      mockApi.get.mockResolvedValueOnce({
        sessions: [
          {
            id: "sess-1",
            start_time: "2026-01-01T10:00:00Z",
            status: "ACTIVE",
            participants: [],
            links: [],
          },
        ],
      });
      mockApiFetch.mockResolvedValueOnce({});

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
      expect(result!.links[0].isPrimary).toBe(true);
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
      mockApi.get.mockResolvedValueOnce({
        sessions: [
          {
            id: "sess-1",
            start_time: "2026-01-01T10:00:00Z",
            status: "ACTIVE",
            participants: [],
            links: [existingLink],
          },
        ],
      });
      mockApiFetch.mockResolvedValueOnce({});

      const result = await attachToRecord("sess-1", "DRIVER", "D-1", "Jane");

      expect(result!.links).toHaveLength(2);
      expect(result!.links[1].isPrimary).toBe(false);
    });

    it("returns null when session is not found", async () => {
      mockApi.get.mockResolvedValueOnce({ sessions: [] });

      const result = await attachToRecord("nonexistent", "LOAD", "L-1", "User");
      expect(result).toBeNull();
    });
  });

  describe("linkSessionToRecord", () => {
    it("links a session to a record with isPrimary=true", async () => {
      mockApi.get.mockResolvedValueOnce({
        sessions: [
          {
            id: "sess-1",
            start_time: "2026-01-01",
            status: "ACTIVE",
            participants: [],
            links: [],
          },
        ],
      });
      mockApiFetch.mockResolvedValueOnce({});

      await linkSessionToRecord("sess-1", "L-100", "LOAD");

      expect(mockApiFetch).toHaveBeenCalledOnce();
    });

    it("does nothing when session is not found", async () => {
      mockApi.get.mockResolvedValueOnce({ sessions: [] });

      await linkSessionToRecord("nonexistent", "L-100", "LOAD");

      expect(mockApiFetch).not.toHaveBeenCalled();
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
      mockApi.get.mockResolvedValueOnce({
        sessions: [
          {
            id: "sess-1",
            start_time: "2026-01-01",
            status: "ACTIVE",
            participants: [],
            links: [existingLink],
          },
        ],
      });
      mockApiFetch.mockResolvedValueOnce({});

      await linkSessionToRecord("sess-1", "D-1", "DRIVER");

      expect(mockApiFetch).toHaveBeenCalledOnce();
    });
  });
});
