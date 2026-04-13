/**
 * Notification center service for the LoadPilot trucker app.
 *
 * Fetches notification history from the LoadPilot backend.
 *
 * # Tests R-P1-03
 */

import api from "./api";
import type { NotificationItem } from "../types/notification";

/**
 * Fetch all notifications for the authenticated user.
 * Calls GET /notification-jobs and returns NotificationItem[].
 */
export async function fetchNotifications(): Promise<NotificationItem[]> {
  const response = await api.get<NotificationItem[]>("/notification-jobs");
  return response;
}
