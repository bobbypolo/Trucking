/**
 * Settlement service for the LoadPilot trucker app.
 *
 * Fetches driver pay/settlement data from the LoadPilot backend.
 *
 * # Tests R-P8-01
 */

import api from "./api";
import type { Settlement } from "../types/settlement";

/**
 * Fetch all settlements for the authenticated driver.
 * Calls GET /accounting/settlements and returns Settlement[].
 */
export async function fetchSettlements(): Promise<Settlement[]> {
  const response = await api.get<Settlement[]>("/accounting/settlements");
  return response;
}
