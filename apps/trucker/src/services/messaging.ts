/**
 * Messaging service for the LoadPilot trucker app.
 *
 * Provides thread listing, message sending, and read-marking
 * against the LoadPilot backend API.
 *
 * # Tests R-P3-01, R-P3-02, R-P3-03
 */

import api from "./api";
import type { Thread, Message } from "../types/message";

/**
 * Fetch all threads for the authenticated user.
 * Calls GET /threads and returns Thread[].
 *
 * # Tests R-P3-01
 */
export async function fetchThreads(): Promise<Thread[]> {
  const response = await api.get<{ threads: Thread[] }>("/threads");
  return response.threads;
}

/**
 * Fetch messages for a specific thread.
 * Calls GET /threads/:threadId/messages and returns Message[].
 */
export async function fetchThreadMessages(
  threadId: string,
): Promise<Message[]> {
  const response = await api.get<{ messages: Message[] }>(
    `/threads/${threadId}/messages`,
  );
  return response.messages;
}

/**
 * Send a message in a thread.
 * Calls POST /messages with thread_id, sender_id, and text.
 *
 * # Tests R-P3-02
 */
export async function sendMessage(
  threadId: string,
  senderId: string,
  text: string,
): Promise<Message> {
  const response = await api.post<{ message: Message }>("/messages", {
    thread_id: threadId,
    sender_id: senderId,
    text,
  });
  return response.message;
}

/**
 * Mark a message as read.
 * Calls PATCH /messages/:id/read.
 *
 * # Tests R-P3-03
 */
export async function markMessageRead(id: string): Promise<void> {
  await api.patch<{ read_at: string }>(`/messages/${id}/read`);
}
