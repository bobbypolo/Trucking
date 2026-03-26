/**
 * Notification Jobs domain — API-only implementation.
 * All data is persisted to and retrieved from /api/notification-jobs.
 * Server-authoritative; no local storage.
 */
import { NotificationJob } from "../../types";
import { api } from "../api";

/**
 * Fetch all notification jobs for the authenticated tenant from the server.
 * Returns empty array on error (read operations degrade gracefully).
 */
export const getRawNotificationJobs = async (): Promise<NotificationJob[]> => {
  try {
    return (await api.get("/notification-jobs")) as NotificationJob[];
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
  return (await api.post("/notification-jobs", job)) as NotificationJob;
};
