/**
 * Load type definitions for the LoadPilot trucker app.
 */

export type LoadStatus =
  | "pending"
  | "assigned"
  | "dispatched"
  | "in_transit"
  | "at_pickup"
  | "at_dropoff"
  | "delivered"
  | "completed";

export type LegType = "Pickup" | "Dropoff";

export interface LoadLeg {
  type: LegType;
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
 * Returns the origin city+state from the first Pickup leg.
 */
export function getOrigin(load: Load): string {
  const pickup = load.legs.find((leg) => leg.type === "Pickup");
  if (!pickup) {
    return "Unknown Origin";
  }
  return `${pickup.city}, ${pickup.state}`;
}

/**
 * Returns the destination city+state from the last Dropoff leg.
 */
export function getDestination(load: Load): string {
  const dropoffs = load.legs.filter((leg) => leg.type === "Dropoff");
  if (dropoffs.length === 0) {
    return "Unknown Destination";
  }
  const lastDropoff = dropoffs[dropoffs.length - 1];
  return `${lastDropoff.city}, ${lastDropoff.state}`;
}
