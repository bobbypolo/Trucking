/**
 * Tests for services/storage/tasks.ts
 * Tasks & Work Items domain -- API-backed CRUD via api client.
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
  getRawTasks,
  saveTask,
  getRawWorkItems,
  getWorkItems,
  saveWorkItem,
} from "../../../../services/storage/tasks";

describe("tasks.ts — Tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRawTasks", () => {
    it("calls api.get /tasks and maps snake_case to camelCase", async () => {
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
      mockApi.get.mockResolvedValueOnce(serverTasks);

      const result = await getRawTasks();

      expect(mockApi.get).toHaveBeenCalledWith("/tasks");
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
      mockApi.get.mockResolvedValueOnce(serverTasks);

      const result = await getRawTasks();

      expect(result[0].assignedTo).toBe("user-2");
      expect(result[0].createdAt).toBe("2026-01-02T00:00:00Z");
    });

    it("handles data.tasks wrapper format", async () => {
      mockApi.get.mockResolvedValueOnce({
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
      });

      const result = await getRawTasks();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("task-3");
    });

    it("returns empty array on API error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("500"));
      expect(await getRawTasks()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("offline"));
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
      mockApi.patch.mockResolvedValueOnce({});

      const result = await saveTask(task);

      expect(mockApi.patch).toHaveBeenCalledOnce();
      const [endpoint, body] = mockApi.patch.mock.calls[0];
      expect(endpoint).toBe("/tasks/task-1");
      expect(body.assigned_to).toBe("user-1");
      expect(body.due_date).toBe("2026-03-20");
      expect(result).toEqual(task);
    });

    it("falls back to POST when PATCH fails", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("404"));
      mockApi.post.mockResolvedValueOnce({});

      await saveTask(task);

      expect(mockApi.patch).toHaveBeenCalledOnce();
      expect(mockApi.post).toHaveBeenCalledOnce();
      const [endpoint, body] = mockApi.post.mock.calls[0];
      expect(endpoint).toBe("/tasks");
      expect(body.id).toBe("task-1");
    });

    it("throws when both PATCH and POST fail", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("404"));
      mockApi.post.mockRejectedValueOnce(
        new Error("Failed to save task: 500"),
      );

      await expect(saveTask(task)).rejects.toThrow(
        "Failed to save task: 500",
      );
    });

    it("returns original task object on success", async () => {
      mockApi.patch.mockResolvedValueOnce({});

      const result = await saveTask(task);
      expect(result).toBe(task);
    });
  });
});

describe("tasks.ts — Work Items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    it("calls api.get /work-items and maps snake_case to camelCase", async () => {
      mockApi.get.mockResolvedValueOnce(serverItems);

      const result = await getRawWorkItems();

      expect(mockApi.get).toHaveBeenCalledWith("/work-items");
      expect(result).toHaveLength(2);
      expect(result[0].companyId).toBe("co-1");
      expect(result[0].entityType).toBe("LOAD");
      expect(result[0].entityId).toBe("L-1001");
      expect(result[0].createdAt).toBe("2026-01-01T00:00:00Z");
    });

    it("handles data.workItems wrapper format", async () => {
      mockApi.get.mockResolvedValueOnce({ workItems: [serverItems[0]] });

      const result = await getRawWorkItems();
      expect(result).toHaveLength(1);
    });

    it("handles data.items wrapper format", async () => {
      mockApi.get.mockResolvedValueOnce({ items: [serverItems[0]] });

      const result = await getRawWorkItems();
      expect(result).toHaveLength(1);
    });

    it("returns empty array on API error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("fail"));
      expect(await getRawWorkItems()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("offline"));
      expect(await getRawWorkItems()).toEqual([]);
    });
  });

  describe("getWorkItems (filtered)", () => {
    it("returns all items when no companyId filter", async () => {
      mockApi.get.mockResolvedValueOnce(serverItems);

      const result = await getWorkItems();
      expect(result).toHaveLength(2);
    });

    it("filters by companyId", async () => {
      mockApi.get.mockResolvedValueOnce(serverItems);

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
      mockApi.patch.mockResolvedValueOnce({});

      const result = await saveWorkItem(item);

      const [endpoint, body] = mockApi.patch.mock.calls[0];
      expect(endpoint).toBe("/work-items/wi-1");
      expect(body.entity_type).toBe("LOAD");
      expect(body.entity_id).toBe("L-1001");
      expect(result).toEqual(item);
    });

    it("falls back to POST when PATCH fails", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("fail"));
      mockApi.post.mockResolvedValueOnce({});

      await saveWorkItem(item);

      expect(mockApi.patch).toHaveBeenCalledOnce();
      expect(mockApi.post).toHaveBeenCalledOnce();
      const [endpoint] = mockApi.post.mock.calls[0];
      expect(endpoint).toBe("/work-items");
    });

    it("throws when both PATCH and POST fail", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("fail"));
      mockApi.post.mockRejectedValueOnce(
        new Error("Failed to save work item: 500"),
      );

      await expect(saveWorkItem(item)).rejects.toThrow(
        "Failed to save work item: 500",
      );
    });
  });
});
