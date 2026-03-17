/**
 * Messages & Threads domain — localStorage CRUD with optional API sync.
 * Owner: STORY-015 (Phase 2 migration to server).
 */
import { Message, OperationalThread } from "../../types";
import { API_URL } from "../config";
import { getAuthHeaders } from "../authService";
import { DEMO_MODE } from "../firebase";
import { getTenantKey } from "./core";

export const STORAGE_KEY_MESSAGES = (): string => getTenantKey("messages_v1");
export const STORAGE_KEY_THREADS = (): string => getTenantKey("threads_v1");

export const getMessages = async (loadId?: string): Promise<Message[]> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_MESSAGES());
    let messages: Message[] = data ? JSON.parse(data) : [];

    if (messages.length === 0 && DEMO_MODE) {
      // Demo mode: seed sample messages for demonstration
      messages = [
        {
          id: "1",
          loadId: "L-1001",
          senderId: "driver-123",
          senderName: "Alex Rivera",
          text: "Stuck at terminal gates. Long wait time today.",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: "2",
          loadId: "L-1001",
          senderId: "dispatcher-1",
          senderName: "Dispatcher",
          text: "Acknowledged. Log detention after 2 hours.",
          timestamp: new Date(Date.now() - 3000000).toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY_MESSAGES(), JSON.stringify(messages));
    }

    if (loadId) {
      return messages.filter((m) => m.loadId === loadId);
    }
    return messages;
  } catch (e) {
    return [];
  }
};

export const saveMessage = async (message: Message) => {
  try {
    const messages = await getMessages();
    messages.push(message);
    localStorage.setItem(STORAGE_KEY_MESSAGES(), JSON.stringify(messages));

    // Attempt remote sync if API is available
    try {
      await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(message),
      });
    } catch (e) {
      console.warn("[storageService] API fallback:", e);
    }
  } catch (e) {
    console.error("[storageService] saveMessage failed:", e);
  }
};

export const getThreads = async (
  companyId: string,
): Promise<OperationalThread[]> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_THREADS());
    if (!data) return [];
    const threads: OperationalThread[] = JSON.parse(data);
    return threads.filter(
      (t) => t.id.includes(companyId) || t.ownerId === companyId,
    ); // Broad tenant filter — matches thread ID or owner
  } catch (e) {
    return [];
  }
};

export const saveThread = async (thread: OperationalThread) => {
  try {
    const threads = await getThreads(""); // Get all
    const idx = threads.findIndex((t) => t.id === thread.id);
    if (idx >= 0) threads[idx] = thread;
    else threads.unshift(thread);
    localStorage.setItem(STORAGE_KEY_THREADS(), JSON.stringify(threads));
  } catch (e) {
    console.error("[storageService] saveThread failed:", e);
  }
};
