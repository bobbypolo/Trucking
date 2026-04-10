/**
 * Load type definitions for the trucker mobile app.
 * Aligned with server response format from GET /api/loads.
 */

export type LoadStatus =
  | "draft"
  | "planned"
  | "dispatched"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "completed"
  | "cancelled";

export interface LoadLeg {
  type: "Pickup" | "Dropoff" | "Fuel" | "Rest";
  city: string;
  state: string;
  facility_name: string;
  date: string;
  sequence_order: number;
}

export interface Load {
  id: string;
  status: LoadStatus;
  pickup_date: string;
  legs: LoadLeg[];
}

/**
 * Extract origin city+state from the first Pickup leg.
 * Returns "Unknown" if no Pickup leg exists.
 */
export function getOrigin(load: Load): { city: string; state: string } {
  const pickupLeg = load.legs.find((leg) => leg.type === "Pickup");
  if (pickupLeg) {
    return { city: pickupLeg.city, state: pickupLeg.state };
  }
  return { city: "Unknown", state: "" };
}

/**
 * Extract destination city+state from the last Dropoff leg.
 * Returns "Unknown" if no Dropoff leg exists.
 */
export function getDestination(load: Load): { city: string; state: string } {
  const dropoffLegs = load.legs.filter((leg) => leg.type === "Dropoff");
  if (dropoffLegs.length > 0) {
    const lastDropoff = dropoffLegs[dropoffLegs.length - 1];
    return { city: lastDropoff.city, state: lastDropoff.state };
  }
  return { city: "Unknown", state: "" };
}
