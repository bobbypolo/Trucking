/**
 * Issue reporting service — handles driver exception creation and retrieval.
 *
 * Tests R-P7-01: reportIssue calls api.post('/driver/exceptions')
 * Tests R-P7-02: fetchDriverExceptions calls api.get('/driver/exceptions?loadId={loadId}')
 * Tests R-P7-09: Offline queue — stores payload in AsyncStorage when offline
 */

import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getIsOnline } from "./connectivity";
import type { CreateIssuePayload, DriverException } from "../types/issue";

const ISSUE_QUEUE_KEY = "issueOfflineQueue";

interface QueuedIssue {
  payload: CreateIssuePayload;
  queuedAt: string;
}

// # Tests R-P7-01, R-P7-09
export async function reportIssue(
  payload: CreateIssuePayload,
): Promise<{ id: string }> {
  if (!getIsOnline()) {
    await enqueueIssue(payload);
    return { id: `offline-${Date.now()}` };
  }

  try {
    return await api.post<{ id: string }>("/driver/exceptions", payload);
  } catch (err: unknown) {
    await enqueueIssue(payload);
    return { id: `offline-${Date.now()}` };
  }
}

// # Tests R-P7-02
export async function fetchDriverExceptions(
  loadId?: string,
): Promise<DriverException[]> {
  const path = loadId
    ? `/driver/exceptions?loadId=${loadId}`
    : "/driver/exceptions";
  const result = await api.get<{ exceptions: DriverException[] }>(path);
  return result.exceptions;
}

// # Tests R-P7-09
async function enqueueIssue(payload: CreateIssuePayload): Promise<void> {
  const raw = await AsyncStorage.getItem(ISSUE_QUEUE_KEY);
  const queue: QueuedIssue[] = raw ? JSON.parse(raw) : [];
  queue.push({ payload, queuedAt: new Date().toISOString() });
  await AsyncStorage.setItem(ISSUE_QUEUE_KEY, JSON.stringify(queue));
}

// # Tests R-P7-09
export async function syncOfflineIssues(): Promise<void> {
  const raw = await AsyncStorage.getItem(ISSUE_QUEUE_KEY);
  if (!raw) return;

  const queue: QueuedIssue[] = JSON.parse(raw);
  if (queue.length === 0) return;

  const remaining: QueuedIssue[] = [];

  for (const item of queue) {
    try {
      await api.post("/driver/exceptions", item.payload);
    } catch (_err: unknown) {
      remaining.push(item);
    }
  }

  if (remaining.length > 0) {
    await AsyncStorage.setItem(ISSUE_QUEUE_KEY, JSON.stringify(remaining));
  } else {
    await AsyncStorage.removeItem(ISSUE_QUEUE_KEY);
  }
}
