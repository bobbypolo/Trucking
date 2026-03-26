/**
 * Messages & Threads domain — server-authoritative API calls.
 * Owner: STORY-015 (Phase 2 migration complete — server-only).
 *
 * All reads/writes go to /api/messages. No fire-and-forget. Server-authoritative.
 */
import { Message } from "../../types";
import { api } from "../api";

/** Fetch messages from the server, optionally filtered by loadId. */
export const getMessages = async (loadId?: string): Promise<Message[]> => {
  try {
    const endpoint = loadId
      ? `/messages?loadId=${encodeURIComponent(loadId)}`
      : "/messages";
    const data = await api.get(endpoint);
    const messages = data?.messages;
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
  const data = await api.post("/messages", {
    load_id: message.loadId,
    sender_id: message.senderId,
    sender_name: message.senderName,
    text: message.text,
    attachments: message.attachments,
  });
  return data.message as Message;
};
