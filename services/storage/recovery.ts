/**
 * Recovery domain — Crisis Actions, Service Tickets, KCI Requests.
 * Owner: STORY-017 (Phase 2 migration to server).
 */
import {
  CrisisAction,
  ServiceTicket,
  KCIRequest,
  RequestStatus,
} from "../../types";
import { API_URL } from "../config";
import { getAuthHeaders } from "../authService";
import { getTenantKey } from "./core";

export const STORAGE_KEY_CRISIS = (): string => getTenantKey("crisis_v1");
export const STORAGE_KEY_REQUESTS = (): string => getTenantKey("requests_v1");
export const STORAGE_KEY_SERVICE_TICKETS = (): string =>
  getTenantKey("service_tickets_v1");

// --- Crisis Actions ---

export const getRawCrisisActions = (): CrisisAction[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_CRISIS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveCrisisAction = async (action: CrisisAction) => {
  const actions = getRawCrisisActions();
  const idx = actions.findIndex((a) => a.id === action.id);
  if (idx >= 0) actions[idx] = action;
  else actions.unshift(action);
  localStorage.setItem(STORAGE_KEY_CRISIS(), JSON.stringify(actions));
  return action;
};

// --- KCI Requests ---

export const getRawRequests = (): KCIRequest[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_REQUESTS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const getRequests = async (filters?: {
  loadId?: string;
  driverId?: string;
  openRecordId?: string;
}): Promise<KCIRequest[]> => {
  let requests = getRawRequests();
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

export const saveRequest = async (request: KCIRequest) => {
  const requests = getRawRequests();
  const idx = requests.findIndex((r) => r.id === request.id);
  if (idx >= 0) requests[idx] = request;
  else requests.unshift(request);
  localStorage.setItem(STORAGE_KEY_REQUESTS(), JSON.stringify(requests));
  return request;
};

export const updateRequestStatus = async (
  requestId: string,
  status: RequestStatus,
  actor: { id: string; name: string },
  note?: string,
  approvedAmount?: number,
) => {
  const requests = getRawRequests();
  const idx = requests.findIndex((r) => r.id === requestId);
  if (idx >= 0) {
    const req = requests[idx];
    const before = req.status;
    req.status = status;
    if (status === "APPROVED") {
      req.approvedBy = actor.name;
      req.approvedAt = new Date().toISOString();
      if (approvedAmount !== undefined) req.approvedAmount = approvedAmount;
    } else if (status === "DENIED") {
      req.deniedBy = actor.name;
      req.deniedAt = new Date().toISOString();
      req.denialReason = note;
    }
    req.decisionLog.push({
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      action: `Status changed to ${status}`,
      beforeState: before,
      afterState: status,
      note,
    });
    localStorage.setItem(STORAGE_KEY_REQUESTS(), JSON.stringify(requests));
    return req;
  }
  return null;
};

export const getUnresolvedRequests = async (): Promise<KCIRequest[]> => {
  const requests = getRawRequests();
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

export const getRawServiceTickets = (): ServiceTicket[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_SERVICE_TICKETS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveServiceTicket = async (ticket: ServiceTicket) => {
  const tickets = getRawServiceTickets();
  const idx = tickets.findIndex((t) => t.id === ticket.id);
  if (idx >= 0) tickets[idx] = ticket;
  else tickets.unshift(ticket);
  localStorage.setItem(STORAGE_KEY_SERVICE_TICKETS(), JSON.stringify(tickets));

  // Sync to API
  try {
    await fetch(`${API_URL}/service-tickets`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(ticket),
    });
  } catch (e) {
    console.warn("[storageService] API fallback:", e);
  }

  return ticket;
};
