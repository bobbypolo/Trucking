/**
 * Messages & Threads domain \u2014 server-authoritative API calls.
 * Owner: STORY-015 (Phase 2 migration complete \u2014 server-only).
 *
 * All reads/writes go to /api/messages. No fire-and-forget. Server-authoritative.
 */
import { Message } from "../../types";
import { API_URL } from "../config";
import { getAuthHeaders } from "../authService";

/** Fetch messages from the server, optionally filtered by loadId. */
export const getMessages = async (loadId?: string): Promise<Message[]> => {
  try {
    const url = loadId
      ? `${API_URL}/messages?loadId=${encodeURIComponent(loadId)}`
      : `${API_URL}/messages`;
    const res = await fetch(url, { headers: await getAuthHeaders() });
    if (!res.ok) {
      console.error(`[messages] GET /api/messages failed: ${res.status}`);
      return [];
    }
    const { messages } = await res.json();
    return Array.isArray(messages) ? messages : [];
  } catch (e) {
    console.error("[messages] getMessages error:", e);
    return [];
  }
};

/**
 * Persist a message to the server. Throws if the server returns an error
 * so callers can surface the failure to the user (no fire-and-forget).
 */
export const saveMessage = async (message: Message): Promise<Message> => {
  const res = await fetch(`${API_URL}/messages`, {
    method: "POST",
    headers: {
      ...(await getAuthHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      load_id: message.loadId,
      sender_id: message.senderId,
      sender_name: message.senderName,
      text: message.text,
      attachments: message.attachments,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `[messages] saveMessage failed (${res.status}): ${body?.error ?? "unknown"}`,
    );
  }
  const { message: saved } = await res.json();
  return saved as Message;
};
