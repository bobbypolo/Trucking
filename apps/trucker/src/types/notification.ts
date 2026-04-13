/**
 * Notification type definitions for the LoadPilot trucker app.
 */

export interface NotificationItem {
  id: string;
  channel: string;
  message: string;
  status: string;
  sent_at: string;
  created_at: string;
}
