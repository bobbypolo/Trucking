/**
 * Tests for services/storage/messages.ts
 * Messages domain -- server-authoritative API calls.
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
  getMessages,
  saveMessage,
} from "../../../../services/storage/messages";

describe("messages.ts", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getMessages", () => {
    it("calls GET /api/messages without loadId filter", async () => {
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages }),
      });

      const result = await getMessages();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/messages");
      expect(result).toEqual(messages);
    });

    it("appends loadId query param when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });

      await getMessages("L-100");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("loadId=L-100");
    });

    it("encodes loadId in URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });

      await getMessages("L-100/special");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("loadId=L-100%2Fspecial");
    });

    it("returns empty array on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      expect(await getMessages()).toEqual([]);
    });

    it("returns empty array when messages is not an array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: "invalid" }),
      });
      expect(await getMessages()).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("offline"));
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
      attachments: [{ url: "https://example.com/img.png", type: "image" as const }],
    };

    it("sends POST with correct snake_case body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { ...message, id: "m-saved" } }),
      });

      const result = await saveMessage(message);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/messages");
      expect(opts.method).toBe("POST");
      const body = JSON.parse(opts.body);
      expect(body.load_id).toBe("L-100");
      expect(body.sender_id).toBe("u1");
      expect(body.sender_name).toBe("John Doe");
      expect(body.text).toBe("Driver ETA updated");
      expect(body.attachments).toEqual(message.attachments);
      expect(result.id).toBe("m-saved");
    });

    it("includes Content-Type header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message }),
      });

      await saveMessage(message);

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers["Content-Type"]).toBe("application/json");
    });

    it("throws with descriptive error on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ error: "Validation failed" }),
      });

      await expect(saveMessage(message)).rejects.toThrow(
        /saveMessage failed.*422.*Validation failed/,
      );
    });

    it("throws with 'unknown' when error body parse fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("Bad JSON");
        },
      });

      await expect(saveMessage(message)).rejects.toThrow(
        /saveMessage failed.*500.*unknown/,
      );
    });

    it("throws on network error (no fire-and-forget)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      await expect(saveMessage(message)).rejects.toThrow(
        "Connection refused",
      );
    });
  });
});
