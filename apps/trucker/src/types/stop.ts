/**
 * Stop type definitions for the LoadPilot trucker app.
 *
 * Maps to the load_legs table returned by GET /api/loads/:loadId/stops
 * (server-enforced tenant scoping via driver-stops route).
 */

export type StopStatus = "pending" | "arrived" | "departed" | "completed";

export type StopType = "Pickup" | "Dropoff";

export interface Stop {
  id: string;
  load_id: string;
  type: StopType;
  facility_name: string;
  city: string;
  state: string;
  date: string;
  appointment_time: string | null;
  completed: boolean;
  sequence_order: number;
  status: StopStatus;
  arrived_at: string | null;
  departed_at: string | null;
}

export interface StopStatusUpdate {
  status?: StopStatus;
  arrived_at?: string;
  departed_at?: string;
  completed?: boolean;
}
