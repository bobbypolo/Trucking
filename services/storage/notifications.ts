/**
 * Notification Jobs domain — localStorage CRUD with API sync.
 * Owner: STORY-016 (Phase 2 migration to server).
 */
import { NotificationJob } from "../../types";
import { API_URL } from "../config";
import { getAuthHeaders } from "../authService";
import { getTenantKey } from "./core";

export const STORAGE_KEY_NOTIFICATION_JOBS = (): string =>
  getTenantKey("notification_jobs_v1");

export const getRawNotificationJobs = (): NotificationJob[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_NOTIFICATION_JOBS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveNotificationJob = async (job: NotificationJob) => {
  const jobs = getRawNotificationJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) jobs[idx] = job;
  else jobs.unshift(job);
  localStorage.setItem(STORAGE_KEY_NOTIFICATION_JOBS(), JSON.stringify(jobs));

  // Sync to API
  try {
    await fetch(`${API_URL}/notification-jobs`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(job),
    });
  } catch (e) {
    console.warn("[storageService] API fallback:", e);
  }

  return job;
};
