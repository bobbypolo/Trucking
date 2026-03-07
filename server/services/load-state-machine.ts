import { BusinessRuleError } from "../errors/AppError";

/**
 * Canonical load statuses for the LoadPilot state machine.
 *
 * These replace the legacy 15-value LoadStatus from types.ts.
 * The 8 valid transitions are defined by the VALID_TRANSITIONS map.
 */
export enum LoadStatus {
  DRAFT = "draft",
  PLANNED = "planned",
  DISPATCHED = "dispatched",
  IN_TRANSIT = "in_transit",
  ARRIVED = "arrived",
  DELIVERED = "delivered",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

/**
 * Map of valid state transitions.
 *
 * Exactly 8 transitions are allowed:
 *   1. draft -> planned
 *   2. planned -> dispatched
 *   3. dispatched -> in_transit
 *   4. in_transit -> arrived
 *   5. arrived -> delivered
 *   6. delivered -> completed
 *   7. draft -> cancelled
 *   8. planned -> cancelled
 *
 * All other transitions are rejected with BusinessRuleError (HTTP 422).
 */
export const VALID_TRANSITIONS: Record<LoadStatus, LoadStatus[]> = {
  [LoadStatus.DRAFT]: [LoadStatus.PLANNED, LoadStatus.CANCELLED],
  [LoadStatus.PLANNED]: [LoadStatus.DISPATCHED, LoadStatus.CANCELLED],
  [LoadStatus.DISPATCHED]: [LoadStatus.IN_TRANSIT],
  [LoadStatus.IN_TRANSIT]: [LoadStatus.ARRIVED],
  [LoadStatus.ARRIVED]: [LoadStatus.DELIVERED],
  [LoadStatus.DELIVERED]: [LoadStatus.COMPLETED],
  [LoadStatus.COMPLETED]: [],
  [LoadStatus.CANCELLED]: [],
};

/**
 * Validates that a transition from `from` to `to` is allowed.
 * Throws BusinessRuleError if the transition is invalid.
 */
export function validateTransition(from: LoadStatus, to: LoadStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new BusinessRuleError(
      `Invalid load transition from '${from}' to '${to}'`,
      { from, to, allowed_transitions: allowed ?? [] },
      "BUSINESS_RULE_INVALID_TRANSITION",
    );
  }
}

/**
 * Returns the list of valid next statuses for a given status.
 * Useful for UI to render only valid action buttons.
 */
export function getValidNextStatuses(status: LoadStatus): LoadStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}

/**
 * Input for dispatch guard validation.
 */
export interface DispatchGuardInput {
  loadId: string;
  companyId: string;
  driverId: string | null;
  equipmentId: string | null;
  stops: Array<{ type: string; completed: boolean }>;
  driverCompanyId: string | null;
  equipmentCompanyId: string | null;
}

/**
 * Validates all prerequisites for dispatching a load (planned -> dispatched).
 *
 * Requirements:
 *   - Driver must be assigned (driver_id not null)
 *   - Equipment must be assigned (equipment_id not null)
 *   - At least one Pickup stop must exist
 *   - At least one Dropoff stop must exist
 *   - Driver must belong to the same tenant (company_id)
 *   - Equipment must belong to the same tenant (company_id)
 *
 * Throws BusinessRuleError listing all failed conditions.
 */
export function validateDispatchGuards(input: DispatchGuardInput): void {
  const failures: string[] = [];

  if (!input.driverId) {
    failures.push("Driver must be assigned before dispatch");
  }

  if (!input.equipmentId) {
    failures.push("Equipment must be assigned before dispatch");
  }

  const hasPickup = input.stops.some((s) => s.type === "Pickup");
  const hasDropoff = input.stops.some((s) => s.type === "Dropoff");

  if (!hasPickup) {
    failures.push("At least one Pickup stop is required");
  }

  if (!hasDropoff) {
    failures.push("At least one Dropoff stop is required");
  }

  if (
    input.driverId &&
    input.driverCompanyId &&
    input.driverCompanyId !== input.companyId
  ) {
    failures.push(
      "Driver belongs to a different tenant — cross-tenant dispatch is not allowed",
    );
  }

  if (
    input.equipmentId &&
    input.equipmentCompanyId &&
    input.equipmentCompanyId !== input.companyId
  ) {
    failures.push(
      "Equipment belongs to a different tenant — cross-tenant dispatch is not allowed",
    );
  }

  if (failures.length > 0) {
    throw new BusinessRuleError(
      `Dispatch guard failed: ${failures.join("; ")}`,
      { loadId: input.loadId, failures },
      "BUSINESS_RULE_DISPATCH_GUARD",
    );
  }
}
