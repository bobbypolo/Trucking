import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests R-P7-01, R-P7-02, R-P7-09
 *
 * Verifies reportIssue calls api.post('/driver/exceptions') with correct payload.
 * Verifies fetchDriverExceptions calls api.get('/driver/exceptions?loadId={loadId}').
 * Verifies offline queue: stores payload in AsyncStorage when offline.
 */

// Hoist mock variables so vi.mock factories can reference them
const { mockPost, mockGet, onlineState } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
  onlineState: { value: true },
}));

// Mock the api module
vi.mock("../../src/services/api", () => ({
  default: {
    post: mockPost,
    get: mockGet,
  },
}));

// Mock firebase config (transitive dependency of api.ts)
vi.mock("../../src/config/firebase", () => ({
  auth: { currentUser: null },
}));

// Mock connectivity
vi.mock("../../src/services/connectivity", () => ({
  getIsOnline: () => onlineState.value,
}));

// Mock uploadQueue (transitive dependency of connectivity.ts)
vi.mock("../../src/services/uploadQueue", () => ({
  processQueue: vi.fn().mockResolvedValue(undefined),
}));

// Use the built-in async-storage mock (aliased in vitest.config.ts)
// AsyncStorage is already mocked via resolve.alias

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  reportIssue,
  fetchDriverExceptions,
  syncOfflineIssues,
} from "../../src/services/issues";
import type { CreateIssuePayload } from "../../src/types/issue";

describe("R-P7-01: reportIssue calls api.post('/driver/exceptions')", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onlineState.value = true;
    AsyncStorage.clear();
  });

  // # Tests R-P7-01
  it("sends POST to /driver/exceptions with issue_type, load_id, description", async () => {
    const payload: CreateIssuePayload = {
      issue_type: "Breakdown",
      load_id: "L1",
      description: "Engine overheated on I-40",
    };
    mockPost.mockResolvedValue({ id: "EX-001" });

    const result = await reportIssue(payload);

    expect(mockPost).toHaveBeenCalledWith("/driver/exceptions", {
      issue_type: "Breakdown",
      load_id: "L1",
      description: "Engine overheated on I-40",
    });
    expect(result).toEqual({ id: "EX-001" });
  });

  // # Tests R-P7-01
  it("sends POST with optional photo_urls when provided", async () => {
    const payload: CreateIssuePayload = {
      issue_type: "Delay",
      load_id: "L2",
      description: "Traffic jam",
      photo_urls: ["https://example.com/photo1.jpg"],
    };
    mockPost.mockResolvedValue({ id: "EX-002" });

    const result = await reportIssue(payload);

    expect(mockPost).toHaveBeenCalledWith("/driver/exceptions", {
      issue_type: "Delay",
      load_id: "L2",
      description: "Traffic jam",
      photo_urls: ["https://example.com/photo1.jpg"],
    });
    expect(result).toEqual({ id: "EX-002" });
  });
});

describe("R-P7-02: fetchDriverExceptions calls api.get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P7-02
  it("calls api.get('/driver/exceptions?loadId={loadId}') with loadId", async () => {
    const mockExceptions = [
      {
        id: "EX-001",
        issue_type: "Breakdown",
        load_id: "L1",
        description: "Engine issue",
        photo_urls: [],
        status: "open",
        created_at: "2026-04-12T10:00:00Z",
      },
    ];
    mockGet.mockResolvedValue({ exceptions: mockExceptions });

    const result = await fetchDriverExceptions("L1");

    expect(mockGet).toHaveBeenCalledWith("/driver/exceptions?loadId=L1");
    expect(result).toEqual(mockExceptions);
    expect(result[0].id).toBe("EX-001");
    expect(result[0].issue_type).toBe("Breakdown");
  });

  // # Tests R-P7-02
  it("calls api.get('/driver/exceptions') without loadId param", async () => {
    mockGet.mockResolvedValue({ exceptions: [] });

    const result = await fetchDriverExceptions();

    expect(mockGet).toHaveBeenCalledWith("/driver/exceptions");
    expect(result).toEqual([]);
  });
});

describe("R-P7-09: Offline queue stores payload and syncs on reconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onlineState.value = false;
    AsyncStorage.clear();
  });

  // # Tests R-P7-09
  it("stores payload in AsyncStorage when offline", async () => {
    const payload: CreateIssuePayload = {
      issue_type: "Detention",
      load_id: "L3",
      description: "Waiting at dock for 4 hours",
    };

    const result = await reportIssue(payload);

    expect(result.id).toMatch(/^offline-/);
    expect(mockPost).not.toHaveBeenCalled();

    const stored = await AsyncStorage.getItem("issueOfflineQueue");
    expect(stored).not.toBeNull();
    const queue = JSON.parse(stored!);
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.issue_type).toBe("Detention");
    expect(queue[0].payload.load_id).toBe("L3");
    expect(queue[0].payload.description).toBe("Waiting at dock for 4 hours");
    expect(queue[0].queuedAt).toBeTruthy();
  });

  // # Tests R-P7-09
  it("enqueues when api.post throws (network error fallback)", async () => {
    onlineState.value = true;
    mockPost.mockRejectedValue(new Error("Network error"));

    const payload: CreateIssuePayload = {
      issue_type: "Lumper",
      load_id: "L4",
      description: "Lumper fee dispute",
    };

    const result = await reportIssue(payload);

    expect(result.id).toMatch(/^offline-/);

    const stored = await AsyncStorage.getItem("issueOfflineQueue");
    const queue = JSON.parse(stored!);
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.issue_type).toBe("Lumper");
  });

  // # Tests R-P7-09
  it("syncOfflineIssues posts queued items and clears queue on success", async () => {
    onlineState.value = true;
    const queueData = [
      {
        payload: {
          issue_type: "Other",
          load_id: "L5",
          description: "Road closure",
        },
        queuedAt: "2026-04-12T10:00:00Z",
      },
    ];
    await AsyncStorage.setItem("issueOfflineQueue", JSON.stringify(queueData));

    mockPost.mockResolvedValue({ id: "EX-010" });

    await syncOfflineIssues();

    expect(mockPost).toHaveBeenCalledWith("/driver/exceptions", {
      issue_type: "Other",
      load_id: "L5",
      description: "Road closure",
    });

    const stored = await AsyncStorage.getItem("issueOfflineQueue");
    expect(stored).toBeNull();
  });

  // # Tests R-P7-09
  it("syncOfflineIssues retains failed items in queue", async () => {
    onlineState.value = true;
    const queueData = [
      {
        payload: {
          issue_type: "Breakdown",
          load_id: "L6",
          description: "Flat tire",
        },
        queuedAt: "2026-04-12T10:00:00Z",
      },
      {
        payload: {
          issue_type: "Delay",
          load_id: "L7",
          description: "Weather delay",
        },
        queuedAt: "2026-04-12T11:00:00Z",
      },
    ];
    await AsyncStorage.setItem("issueOfflineQueue", JSON.stringify(queueData));

    mockPost
      .mockResolvedValueOnce({ id: "EX-011" })
      .mockRejectedValueOnce(new Error("Server error"));

    await syncOfflineIssues();

    const stored = await AsyncStorage.getItem("issueOfflineQueue");
    expect(stored).not.toBeNull();
    const remaining = JSON.parse(stored!);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].payload.issue_type).toBe("Delay");
    expect(remaining[0].payload.load_id).toBe("L7");
  });
});
