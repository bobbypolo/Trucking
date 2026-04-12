/**
 * Message and Thread type definitions for the LoadPilot trucker app.
 */

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  timestamp: string;
  read_at: string | null;
}

export interface Thread {
  id: string;
  title: string;
  load_id: string | null;
  participant_ids: string[];
  last_message: string | null;
  last_message_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
