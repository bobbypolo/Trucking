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
import { API_URL } from "../config";
import { getAuthHeaders } from "../authService";

// --- Crisis Actions ---

export const getRawCrisisActions = async (): Promise<CrisisAction[]> => {
  try {
    const res = await fetch(API_URL + "/crisis-actions", {
      headers: await getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
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
    const patchRes = await fetch(API_URL + "/crisis-actions/" + action.id, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify(action),
    });
    if (patchRes.ok) return patchRes.json();
  } catch (_) {
    // fall through to create
  }
  const res = await fetch(API_URL + "/crisis-actions", {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(action),
  });
  if (!res.ok) throw new Error("Failed to save crisis action");
  return res.json();
};

// --- KCI Requests ---

export const getRawRequests = async (): Promise<KCIRequest[]> => {
  try {
    const res = await fetch(API_URL + "/kci-requests", {
      headers: await getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
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
    const patchRes = await fetch(API_URL + "/kci-requests/" + request.id, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify(request),
    });
    if (patchRes.ok) return patchRes.json();
  } catch (_) {
    // fall through to create
  }
  const res = await fetch(API_URL + "/kci-requests", {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to save KCI request");
  return res.json();
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
    const res = await fetch(API_URL + "/kci-requests/" + requestId, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      console.error("[recovery] updateRequestStatus failed:", res.status);
      return null;
    }
    return res.json();
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
    const res = await fetch(API_URL + "/service-tickets", {
      headers: await getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
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
    const patchRes = await fetch(API_URL + "/service-tickets/" + ticket.id, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify(ticket),
    });
    if (patchRes.ok) return patchRes.json();
  } catch (_) {
    // fall through to create
  }
  const res = await fetch(API_URL + "/service-tickets", {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(ticket),
  });
  if (!res.ok) throw new Error("Failed to save service ticket");
  return res.json();
};
