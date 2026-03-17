// Tests R-S16-01, R-S16-02, R-S16-03
/**
 * STORY-016: Frontend Cutover -- Calls, Tasks, Work Items
 * Verifies that calls.ts, tasks.ts use API calls (not localStorage)
 * and that storage key constants are removed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

vi.mock("../../../services/authService", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
}));

vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

import { getRawCalls, saveCallSession } from "../../../services/storage/calls";
import {
  getRawTasks,
  getRawWorkItems,
  getWorkItems,
} from "../../../services/storage/tasks";

// ---- R-S16-01: STORAGE_KEY_* constants removed ----
describe("R-S16-01: STORAGE_KEY constants removed from all files", () => {
  it("calls.ts does not define STORAGE_KEY_CALLS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/calls.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_CALLS");
  });

  it("tasks.ts does not define STORAGE_KEY_TASKS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/tasks.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_TASKS");
  });

  it("tasks.ts does not define STORAGE_KEY_WORK_ITEMS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/tasks.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_WORK_ITEMS");
  });

  it("index.ts does not re-export STORAGE_KEY_CALLS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/index.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_CALLS");
  });

  it("index.ts does not re-export STORAGE_KEY_TASKS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/index.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_TASKS");
  });

  it("index.ts does not re-export STORAGE_KEY_WORK_ITEMS", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/index.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_WORK_ITEMS");
  });

  it("storageService.ts does not re-export call session storage key", () => {
    const src = fs.readFileSync(
      path.resolve("services/storageService.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_CALLS");
  });

  it("storageService.ts does not re-export task storage key", () => {
    const src = fs.readFileSync(
      path.resolve("services/storageService.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_TASKS");
  });

  it("storageService.ts does not re-export work item storage key", () => {
    const src = fs.readFileSync(
      path.resolve("services/storageService.ts"),
      "utf-8",
    );
    expect(src).not.toContain("STORAGE_KEY_WORK_ITEMS");
  });
});

// ---- R-S16-02: All three entities use server API for CRUD ----
describe("R-S16-02: API calls used for calls, tasks, work-items CRUD", () => {
  it("calls.ts fetches from call-sessions endpoint", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/calls.ts"),
      "utf-8",
    );
    expect(src).toMatch(/call-sessions/);
  });

  it("calls.ts uses getAuthHeaders for auth", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/calls.ts"),
      "utf-8",
    );
    expect(src).toContain("getAuthHeaders");
  });

  it("tasks.ts fetches from tasks endpoint", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/tasks.ts"),
      "utf-8",
    );
    expect(src).toMatch(/\/tasks/);
  });

  it("tasks.ts fetches from work-items endpoint", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/tasks.ts"),
      "utf-8",
    );
    expect(src).toMatch(/work-items/);
  });

  it("calls.ts does not use localStorage", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/calls.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/localStorage/);
  });

  it("tasks.ts does not use localStorage", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/tasks.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/localStorage/);
  });

  it("calls.ts imports API_URL from config", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/calls.ts"),
      "utf-8",
    );
    expect(src).toContain("API_URL");
  });

  it("tasks.ts imports API_URL from config", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/tasks.ts"),
      "utf-8",
    );
    expect(src).toContain("API_URL");
  });
});

// ---- R-S16-02 Functional: fetch mock tests ----
describe("R-S16-02: getRawCalls functional", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getRawCalls calls GET /api/call-sessions and maps response", async () => {
    const fakeSessions = [
      {
        id: "sess-1",
        start_time: new Date().toISOString(),
        status: "WAITING",
        participants: [],
        links: [],
        last_activity_at: new Date().toISOString(),
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: fakeSessions }),
    });

    const result = await getRawCalls();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/call-sessions/);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sess-1");
    expect(result[0].status).toBe("WAITING");
  });

  it("saveCallSession PUT succeeds without POST fallback", async () => {
    const session = {
      id: "sess-ok",
      startTime: new Date().toISOString(),
      status: "ACTIVE" as const,
      participants: [],
      links: [],
      lastActivityAt: new Date().toISOString(),
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await saveCallSession(session);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/call-sessions\/sess-ok/);
    expect(opts?.method).toBe("PUT");
  });

  it("saveCallSession falls back to POST when PUT returns 404", async () => {
    const session = {
      id: "sess-new",
      startTime: new Date().toISOString(),
      status: "ACTIVE" as const,
      participants: [],
      links: [],
      lastActivityAt: new Date().toISOString(),
    };
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await saveCallSession(session);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [, putOpts] = mockFetch.mock.calls[0];
    expect(putOpts?.method).toBe("PUT");
    const [postUrl, postOpts] = mockFetch.mock.calls[1];
    expect(postUrl).toMatch(/\/api\/call-sessions$/);
    expect(postOpts?.method).toBe("POST");
  });
});

describe("R-S16-02: getRawTasks and work items functional", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getRawTasks calls GET /api/tasks and maps response", async () => {
    const fakeTasks = [
      {
        id: "task-1",
        type: "REPOWER_HANDOFF",
        title: "Urgent Repower",
        status: "OPEN",
        priority: "CRITICAL",
        links: [],
        created_at: new Date().toISOString(),
        created_by: "dispatcher-1",
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeTasks,
    });

    const result = await getRawTasks();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/tasks/);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("task-1");
    expect(result[0].status).toBe("OPEN");
  });

  it("getRawWorkItems calls GET /api/work-items and maps response", async () => {
    const fakeItems = [
      {
        id: "wi-1",
        company_id: "co-1",
        type: "Detention_Review",
        label: "Detention: LP-9001",
        status: "Pending",
        priority: "High",
        entity_type: "LOAD",
        entity_id: "L-1001",
        created_at: new Date().toISOString(),
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeItems,
    });

    const result = await getRawWorkItems();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/work-items/);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wi-1");
    expect(result[0].companyId).toBe("co-1");
  });

  it("getWorkItems filters by companyId", async () => {
    const fakeItems = [
      {
        id: "wi-1",
        company_id: "co-1",
        type: "Detention_Review",
        label: "Detention",
        status: "Pending",
        priority: "High",
        entity_type: "LOAD",
        entity_id: "L-1001",
        created_at: new Date().toISOString(),
      },
      {
        id: "wi-2",
        company_id: "co-2",
        type: "Document_Issue",
        label: "Missing BOL",
        status: "Pending",
        priority: "Critical",
        entity_type: "LOAD",
        entity_id: "L-1002",
        created_at: new Date().toISOString(),
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeItems,
    });

    const result = await getWorkItems("co-1");

    expect(result).toHaveLength(1);
    expect(result[0].companyId).toBe("co-1");
  });
});

// ---- R-S16-03: No DEMO_MODE seed data for calls or tasks ----
describe("R-S16-03: No DEMO_MODE seed data", () => {
  it("calls.ts has no DEMO_MODE references", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/calls.ts"),
      "utf-8",
    );
    expect(src).not.toContain("DEMO_MODE");
  });

  it("tasks.ts has no DEMO_MODE references", () => {
    const src = fs.readFileSync(
      path.resolve("services/storage/tasks.ts"),
      "utf-8",
    );
    expect(src).not.toContain("DEMO_MODE");
  });

  it("storageService.ts does not seed CALL-INT-101 call session", () => {
    const src = fs.readFileSync(
      path.resolve("services/storageService.ts"),
      "utf-8",
    );
    expect(src).not.toContain("CALL-INT-101");
  });

  it("storageService.ts does not seed WI-5001 work item", () => {
    const src = fs.readFileSync(
      path.resolve("services/storageService.ts"),
      "utf-8",
    );
    expect(src).not.toContain("WI-5001");
  });
});
