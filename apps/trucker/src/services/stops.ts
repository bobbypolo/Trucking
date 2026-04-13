/**
 * Stops service for the LoadPilot trucker app.
 *
 * Fetches and updates stop (load_leg) data from the driver-facing stops API.
 *
 * # Tests R-P5-01, R-P5-02
 */

import api from "./api";
import type { Stop, StopStatusUpdate } from "../types/stop";

interface StopsResponse {
  stops: Stop[];
}

interface StopResponse {
  stop: Stop;
}

/**
 * Fetch all stops for a given load, ordered by sequence_order.
 * Calls GET /loads/{loadId}/stops and returns Stop[].
 */
export async function fetchStops(loadId: string): Promise<Stop[]> {
  const response = await api.get<StopsResponse>(`/loads/${loadId}/stops`);
  return response.stops;
}

/**
 * Update a stop's status tracking fields.
 * Calls PATCH /loads/{loadId}/stops/{stopId} with the update payload.
 */
export async function updateStopStatus(
  loadId: string,
  stopId: string,
  update: StopStatusUpdate,
): Promise<Stop> {
  const response = await api.patch<StopResponse>(
    `/loads/${loadId}/stops/${stopId}`,
    update,
  );
  return response.stop;
}

/**
 * Fetch documents for a given load to build the document checklist.
 * Calls GET /documents?load_id={loadId} and returns document metadata.
 */
export async function fetchDocuments(
  loadId: string,
): Promise<{ id: string; document_type: string }[]> {
  return api.get<{ id: string; document_type: string }[]>(
    `/documents?load_id=${loadId}`,
  );
}
