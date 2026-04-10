/**
 * Load service functions for the trucker mobile app.
 * Provides API integration for load list, detail, and status updates.
 */

import api from "./api";
import type { Load, LoadStatus } from "../types/load";

/**
 * Fetch all loads for the current authenticated driver.
 * Calls GET /api/loads and returns the raw array.
 */
export async function fetchLoads(): Promise<Load[]> {
  const data = await api.get<Load[]>("/loads");
  return data;
}

/**
 * Fetch a single load by ID.
 * Calls fetchLoads() then filters by id.
 */
export async function fetchLoadById(id: string): Promise<Load> {
  const loads = await fetchLoads();
  const load = loads.find((l) => l.id === id);
  if (!load) {
    throw new Error(`Load not found: ${id}`);
  }
  return load;
}

/**
 * Update a load's status via the state machine endpoint.
 * Calls PATCH /api/loads/:id/status with the target status.
 */
export async function updateLoadStatus(
  id: string,
  status: LoadStatus,
): Promise<Load> {
  const data = await api.patch<Load>(`/loads/${id}/status`, { status });
  return data;
}
