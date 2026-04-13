import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests R-P1-01, R-P1-02
 *
 * Verifies the push channel in deliverNotification:
 * - Queries push_tokens for recipient user IDs with enabled=1
 * - Calls sendPush() with the resulting tokens
 * - Returns FAILED when no enabled tokens exist
 */

// Mock nodemailer (top-level import in the service)
const mockSendMail = vi.fn();
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({ sendMail: mockSendMail }),
  },
  createTransport: vi.fn().mockReturnValue({ sendMail: mockSendMail }),
}));

// Mock Twilio (top-level import in the service)
vi.mock("twilio", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

// Mock logger
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child() {
      return this;
    },
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock pool.query
const mockQuery = vi.fn();
vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: vi.fn().mockResolvedValue([[], []]),
    getConnection: vi.fn(),
  },
}));

// Mock sendPush
const mockSendPush = vi.fn();
vi.mock("../../lib/expo-push", () => ({
  sendPush: mockSendPush,
}));

const originalEnv = { ...process.env };

describe("R-P1-01: deliverNotification push channel queries tokens and calls sendPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // # Tests R-P1-01
  it("queries push_tokens for recipient user IDs with enabled=1 and calls sendPush with tokens", async () => {
    const tokens = [
      { expo_push_token: "ExponentPushToken[abc123]" },
      { expo_push_token: "ExponentPushToken[def456]" },
    ];
    mockQuery.mockResolvedValueOnce([tokens, []]);
    mockSendPush.mockResolvedValueOnce({ sent: 2, errors: [] });

    const { deliverNotification } =
      await import("../../services/notification-delivery.service");

    const result = await deliverNotification({
      channel: "push",
      message: "Load assigned to you",
      recipients: [{ id: "user-1", name: "Driver A" }],
      subject: "New Load",
    });

    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT expo_push_token FROM push_tokens WHERE user_id IN (?) AND enabled = 1",
      ["user-1"],
    );
    expect(mockSendPush).toHaveBeenCalledWith(
      ["ExponentPushToken[abc123]", "ExponentPushToken[def456]"],
      "New Load",
      "Load assigned to you",
      {},
    );
    expect(result.status).toBe("SENT");
    expect(result.sent_at).toBeDefined();
  });

  // # Tests R-P1-01
  it("sends to multiple recipient IDs by building IN clause with placeholders", async () => {
    const tokens = [{ expo_push_token: "ExponentPushToken[tok1]" }];
    mockQuery.mockResolvedValueOnce([tokens, []]);
    mockSendPush.mockResolvedValueOnce({ sent: 1, errors: [] });

    const { deliverNotification } =
      await import("../../services/notification-delivery.service");

    const result = await deliverNotification({
      channel: "push",
      message: "Status updated",
      recipients: [
        { id: "user-1", name: "Driver A" },
        { id: "user-2", name: "Driver B" },
      ],
    });

    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT expo_push_token FROM push_tokens WHERE user_id IN (?,?) AND enabled = 1",
      ["user-1", "user-2"],
    );
    expect(mockSendPush).toHaveBeenCalledWith(
      ["ExponentPushToken[tok1]"],
      "LoadPilot Notification",
      "Status updated",
      {},
    );
    expect(result.status).toBe("SENT");
  });
});

describe("R-P1-02: deliverNotification push channel returns FAILED when no tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // # Tests R-P1-02
  it("returns FAILED with sync_error when no enabled tokens exist in push_tokens table", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const { deliverNotification } =
      await import("../../services/notification-delivery.service");

    const result = await deliverNotification({
      channel: "push",
      message: "Load assigned",
      recipients: [{ id: "user-no-tokens", name: "Driver C" }],
    });

    expect(result.status).toBe("FAILED");
    expect(result.sync_error).toBe("No push tokens found");
  });

  // # Tests R-P1-02
  it("returns FAILED when recipients have no IDs (empty id strings filtered out)", async () => {
    const { deliverNotification } =
      await import("../../services/notification-delivery.service");

    const result = await deliverNotification({
      channel: "push",
      message: "Load assigned",
      recipients: [{ name: "Driver D" }, { id: "", name: "Driver E" }],
    });

    expect(result.status).toBe("FAILED");
    expect(result.sync_error).toBe("No push tokens found");
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
