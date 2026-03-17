/**
 * Tests for services/storage/tasks.ts
 * Tasks & Work Items domain -- API-backed CRUD.
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

import {
  getRawTasks,
  saveTask,
  getRawWorkItems,
  getWorkItems,
  saveWorkItem,
} from "../../../../services/storage/tasks";

describe("tasks.ts — Tasks", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getRawTasks", () => {
    it("calls GET /api/tasks and maps snake_case to camelCase", async () => {
      const serverTasks = [
        {
          id: "task-1",
          type: "GENERAL",
          title: "Test task",
          description: "Desc",
          status: "OPEN",
          priority: "HIGH",
          assigned_to: "user-1",
          due_date: "2026-03-20",
          links: [],
          created_at: "2026-01-01T00:00:00Z",
          created_by: "admin",
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serverTasks,
      });

      const result = await getRawTasks();

      expect(result).toHaveLength(1);
      expect(result[0].assignedTo).toBe("user-1");
      expect(result[0].dueDate).toBe("2026-03-20");
      expect(result[0].createdAt).toBe("2026-01-01T00:00:00Z");
      expect(result[0].createdBy).toBe("admin");
    });

    it("handles camelCase response fields", async () => {
      const serverTasks = [
        {
          id: "task-2",
          type: "FOLLOW_UP",
          title: "Follow up",
          description: "Desc",
          status: "IN_PROGRESS",
          priority: "MEDIUM",
          assignedTo: "user-2",
          dueDate: "2026-03-25",
          links: [],
          createdAt: "2026-01-02T00:00:00Z",
          createdBy: "dispatcher",
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serverTasks,
      });

      const result = await getRawTasks();

      expect(result[0].assignedTo).toBe("user-2");
      expect(result[0].createdAt).toBe("2026-01-02T00:00:00Z");
    });

    it("handles data.tasks wrapper format", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [
            {
              id: "task-3",
              title: "Wrapped",
              description: "D",
              status: "OPEN",
              priority: "LOW",
              links: [],
            },
          ],
        }),
      });

      const result = await getRawTasks();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("task-3");
    });

    it("returns empty array on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      expect(await getRawTasks()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("offline"));
      expect(await getRawTasks()).toEqual([]);
    });
  });

  describe("saveTask", () => {
    const task = {
      id: "task-1",
      type: "GENERAL" as const,
      title: "Test task",
      description: "Description",
      status: "OPEN" as const,
      priority: "HIGH" as const,
      assignedTo: "user-1",
      dueDate: "2026-03-20",
      links: [],
      createdAt: "2026-01-01T00:00:00Z",
    };

    it("tries PATCH first with snake_case body", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await saveTask(task);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/tasks/task-1");
      expect(opts.method).toBe("PATCH");
      const body = JSON.parse(opts.body);
      expect(body.assigned_to).toBe("user-1");
      expect(body.due_date).toBe("2026-03-20");
      expect(result).toEqual(task);
    });

    it("falls back to POST when PATCH fails", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true });

      await saveTask(task);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [postUrl, postOpts] = mockFetch.mock.calls[1];
      expect(postUrl).toBe("http://localhost:5000/api/tasks");
      expect(postOpts.method).toBe("POST");
      const body = JSON.parse(postOpts.body);
      expect(body.id).toBe("task-1");
    });

    it("throws when both PATCH and POST fail", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(saveTask(task)).rejects.toThrow("Failed to save task: 500");
    });

    it("returns original task object on success", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await saveTask(task);
      expect(result).toBe(task);
    });
  });
});

describe("tasks.ts — Work Items", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const serverItems = [
    {
      id: "wi-1",
      company_id: "co-1",
      type: "Detention_Review",
      label: "Detention: LP-9001",
      description: "Review detention",
      priority: "High",
      status: "Pending",
      entity_type: "LOAD",
      entity_id: "L-1001",
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "wi-2",
      company_id: "co-2",
      type: "Document_Issue",
      label: "Missing BOL",
      description: "Need BOL",
      priority: "Critical",
      status: "Open",
      entity_type: "LOAD",
      entity_id: "L-1002",
      created_at: "2026-01-02T00:00:00Z",
    },
  ];

  describe("getRawWorkItems", () => {
    it("calls GET /api/work-items and maps snake_case to camelCase", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serverItems,
      });

      const result = await getRawWorkItems();

      expect(result).toHaveLength(2);
      expect(result[0].companyId).toBe("co-1");
      expect(result[0].entityType).toBe("LOAD");
      expect(result[0].entityId).toBe("L-1001");
      expect(result[0].createdAt).toBe("2026-01-01T00:00:00Z");
    });

    it("handles data.workItems wrapper format", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workItems: [serverItems[0]] }),
      });

      const result = await getRawWorkItems();
      expect(result).toHaveLength(1);
    });

    it("handles data.items wrapper format", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [serverItems[0]] }),
      });

      const result = await getRawWorkItems();
      expect(result).toHaveLength(1);
    });

    it("returns empty array on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await getRawWorkItems()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("offline"));
      expect(await getRawWorkItems()).toEqual([]);
    });
  });

  describe("getWorkItems (filtered)", () => {
    it("returns all items when no companyId filter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serverItems,
      });

      const result = await getWorkItems();
      expect(result).toHaveLength(2);
    });

    it("filters by companyId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serverItems,
      });

      const result = await getWorkItems("co-1");
      expect(result).toHaveLength(1);
      expect(result[0].companyId).toBe("co-1");
    });
  });

  describe("saveWorkItem", () => {
    const item = {
      id: "wi-1",
      companyId: "co-1",
      type: "Detention_Review" as any,
      label: "Test item",
      description: "Description",
      priority: "High" as const,
      status: "Pending" as const,
      entityType: "LOAD" as const,
      entityId: "L-1001",
      createdAt: "2026-01-01T00:00:00Z",
    };

    it("tries PATCH first with snake_case body", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await saveWorkItem(item);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/work-items/wi-1");
      expect(opts.method).toBe("PATCH");
      const body = JSON.parse(opts.body);
      expect(body.entity_type).toBe("LOAD");
      expect(body.entity_id).toBe("L-1001");
      expect(result).toEqual(item);
    });

    it("falls back to POST when PATCH fails", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true });

      await saveWorkItem(item);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [postUrl, postOpts] = mockFetch.mock.calls[1];
      expect(postUrl).toBe("http://localhost:5000/api/work-items");
      expect(postOpts.method).toBe("POST");
    });

    it("throws when both PATCH and POST fail", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(saveWorkItem(item)).rejects.toThrow(
        "Failed to save work item: 500",
      );
    });
  });
});
