/**
 * Notification Jobs domain — API-only implementation.
 * All data is persisted to and retrieved from /api/notification-jobs.
 * Server-authoritative; no local storage.
 */
import { NotificationJob } from "../../types";
import { API_URL } from "../config";
import { getAuthHeaders } from "../authService";

/**
 * Fetch all notification jobs for the authenticated tenant from the server.
 * Returns empty array on error (read operations degrade gracefully).
 */
export const getRawNotificationJobs = async (): Promise<NotificationJob[]> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/notification-jobs`, { headers });
    if (!res.ok) return [];
    return (await res.json()) as NotificationJob[];
  } catch {
    return [];
  }
};

/**
 * Create or update a notification job on the server.
 * Returns the server response (source of truth).
 * Throws on API failure — callers must handle errors explicitly.
 */
export const saveNotificationJob = async (
  job: NotificationJob,
): Promise<NotificationJob> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/notification-jobs`, {
    method: "POST",
    headers,
    body: JSON.stringify(job),
  });
  if (!res.ok) {
    throw new Error(
      `[notifications] saveNotificationJob failed: HTTP ${res.status}`,
    );
  }
  return (await res.json()) as NotificationJob;
};
