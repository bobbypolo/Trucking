import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests R-P3-01, R-P3-02, R-P3-03
 *
 * Verifies messaging service functions call the correct API endpoints
 * with the correct payloads and return the expected data.
 */

// Mock the api module
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
vi.mock("../../src/services/api", () => ({
  default: {
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
  },
}));

// Mock firebase config (transitive dependency of api.ts)
vi.mock("../../src/config/firebase", () => ({
  auth: { currentUser: null },
}));

const sampleThreads = [
  {
    id: "thread-1",
    title: "Load #1234 Discussion",
    load_id: "load-1",
    participant_ids: ["user-1", "user-2"],
    last_message: "ETA updated to 3pm",
    last_message_at: "2026-04-12T14:00:00Z",
    status: "active",
    created_at: "2026-04-10T08:00:00Z",
    updated_at: "2026-04-12T14:00:00Z",
  },
  {
    id: "thread-2",
    title: "Delivery Confirmation",
    load_id: "load-2",
    participant_ids: ["user-1", "user-3"],
    last_message: "BOL signed",
    last_message_at: "2026-04-11T16:00:00Z",
    status: "active",
    created_at: "2026-04-09T10:00:00Z",
    updated_at: "2026-04-11T16:00:00Z",
  },
];

const sampleMessage = {
  id: "msg-99",
  thread_id: "thread-1",
  sender_id: "user-1",
  sender_name: "John Driver",
  text: "On my way",
  timestamp: "2026-04-12T15:00:00Z",
  read_at: null,
};

describe("R-P3-01: fetchThreads service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P3-01
  it("calls api.get with /threads and returns Thread[]", async () => {
    mockGet.mockResolvedValueOnce({ threads: sampleThreads });

    const { fetchThreads } = await import("../../src/services/messaging");

    const result = await fetchThreads();

    expect(mockGet).toHaveBeenCalledWith("/threads");
    expect(result).toEqual(sampleThreads);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("thread-1");
    expect(result[0].title).toBe("Load #1234 Discussion");
    expect(result[1].id).toBe("thread-2");
    expect(result[1].title).toBe("Delivery Confirmation");
  });

  // # Tests R-P3-01
  it("returns empty array when no threads exist", async () => {
    mockGet.mockResolvedValueOnce({ threads: [] });

    const { fetchThreads } = await import("../../src/services/messaging");

    const result = await fetchThreads();

    expect(mockGet).toHaveBeenCalledWith("/threads");
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  // # Tests R-P3-01
  it("propagates API errors to the caller", async () => {
    mockGet.mockRejectedValueOnce(new Error("Network error"));

    const { fetchThreads } = await import("../../src/services/messaging");

    await expect(fetchThreads()).rejects.toThrow("Network error");
    expect(mockGet).toHaveBeenCalledWith("/threads");
  });
});

describe("R-P3-02: sendMessage service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P3-02
  it("calls api.post with /messages and correct payload", async () => {
    mockPost.mockResolvedValueOnce({ message: sampleMessage });

    const { sendMessage } = await import("../../src/services/messaging");

    const result = await sendMessage("thread-1", "user-1", "On my way");

    expect(mockPost).toHaveBeenCalledWith("/messages", {
      thread_id: "thread-1",
      sender_id: "user-1",
      text: "On my way",
    });
    expect(result).toEqual(sampleMessage);
    expect(result.id).toBe("msg-99");
    expect(result.thread_id).toBe("thread-1");
    expect(result.sender_id).toBe("user-1");
    expect(result.text).toBe("On my way");
  });

  // # Tests R-P3-02
  it("propagates API errors to the caller", async () => {
    mockPost.mockRejectedValueOnce(new Error("Server error"));

    const { sendMessage } = await import("../../src/services/messaging");

    await expect(sendMessage("thread-1", "user-1", "test")).rejects.toThrow(
      "Server error",
    );
    expect(mockPost).toHaveBeenCalledWith("/messages", {
      thread_id: "thread-1",
      sender_id: "user-1",
      text: "test",
    });
  });
});

describe("R-P3-03: markMessageRead service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P3-03
  it("calls api.patch with /messages/{id}/read", async () => {
    mockPatch.mockResolvedValueOnce({ read_at: "2026-04-12T15:30:00Z" });

    const { markMessageRead } = await import("../../src/services/messaging");

    await markMessageRead("msg-42");

    expect(mockPatch).toHaveBeenCalledWith("/messages/msg-42/read");
  });

  // # Tests R-P3-03
  it("propagates API errors to the caller", async () => {
    mockPatch.mockRejectedValueOnce(new Error("Not found"));

    const { markMessageRead } = await import("../../src/services/messaging");

    await expect(markMessageRead("msg-999")).rejects.toThrow("Not found");
    expect(mockPatch).toHaveBeenCalledWith("/messages/msg-999/read");
  });
});
