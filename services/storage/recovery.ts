/**
 * Recovery domain -- Crisis Actions, Service Tickets, KCI Requests.
 * Owner: STORY-017 (Phase 2 migration to server -- all storage migrated to API).
 */
import {
  CrisisAction,
  ServiceTicket,
  KCIRequest,
  RequestStatus,
} from "../../types";
import { api } from "../api";

// --- Crisis Actions ---

export const getRawCrisisActions = async (): Promise<CrisisAction[]> => {
  try {
    const data = await api.get("/crisis-actions");
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("[recovery] getRawCrisisActions failed:", e);
    return [];
  }
};

export const saveCrisisAction = async (
  action: CrisisAction,
): Promise<CrisisAction> => {
  // Try PATCH first (update), then POST (create)
  try {
    return await api.patch(`/crisis-actions/${action.id}`, action);
  } catch {
    // fall through to create
  }
  return api.post("/crisis-actions", action);
};

// --- KCI Requests ---

export const getRawRequests = async (): Promise<KCIRequest[]> => {
  try {
    const data = await api.get("/kci-requests");
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("[recovery] getRawRequests failed:", e);
    return [];
  }
};

export const getRequests = async (filters?: {
  loadId?: string;
  driverId?: string;
  openRecordId?: string;
}): Promise<KCIRequest[]> => {
  let requests = await getRawRequests();
  if (filters) {
    if (filters.loadId)
      requests = requests.filter((r) => r.loadId === filters.loadId);
    if (filters.driverId)
      requests = requests.filter((r) => r.driverId === filters.driverId);
    if (filters.openRecordId)
      requests = requests.filter(
        (r) => r.openRecordId === filters.openRecordId,
      );
  }
  return requests;
};

export const saveRequest = async (request: KCIRequest): Promise<KCIRequest> => {
  // Try PATCH first (update), then POST (create)
  try {
    return await api.patch(`/kci-requests/${request.id}`, request);
  } catch {
    // fall through to create
  }
  return api.post("/kci-requests", request);
};

export const updateRequestStatus = async (
  requestId: string,
  status: RequestStatus,
  actor: { id: string; name: string },
  note?: string,
  approvedAmount?: number,
): Promise<KCIRequest | null> => {
  const now = new Date().toISOString();
  const decisionLogEntry = {
    timestamp: now,
    actorId: actor.id,
    actorName: actor.name,
    action: `Status changed to ${status}`,
    afterState: status,
    note,
  };

  const patch: Record<string, unknown> = {
    status,
    decision_log: [decisionLogEntry],
  };

  if (status === "APPROVED") {
    patch.approved_by = actor.name;
    patch.approved_at = now;
    if (approvedAmount !== undefined) patch.approved_amount = approvedAmount;
  } else if (status === "DENIED") {
    patch.denied_by = actor.name;
    patch.denied_at = now;
    patch.denial_reason = note;
  }

  try {
    return await api.patch(`/kci-requests/${requestId}`, patch);
  } catch (e) {
    console.error("[recovery] updateRequestStatus error:", e);
    return null;
  }
};

export const getUnresolvedRequests = async (): Promise<KCIRequest[]> => {
  const requests = await getRawRequests();
  return requests
    .filter((r) =>
      ["NEW", "PENDING_APPROVAL", "NEEDS_INFO", "DEFERRED"].includes(r.status),
    )
    .sort((a, b) => {
      // High priority first
      if (a.priority === "HIGH" && b.priority !== "HIGH") return -1;
      if (a.priority !== "HIGH" && b.priority === "HIGH") return 1;
      // Then Oldest
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
};

// --- Service Tickets ---

export const getRawServiceTickets = async (): Promise<ServiceTicket[]> => {
  try {
    const data = await api.get("/service-tickets");
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("[recovery] getRawServiceTickets failed:", e);
    return [];
  }
};

export const saveServiceTicket = async (
  ticket: ServiceTicket,
): Promise<ServiceTicket> => {
  // Try PATCH first (update), then POST (create)
  try {
    return await api.patch(`/service-tickets/${ticket.id}`, ticket);
  } catch {
    // fall through to create
  }
  return api.post("/service-tickets", ticket);
};
