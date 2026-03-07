/**
 * Dispatch Service — frontend API service for dispatch operations.
 *
 * Handles load status transitions, dispatch event retrieval,
 * and dashboard counts via the backend API.
 *
 * All operations go through the authenticated API; companyId
 * is derived server-side from the auth token.
 */
import { api } from "./api";
import { LoadStatus } from "../types";

/**
 * Result of a status transition from the backend.
 */
export interface StatusTransitionResult {
  id: string;
  status: LoadStatus;
  version: number;
  previous_status: LoadStatus;
}

/**
 * Structured error returned by the backend for business rule violations.
 */
export interface BusinessRuleErrorResponse {
  error_code: string;
  error_class: string;
  message: string;
  correlation_id: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

/**
 * Dashboard status counts returned by GET /api/loads/counts.
 */
export interface DashboardCounts {
  draft: number;
  planned: number;
  dispatched: number;
  in_transit: number;
  arrived: number;
  delivered: number;
  completed: number;
  cancelled: number;
  total: number;
}

/**
 * Dispatch event from the backend.
 */
export interface DispatchEvent {
  id: string;
  load_id: string;
  dispatcher_id: string;
  actor_id: string;
  event_type: string;
  prior_state: string;
  next_state: string;
  correlation_id: string;
  message: string;
  payload: string;
  created_at: string;
}

/**
 * Transition a load to a new status via the state machine.
 *
 * PATCH /api/loads/:id/status
 *
 * On success, returns the transition result with new status and version.
 * On invalid transition, the backend returns 422 with a structured
 * BusinessRuleError containing error_code BUSINESS_RULE_INVALID_TRANSITION.
 */
export async function transitionLoadStatus(
  loadId: string,
  targetStatus: LoadStatus,
): Promise<StatusTransitionResult> {
  return api.patch(`/loads/${loadId}/status`, {
    status: targetStatus,
  }) as Promise<StatusTransitionResult>;
}

/**
 * Fetch dashboard counts — real status distribution from the backend.
 *
 * GET /api/loads/counts
 */
export async function fetchDashboardCounts(): Promise<DashboardCounts> {
  return api.get("/loads/counts") as Promise<DashboardCounts>;
}

/**
 * Fetch dispatch events for a load.
 *
 * GET /api/dispatch-events/:loadId (via dispatch routes)
 */
export async function fetchDispatchEvents(
  loadId: string,
): Promise<DispatchEvent[]> {
  return api.get(`/dispatch-events/${loadId}`) as Promise<DispatchEvent[]>;
}
