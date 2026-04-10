/**
 * Load service — API integration for load data.
 */

import api from "./api";
import type { Load, LoadStatus } from "../types/load";

/**
 * Fetches all loads for the current driver.
 */
export async function fetchLoads(): Promise<Load[]> {
  const data = await api.get<Load[]>("/loads");
  return data;
}

/**
 * Fetches a single load by ID.
 * Since no GET /loads/:id endpoint exists, this fetches all loads
 * and filters locally.
 */
export async function fetchLoadById(id: string): Promise<Load> {
  const loads = await fetchLoads();
  const load = loads.find((l) => l.id === id);
  if (!load) {
    const error = new Error(`Load ${id} not found`) as Error & {
      status?: number;
    };
    error.status = 404;
    throw error;
  }
  return load;
}

/**
 * Updates the status of a load.
 */
export async function updateLoadStatus(
  id: string,
  status: LoadStatus,
): Promise<Load> {
  return api.patch<Load>(`/loads/${id}/status`, { status });
}
