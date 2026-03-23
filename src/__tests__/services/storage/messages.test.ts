/**
 * Tests for services/storage/messages.ts
 * Messages domain -- server-authoritative API calls via api client.
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
  getMessages,
  saveMessage,
} from "../../../../services/storage/messages";

describe("messages.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMessages", () => {
    it("calls api.get /messages without loadId filter", async () => {
      const messages = [
        {
          id: "m1",
          loadId: "L-1",
          senderId: "u1",
          senderName: "John",
          text: "Hello",
          timestamp: "2026-01-01T00:00:00Z",
        },
      ];
      mockApi.get.mockResolvedValueOnce({ messages });

      const result = await getMessages();

      expect(mockApi.get).toHaveBeenCalledWith("/messages");
      expect(result).toEqual(messages);
    });

    it("appends loadId query param when provided", async () => {
      mockApi.get.mockResolvedValueOnce({ messages: [] });

      await getMessages("L-100");

      expect(mockApi.get).toHaveBeenCalledWith("/messages?loadId=L-100");
    });

    it("encodes loadId in URL", async () => {
      mockApi.get.mockResolvedValueOnce({ messages: [] });

      await getMessages("L-100/special");

      expect(mockApi.get).toHaveBeenCalledWith(
        "/messages?loadId=L-100%2Fspecial",
      );
    });

    it("returns empty array on API error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("500"));
      expect(await getMessages()).toEqual([]);
    });

    it("returns empty array when messages is not an array", async () => {
      mockApi.get.mockResolvedValueOnce({ messages: "invalid" });
      expect(await getMessages()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("offline"));
      expect(await getMessages()).toEqual([]);
    });
  });

  describe("saveMessage", () => {
    const message = {
      id: "m1",
      loadId: "L-100",
      senderId: "u1",
      senderName: "John Doe",
      text: "Driver ETA updated",
      timestamp: "2026-01-01T00:00:00Z",
      attachments: [
        { url: "https://example.com/img.png", type: "image" as const },
      ],
    };

    it("sends POST with correct snake_case body", async () => {
      mockApi.post.mockResolvedValueOnce({
        message: { ...message, id: "m-saved" },
      });

      const result = await saveMessage(message);

      expect(mockApi.post).toHaveBeenCalledWith("/messages", {
        load_id: "L-100",
        sender_id: "u1",
        sender_name: "John Doe",
        text: "Driver ETA updated",
        attachments: message.attachments,
      });
      expect(result.id).toBe("m-saved");
    });

    it("throws on API error (no fire-and-forget)", async () => {
      mockApi.post.mockRejectedValueOnce(new Error("422 Validation failed"));

      await expect(saveMessage(message)).rejects.toThrow(
        "422 Validation failed",
      );
    });

    it("throws on network error (no fire-and-forget)", async () => {
      mockApi.post.mockRejectedValueOnce(new Error("Connection refused"));

      await expect(saveMessage(message)).rejects.toThrow(
        "Connection refused",
      );
    });
  });
});
