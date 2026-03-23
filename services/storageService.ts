import {
  Message,
  LoadData,
  User,
  Company,
  LOAD_STATUS,
  LoadStatus,
  Broker,
  LoadExpense,
  Issue,
  BolData,
  LoadLeg,
  FleetEquipment,
  LoadNumberingConfig,
  TimeLog,
  DispatchEvent,
  Contract,
  Incident,
  IncidentAction,
  EmergencyCharge,
  CallLog,
  OperationalTrend,
  KCIRequest,
  OperationalEvent,
  RequestStatus,
  CallSession,
  RecordLink,
  LoadSummary,
  DriverSummary,
  GlobalSearchResult,
  EntityType,
  Provider,
  Contact,
  OperationalTask,
  CrisisAction,
  OperationalThread,
  Lead,
  Quote,
  Booking,
  WorkItem,
  ServiceTicket,
  NotificationJob,
  VaultDoc,
  VaultDocType,
  VaultDocStatus,
} from "../types";
import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  getCompany,
  updateCompany,
  getStoredUsers,
  getAuthHeaders,
  getCurrentUser,
} from "./authService";
export { getAuthHeaders };
import { getBrokers } from "./brokerService";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { v4 as uuidv4 } from "uuid";
import { DispatchIntelligence } from "./dispatchIntelligence";
import {
  fetchLoads as apiFetchLoads,
  createLoad as apiCreateLoad,
  updateLoadStatusApi,
  searchLoadsApi,
  deleteLoadApi,
} from "./loadService";
import { api, ApiFetchOptions, ForbiddenError } from "./api";
import { validateDispatchEvent } from "./validationGuards";

// --- Re-export domain modules for backward compatibility ---
// Consumers can import from storageService or directly from domain modules.
export { getQuotes, saveQuote } from "./storage/quotes";
export { getLeads, saveLead } from "./storage/leads";
export { getBookings, saveBooking } from "./storage/bookings";
export { getMessages, saveMessage } from "./storage/messages";
export {
  getRawCalls,
  saveCallSession,
  attachToRecord,
  linkSessionToRecord,
} from "./storage/calls";
export {
  getRawTasks,
  saveTask,
  getRawWorkItems,
  getWorkItems,
  saveWorkItem,
} from "./storage/tasks";
export {
  getRawCrisisActions,
  saveCrisisAction,
  getRawRequests,
  getRequests,
  saveRequest,
  updateRequestStatus,
  getUnresolvedRequests,
  getRawServiceTickets,
  saveServiceTicket,
} from "./storage/recovery";
export {
  saveProvider,
  getProviders,
  getContacts,
  saveContact,
  getDirectory,
} from "./storage/directory";
export { getRawVaultDocs, saveVaultDoc, uploadVaultDoc } from "./storage/vault";
export {
  getRawNotificationJobs,
  saveNotificationJob,
} from "./storage/notifications";

// --- Internal imports from domain modules (used by aggregators below) ---
import { getQuotes as _getQuotes } from "./storage/quotes";
import {
  getBookings as _getBookings,
  saveBooking as _saveBooking,
} from "./storage/bookings";
import { getMessages as _getMessages } from "./storage/messages";
import { getRawCalls as _getRawCalls } from "./storage/calls";
import {
  getRawTasks as _getRawTasks,
  getWorkItems as _getWorkItems,
} from "./storage/tasks";
import {
  getRawCrisisActions as _getRawCrisisActions,
  getRawRequests as _getRawRequests,
  getUnresolvedRequests as _getUnresolvedRequests,
  saveRequest as _saveRequest,
} from "./storage/recovery";
import { getContacts as _getContacts } from "./storage/directory";
import { getRawVaultDocs as _getRawVaultDocs } from "./storage/vault";
import { saveTask as _saveTask } from "./storage/tasks";
// STORAGE_KEY for loads and incidents removed — both come from backend API only

// In-memory cache for API-fetched data (browser storage removed)
let _cachedLoads: LoadData[] = [];

const getRawLoads = (): LoadData[] => {
  // Returns cached results from last API fetch
  return _cachedLoads;
};

export const getLoads = async (user: User): Promise<LoadData[]> => {
  try {
    const loads = await apiFetchLoads();
    // Update in-memory cache for functions that use getRawLoads()
    _cachedLoads = loads;

    if (
      ["admin", "dispatcher", "safety_manager", "payroll_manager"].includes(
        user.role,
      )
    ) {
      return loads.filter((l) => l.companyId === user.companyId);
    } else {
      return loads.filter((l) => l.driverId === user.id);
    }
  } catch {
    // Auth errors (401/403) are handled centrally by api.ts:
    // 401 fires auth:session-expired event before throwing; 403 throws ForbiddenError.
    // No duplicate auth checks needed — return cached data for all failures.
    return _cachedLoads;
  }
};

export const saveLoad = async (load: LoadData, user: User) => {
  const loadToSave: LoadData = {
    ...load,
    companyId: load.companyId || user.companyId,
    driverId: load.driverId || user.id,
  };

  await apiCreateLoad(loadToSave);

  // Update in-memory cache
  const index = _cachedLoads.findIndex((l) => l.id === load.id);
  if (index >= 0) _cachedLoads[index] = loadToSave;
  else _cachedLoads.unshift(loadToSave);
};

export const deleteLoad = async (id: string) => {
  await deleteLoadApi(id);

  // Remove from in-memory cache after successful backend delete
  _cachedLoads = _cachedLoads.filter((l) => l.id !== id);
};

export const updateLoadStatus = async (
  loadId: string,
  status: LoadStatus,
  dispatcherId: string,
) => {
  await updateLoadStatusApi(loadId, status, dispatcherId);

  // Update in-memory cache
  const idx = _cachedLoads.findIndex((l) => l.id === loadId);
  if (idx >= 0) {
    _cachedLoads[idx].status = status;
  }
};

export const logTime = async (log: Partial<TimeLog>) => {
  try {
    await api.post("/time-logs", {
      ...log,
      user_id: log.userId,
      load_id: log.loadId,
      activity_type: log.activityType,
      location_lat: log.location?.lat,
      location_lng: log.location?.lng,
    });
  } catch (e) {
    console.error("[storageService] logTime sync failed:", e);
  }
};

export const logDispatchEvent = async (event: Partial<DispatchEvent>) => {
  // R-P3-03: Validate required fields before sending to prevent 400 errors
  const validation = validateDispatchEvent({
    load_id: event.loadId,
    event_type: event.eventType,
    message: event.message,
    payload: (event as any).payload,
  });
  if (!validation.valid) {
    console.warn(
      `[storageService] logDispatchEvent skipped — missing required fields: ${validation.errors.join(", ")}`,
    );
    return;
  }
  try {
    await api.post("/dispatch-events", {
      ...event,
      load_id: event.loadId,
      dispatcher_id: event.dispatcherId,
      event_type: event.eventType,
    });
  } catch (e) {
    console.error("[storageService] logDispatchEvent failed:", e);
  }
};

export const getDispatchEvents = async (
  companyId: string,
  signal?: AbortSignal,
): Promise<DispatchEvent[]> => {
  try {
    const data = await api.get(`/dispatch-events/${companyId}`, { signal });
    if (!data) return []; // request was aborted
    return data.map((e: any) => ({
      ...e,
      loadId: e.load_id,
      dispatcherId: e.dispatcher_id,
      eventType: e.event_type,
      createdAt: e.created_at,
    }));
  } catch (e) {
    console.warn("[storageService] getDispatchEvents failed:", e);
    return [];
  }
};

export const getTimeLogs = async (
  userIdOrCompanyId: string,
  isCompany = false,
  signal?: AbortSignal,
): Promise<TimeLog[]> => {
  const endpoint = isCompany
    ? `/time-logs/company/${userIdOrCompanyId}`
    : `/time-logs/${userIdOrCompanyId}`;
  try {
    const data = await api.get(endpoint, { signal });
    if (!data) return []; // request was aborted
    return data.map((t: any) => ({
      ...t,
      userId: t.user_id,
      loadId: t.load_id,
      activityType: t.activity_type,
      clockIn: t.clock_in,
      clockOut: t.clock_out,
      location: {
        lat: t.location_lat,
        lng: t.location_lng,
      },
    }));
  } catch (e) {
    console.warn("[storageService] getTimeLogs failed:", e);
    return [];
  }
};

// Consolidated Work Item logic at the end of the file

export const settleLoad = async (loadId: string) => {
  // Update via server API
  await updateLoadStatusApi(loadId, LOAD_STATUS.Settled, "system");

  // Update in-memory cache
  const idx = _cachedLoads.findIndex((l) => l.id === loadId);
  if (idx >= 0) {
    _cachedLoads[idx].status = LOAD_STATUS.Settled;
  }
};

export const convertBookingToLoad = async (
  bookingId: string,
  user: User,
): Promise<LoadData | null> => {
  const bookings = await _getBookings(user.companyId);
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) return null;

  const quotes = await _getQuotes();
  const quote = quotes.find((q) => q.id === booking.quoteId);
  if (!quote) return null;

  const newLoad: LoadData = {
    id: uuidv4(),
    companyId: user.companyId,
    driverId: "", // Unassigned initially
    loadNumber: `LD-${Math.floor(Math.random() * 9000) + 1000}`,
    status: LOAD_STATUS.Unassigned,
    carrierRate: quote.totalRate,
    driverPay: quote.totalRate * 0.75, // Default assumption
    pickup: quote.pickup,
    dropoff: quote.dropoff,
    legs: [],
    pickupDate: new Date().toISOString().split("T")[0],
    freightType: quote.equipmentType,
    createdAt: Date.now(),
    version: 1,
  };

  await saveLoad(newLoad, user);

  // Link back
  booking.loadId = newLoad.id;
  booking.status = "Ready_for_Dispatch";
  await _saveBooking(booking);

  return newLoad;
};

export const seedDemoLoads = (_user: User) => {
  // No-op: demo data seeding removed — all load data comes from the backend API
};

export const generateNextLoadNumber = (
  company: Company,
  clientName: string,
): string => {
  const config: LoadNumberingConfig = company.loadNumberingConfig || {
    enabled: true,
    prefix: "LD",
    suffix: "",
    nextSequence: 1000,
    separator: "-",
    includeClientTag: false,
    clientTagPosition: "after_prefix",
    clientTagFormat: "first_3",
  };
  const loadNumber = `${config.prefix}${config.separator}${config.nextSequence}`;
  updateCompany({
    ...company,
    loadNumberingConfig: { ...config, nextSequence: config.nextSequence + 1 },
  });
  return loadNumber;
};

export const generateInvoicePDF = async (load: LoadData) => {
  const company = await getCompany(load.companyId);
  const doc = new jsPDF();

  // Header - Authority Info
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(company?.name || "CARRIER NAME", 14, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(company?.address || "Address Pending", 14, 26);
  doc.text(
    `${company?.city || ""}, ${company?.state || ""} ${company?.zip || ""}`,
    14,
    30,
  );
  doc.text(
    `DOT: ${company?.dotNumber || "N/A"} | MC: ${company?.mcNumber || "N/A"}`,
    14,
    34,
  );
  doc.text(`Phone: ${company?.phone || "N/A"}`, 14, 38);

  // Invoice Meta
  doc.setFontSize(28);
  doc.setTextColor(37, 99, 235); // Blue-600
  doc.text("INVOICE", 140, 30);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice #: INV-${load.loadNumber}`, 140, 42);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 47);
  doc.text(`Load Reference: ${load.loadNumber}`, 140, 52);

  // Billing Box
  doc.setFillColor(245, 248, 255);
  doc.rect(14, 60, 180, 25, "F");
  doc.setFontSize(10);
  doc.text("BILL TO (CUSTOMER):", 18, 67);
  doc.setFont("helvetica", "normal");
  doc.text(load.pickup.facilityName || "Customer Record Pending", 18, 73);
  doc.text(`${load.pickup.city || ""}, ${load.pickup.state || ""}`, 18, 78);

  // Line Items
  const rows = [
    [
      "Professional Freight Transportation Services",
      "1",
      `$${load.carrierRate.toFixed(2)}`,
      `$${load.carrierRate.toFixed(2)}`,
    ],
  ];

  if (load.expenses) {
    load.expenses.forEach((e) => {
      rows.push([
        e.category,
        "1",
        `$${e.amount.toFixed(2)}`,
        `$${e.amount.toFixed(2)}`,
      ]);
    });
  }

  autoTable(doc, {
    startY: 95,
    head: [["Description", "Qty", "Unit Price", "Total"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235] },
  });

  const total =
    load.carrierRate + (load.expenses?.reduce((s, e) => s + e.amount, 0) || 0);

  const finalY = (doc as any).lastAutoTable.finalY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`GRAND TOTAL: $${total.toLocaleString()}`, 135, finalY + 15);

  // Regulatory Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100);
  doc.text(
    "Payment is due as per agreement. Thank you for your business.",
    14,
    280,
  );

  doc.save(`Invoice_${load.loadNumber}.pdf`);
};

export const generateBolPDF = (load: LoadData) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(`BILL OF LADING - LOAD #${load.loadNumber}`, 14, 20);
  doc.setFontSize(10);
  doc.text(
    `Pickup: ${load.pickup.facilityName} (${load.pickup.city}, ${load.pickup.state})`,
    14,
    30,
  );
  doc.text(
    `Delivery: ${load.dropoff.facilityName} (${load.dropoff.city}, ${load.dropoff.state})`,
    14,
    40,
  );
  doc.text(`Commodity: ${load.commodity}`, 14, 50);
  doc.text(`Weight: ${load.weight} lbs`, 14, 60);
  if (load.generatedBol?.driverSignature) {
    doc.text("Driver Signed Electronically", 14, 80);
    doc.addImage(load.generatedBol.driverSignature, "PNG", 14, 85, 50, 20);
  }
  doc.save(`BOL_${load.loadNumber}.pdf`);
};

export const exportToCSV = (loads: LoadData[], config: any) => {
  let csv = config.columns.join(",") + "\n";
  loads.forEach((l) => {
    const row = config.columns.map((c: string) => {
      if (c === "loadNumber") return l.loadNumber;
      if (c === "rate") return l.carrierRate;
      if (c === "customer") return l.pickup.facilityName;
      if (c === "origin") return l.pickup.city;
      return "";
    });
    csv += row.join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("hidden", "");
  a.setAttribute("href", url);
  a.setAttribute("download", "loads.csv");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const exportToPDF = (loads: LoadData[], config: any) => {
  const doc = new jsPDF();
  doc.text(config.title, 14, 15);
  const rows = loads.map((l) => [
    l.loadNumber,
    l.status,
    l.pickupDate,
    l.pickup.facilityName,
    `$${l.carrierRate}`,
  ]);
  autoTable(doc, {
    startY: 25,
    head: [["Load #", "Status", "Date", "Customer", "Rate"]],
    body: rows,
  });
  doc.save("load_report.pdf");
};

export const generateMaintenanceLogPDF = (eq: FleetEquipment, name: string) => {
  const doc = new jsPDF();
  doc.text(`Maintenance History: ${eq.id} (${eq.type})`, 14, 20);
  const rows = (eq.maintenanceHistory || []).map((m) => [
    m.date,
    m.type,
    m.description,
    `$${m.cost}`,
  ]);
  autoTable(doc, {
    startY: 30,
    head: [["Date", "Type", "Description", "Cost"]],
    body: rows,
  });
  doc.save(`Maintenance_${eq.id}.pdf`);
};

export const getIncidents = async (
  signal?: AbortSignal,
): Promise<Incident[]> => {
  try {
    const data = await api.get("/incidents", { signal });
    if (!data) return []; // request was aborted
    return data.map((inc: any) => ({
      ...inc,
      loadId: inc.load_id,
      reportedAt: inc.reported_at,
      slaDeadline: inc.sla_deadline,
      location: {
        lat: Number(inc.location_lat),
        lng: Number(inc.location_lng),
      },
      timeline:
        inc.timeline?.map((t: any) => ({
          ...t,
          actorName: t.actor_name,
          timestamp: t.timestamp,
        })) || [],
      billingItems:
        inc.billingItems?.map((b: any) => ({
          ...b,
          providerVendor: b.provider_vendor,
          approvedBy: b.approved_by,
          receiptUrl: b.receipt_url,
        })) || [],
    }));
  } catch (e) {
    console.warn("[storageService] getIncidents API unavailable:", e);
    return [];
  }
};

// seedIncidents: kept as no-op for backward compatibility (STORY-019)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const seedIncidents = async (_loads: LoadData[]): Promise<void> => {};

export const createIncident = async (incident: Partial<Incident>) => {
  const incToSave = {
    ...incident,
    id: incident.id || uuidv4(),
    reportedAt: incident.reportedAt || new Date().toISOString(),
    timeline: incident.timeline || [],
    billingItems: incident.billingItems || [],
  };

  try {
    await api.post("/incidents", {
      ...incToSave,
      load_id: incToSave.loadId,
      sla_deadline: incToSave.slaDeadline,
      location_lat: incToSave.location?.lat,
      location_lng: incToSave.location?.lng,
    });
    return true;
  } catch (e) {
    console.error("[storageService] createIncident API call failed:", e);
  }

  // API is sole source of truth — no fallback
  return false;
};

export const saveIncident = async (incident: Incident) => {
  try {
    // API is sole source of truth for incidents
    await api.post("/incidents", {
      id: incident.id,
      load_id: incident.loadId,
      type: incident.type,
      severity: incident.severity,
      status: incident.status,
      sla_deadline: incident.slaDeadline,
      description: incident.description,
      location_lat: incident.location?.lat,
      location_lng: incident.location?.lng,
      recovery_plan: incident.recoveryPlan,
    });
    return true;
  } catch (e) {
    console.warn("[storageService] saveIncident API call failed:", e);
  }

  // API is sole source of truth — no fallback
  return false;
};

export const saveIncidentAction = async (
  incidentId: string,
  action: Partial<IncidentAction>,
) => {
  try {
    await api.post(`/incidents/${incidentId}/actions`, {
      ...action,
      actor_name: action.actorName,
    });
    return true;
  } catch (e) {
    console.error("[storageService] saveIncidentAction API call failed:", e);
  }

  // API is sole source of truth — no fallback
  return false;
};

export const saveIssue = async (issue: Partial<Issue>, loadId?: string) => {
  const newIssue: Issue = {
    id: uuidv4(),
    category: "Safety",
    description: "",
    reportedAt: new Date().toISOString(),
    reportedBy: "System",
    status: "Open",
    ...(issue as any),
  };

  try {
    await api.post("/issues", { ...newIssue, load_id: loadId });
  } catch (e) {
    console.error("[storageService] saveIssue sync failed:", e);
  }

  // If tied to a shipment, update in-memory cache
  if (loadId) {
    const idx = _cachedLoads.findIndex((l) => l.id === loadId);
    if (idx >= 0) {
      const existingIssues = _cachedLoads[idx].issues || [];
      _cachedLoads[idx].issues = [...existingIssues, newIssue];
    }
  }

  return newIssue;
};

export const saveIncidentCharge = async (
  incidentId: string,
  charge: Partial<EmergencyCharge>,
) => {
  try {
    await api.post(`/incidents/${incidentId}/charges`, {
      ...charge,
      provider_vendor: charge.providerVendor,
      approved_by: charge.approvedBy,
      receipt_url: charge.receiptUrl,
    });
    return true;
  } catch (e) {
    return false;
  }
};
export const saveCallLog = async (callLog: Partial<CallLog>) => {
  const newCall: CallLog = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    type: "Operational",
    category: "Update",
    entityId: "global",
    notes: "",
    recordedBy: "System",
    ...callLog,
  };

  try {
    await api.post("/call-logs", newCall);
  } catch (e) {
    console.error("[storageService] saveCallLog sync failed:", e);
  }

  // Update related shipment in-memory cache if applicable
  if (newCall.entityId && newCall.entityId !== "global") {
    const idx = _cachedLoads.findIndex((l) => l.id === newCall.entityId);
    if (idx >= 0) {
      _cachedLoads[idx].callLogs = [
        ...(_cachedLoads[idx].callLogs || []),
        newCall,
      ];
    }
  }

  return newCall;
};

export const getOperationalTrends = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _companyId: string,
): Promise<OperationalTrend[]> => {
  // Trends are server-computed — no client-side seed data (STORY-019)
  return [];
};

export const getUnifiedEvents = async (
  selectedThreadId?: string,
): Promise<OperationalEvent[]> => {
  // 1. Thread events — threads are now server-managed (STORY-015)
  let events: OperationalEvent[] = [];

  // 2. Wrap legacy data as events for transition
  const rawLoads = getRawLoads();
  const rawIncidents = await getIncidents();
  const rawMessages = await _getMessages();

  rawIncidents.forEach((inc) => {
    events.push({
      id: inc.id,
      type: "INCIDENT",
      timestamp: inc.reportedAt,
      actorId: "system",
      actorName: "System Monitor",
      message: `Incident Reported: ${inc.type} - ${inc.severity}`,
      payload: inc,
      loadId: inc.loadId,
      isActionRequired: inc.status === "Open",
    });
  });

  rawLoads.forEach((load) => {
    (load.callLogs || []).forEach((call) => {
      events.push({
        id: call.id,
        type: "CALL_LOG",
        timestamp: call.timestamp,
        actorId: "user",
        actorName: call.recordedBy,
        message: `${call.category} Call: ${call.notes}`,
        payload: call,
        loadId: load.id,
      });
    });
    (load.issues || []).forEach((issue) => {
      events.push({
        id: issue.id,
        type: "ISSUE",
        timestamp: issue.reportedAt,
        actorId: "user",
        actorName: issue.reportedBy,
        message: `Issue Logged: ${issue.category} - ${issue.description}`,
        payload: issue,
        loadId: load.id,
        isActionRequired: issue.status === "Open",
      });
    });
  });

  rawMessages.forEach((msg) => {
    events.push({
      id: msg.id,
      type: "MESSAGE",
      timestamp: msg.timestamp,
      actorId: msg.senderId,
      actorName: msg.senderName,
      message: msg.text,
      payload: msg,
      loadId: msg.loadId,
    });
  });
  // 3. Add Requests
  const requests = await _getRawRequests();
  requests.forEach((req) => {
    events.push({
      id: req.id,
      type: "REQUEST",
      timestamp: req.createdAt,
      actorId: req.createdBy,
      actorName: req.createdBy,
      message: `${req.type} Request: ${req.requestedAmount ? "$" + req.requestedAmount : ""} - ${req.status}`,
      payload: req,
      loadId: req.loadId,
      driverId: req.driverId,
      requestId: req.id,
      isActionRequired: ["NEW", "PENDING_APPROVAL", "NEEDS_INFO"].includes(
        req.status,
      ),
    });
  });

  // 4. Add Tasks
  const tasks = await _getRawTasks();
  tasks.forEach((task) => {
    events.push({
      id: task.id,
      type: "TASK",
      timestamp: task.createdAt,
      actorId: task.createdBy,
      actorName: task.createdBy,
      message: `Task: ${task.title} - ${task.status}`,
      payload: task,
      isActionRequired: task.status !== "DONE",
    });
  });

  // 5. Add Crisis Actions
  const crisisActions = await _getRawCrisisActions();
  crisisActions.forEach((ca) => {
    events.push({
      id: ca.id,
      type: "INCIDENT",
      timestamp: ca.createdAt,
      actorId: "SYSTEM",
      actorName: "Crisis Command",
      message: `Crisis Action: ${ca.type} - ${ca.status}`,
      payload: ca,
      loadId: ca.loadId,
    });
  });

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
};

export const searchLoads = async (query: string): Promise<LoadData[]> => {
  try {
    return await searchLoadsApi(query);
  } catch (e) {
    // Fallback to in-memory cache search
    const loads = getRawLoads();
    if (!query) return loads.slice(0, 10);
    const q = query.toLowerCase();
    return loads.filter(
      (l) =>
        l.loadNumber.toLowerCase().includes(q) ||
        l.pickup.facilityName?.toLowerCase().includes(q) ||
        l.dropoff.facilityName?.toLowerCase().includes(q) ||
        l.pickup.city?.toLowerCase().includes(q) ||
        l.dropoff.city?.toLowerCase().includes(q),
    );
  }
};

export const getLoadSummary = async (
  loadId: string,
): Promise<LoadSummary | null> => {
  const loads = getRawLoads();
  const load = loads.find((l) => l.id === loadId);
  if (!load) return null;

  const requests = (await _getRawRequests()).filter((r) => r.loadId === loadId);
  const unresolved = requests.filter((r) =>
    ["NEW", "PENDING_APPROVAL", "NEEDS_INFO"].includes(r.status),
  );
  const calls = (await _getRawCalls()).filter((c) =>
    c.links.some((l) => l.entityId === loadId),
  );
  const messages = (await _getMessages()).filter((m) => m.loadId === loadId);
  const incidents = (await getIncidents()).filter((i) => i.loadId === loadId);

  return {
    id: load.id,
    loadNumber: load.loadNumber,
    status: load.status,
    hasUnresolvedRequests: unresolved.length > 0,
    unresolvedCount: unresolved.length,
    unpaidAmount: unresolved.reduce((s, r) => s + (r.requestedAmount || 0), 0),
    paidAmount: requests
      .filter((r) => r.status === "PAID")
      .reduce((s, r) => s + (r.approvedAmount || 0), 0),
    lastCallAt: calls[0]?.startTime,
    lastMessageAt: messages[messages.length - 1]?.timestamp,
    safetyFlagsCount: incidents.length,
    lastEventAt: new Date().toISOString(),
  };
};

export const getDriverSummary = async (
  driverId: string,
): Promise<DriverSummary | null> => {
  const users = getStoredUsers();
  const driver = users.find((u) => u.id === driverId);
  if (!driver) return null;

  const incidents = (await getIncidents()).filter((i) => {
    const rawLoads = getRawLoads();
    const load = rawLoads.find((l) => l.id === i.loadId);
    return load?.driverId === driverId;
  });

  const activeLoad = getRawLoads().find(
    (l) =>
      l.driverId === driverId &&
      !["delivered", "completed", "cancelled"].includes(l.status),
  );

  return {
    id: driver.id,
    name: driver.name,
    complianceStatus:
      driver.complianceStatus === "Restricted" ? "RESTRICTED" : "CLEAR",
    expiringDocsCount: (driver.complianceChecklist || []).filter(
      (c) => c.status === "Expired",
    ).length,
    openIncidentsCount: incidents.filter((i) => i.status !== "Closed").length,
    lastContactAt: new Date().toISOString(),
    assignedLoadId: activeLoad?.id,
  };
};

export const getBrokerSummary = async (brokerId: string) => {
  const brokers = await getBrokers();
  const broker = brokers.find((b) => b.id === brokerId);
  if (!broker) return null;

  const loads = getRawLoads().filter((l) => l.brokerId === brokerId);
  const loadIds = loads.map((l) => l.id);
  const requests = (await _getRawRequests()).filter((r) =>
    loadIds.includes(
      r.loadId ||
        r.links.find((lk) => lk.entityType === "LOAD")?.entityId ||
        "",
    ),
  );
  const calls = (await _getRawCalls()).filter((c) =>
    c.links.some(
      (l) => l.entityId === brokerId || loadIds.includes(l.entityId),
    ),
  );

  return {
    id: broker.id,
    name: broker.name,
    activeLoads: loads.filter(
      (l) =>
        l.status !== "delivered" &&
        l.status !== "completed" &&
        l.status !== "cancelled",
    ).length,
    unpaidAmount: requests
      .filter((r) => r.status !== "PAID")
      .reduce((s, r) => s + (r.requestedAmount || 0), 0),
    paidAmount: requests
      .filter((r) => r.status === "PAID")
      .reduce((s, r) => s + (r.approvedAmount || 0), 0),
    lastCallAt: calls[0]?.startTime,
  };
};

export const globalSearch = async (
  query: string,
): Promise<GlobalSearchResult[]> => {
  if (!query) return [];
  const q = query.toLowerCase();

  // Try to fetch from backend first for 360-degree intelligence
  try {
    const data = await api.get(`/global-search?query=${encodeURIComponent(query)}`);
    if (data) return data;
  } catch (e) {
    console.error("[storageService] globalSearch API failed:", e);
  }

  // Fallback to local storage search
  const results: GlobalSearchResult[] = [];

  // 1. Search Loads
  const loads = getRawLoads();
  loads
    .filter(
      (l) =>
        l.loadNumber.toLowerCase().includes(q) ||
        l.containerNumber?.toLowerCase().includes(q) ||
        l.pickup.facilityName?.toLowerCase().includes(q) ||
        l.pickup.city?.toLowerCase().includes(q),
    )
    .slice(0, 5)
    .forEach((l) => {
      results.push({
        id: l.id,
        type: "LOAD",
        label: `Load #${l.loadNumber}`,
        subLabel: `${l.pickup.city} -> ${l.dropoff.city}`,
        status: l.status,
        chips: [
          {
            label: l.status,
            color: l.status === "in_transit" ? "blue" : "slate",
          },
          { label: "Carrier Rate", color: "slate", value: "$" + l.carrierRate },
        ],
      });
    });

  // 2. Search Drivers
  const users = getStoredUsers().filter((u) => u.role === "driver");
  users
    .filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q),
    )
    .slice(0, 5)
    .forEach((d) => {
      results.push({
        id: d.id,
        type: "DRIVER",
        label: d.name,
        subLabel: d.email,
        status: d.complianceStatus,
        chips: [
          { label: d.role?.toUpperCase() || "DRIVER", color: "blue" },
          {
            label: d.complianceStatus || "Active",
            color: d.complianceStatus === "Restricted" ? "red" : "green",
          },
        ],
      });
    });

  // 3. Search Requests
  const srchRequests = await _getRawRequests();
  srchRequests
    .filter(
      (r) => r.id.toLowerCase().includes(q) || r.type.toLowerCase().includes(q),
    )
    .slice(0, 5)
    .forEach((r) => {
      results.push({
        id: r.id,
        type: "REQUEST",
        label: `${r.type} Request #${r.id}`,
        subLabel: `Status: ${r.status}`,
        chips: [
          {
            label: r.status,
            color: r.status === "APPROVED" ? "green" : "orange",
          },
        ],
      });
    });

  // 4. Search Brokers (Customers)
  const brokers = await getBrokers();
  brokers
    .filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        b.mcNumber?.toLowerCase().includes(q),
    )
    .slice(0, 5)
    .forEach((b) => {
      results.push({
        id: b.id,
        type: "BROKER",
        label: b.name,
        subLabel: `MC# ${b.mcNumber || "N/A"}`,
        status: b.isShared ? "Shared" : "Private",
        chips: [{ label: b.clientType || "Broker", color: "blue" }],
      });
    });

  return results;
};

export const getRecord360Data = async (type: EntityType, id: string) => {
  const loads = getRawLoads();
  const requests = await _getRawRequests();
  const calls = await _getRawCalls();
  const messages = await _getMessages();
  const incidents = await getIncidents();
  const tasks = await _getRawTasks();
  const contacts = await _getContacts();

  const buildTimeline = (events: any[]) => {
    return events.sort(
      (a, b) =>
        new Date(b.timestamp || b.createdAt).getTime() -
        new Date(a.timestamp || a.createdAt).getTime(),
    );
  };

  if (type === "LOAD") {
    const load = loads.find((l) => l.id === id);
    const linkedRequests = requests.filter(
      (r) => r.loadId === id || r.links.some((l) => l.entityId === id),
    );
    const linkedCalls = calls.filter((c) =>
      c.links.some((l) => l.entityId === id),
    );
    const linkedMessages = messages.filter((m) => m.loadId === id);
    const linkedIncidents = incidents.filter((i) => i.loadId === id);
    const linkedTasks = tasks.filter(
      (t) =>
        t.links.some((lk) => lk.entityType === "LOAD" && lk.entityId === id) ||
        t.assignedTo === load?.driverId,
    );
    const driver = getStoredUsers().find((u) => u.id === load?.driverId);
    const allBrokersForLoad = await getBrokers();
    const broker = allBrokersForLoad.find((b) => b.id === load?.brokerId);

    const vaultDocs = (await _getRawVaultDocs()).filter(
      (d) => d.entityId === id,
    );

    const timeline = buildTimeline([
      ...linkedRequests.map((r) => ({
        ...r,
        type: "REQUEST",
        timestamp: r.createdAt,
        actorName: r.createdBy,
        action: `${r.type} Request`,
      })),
      ...linkedCalls.map((c) => ({
        ...c,
        type: "CALL",
        timestamp: c.startTime,
        actorName: c.participants[0]?.name || "Unknown",
        action: "Interaction",
      })),
      ...linkedMessages.map((m) => ({
        ...m,
        type: "MESSAGE",
        action: "Strategic Note",
        actorName: m.senderName,
      })),
      ...linkedIncidents.map((i) => ({
        ...i,
        type: "INCIDENT",
        timestamp: i.reportedAt,
        actorName: "System",
        action: `${i.type} Reported`,
      })),
      ...linkedTasks.map((t) => ({
        ...t,
        type: "TASK",
        timestamp: t.createdAt,
        actorName: t.createdBy,
        action: `Task: ${t.title}`,
      })),
    ]);

    return {
      load,
      requests: linkedRequests,
      calls: linkedCalls,
      messages: linkedMessages,
      incidents: linkedIncidents,
      tasks: linkedTasks,
      driver,
      broker,
      timeline,
      vaultDocs,
    };
  } else if (type === "DRIVER") {
    const driver = getStoredUsers().find((u) => u.id === id);
    const driverLoads = loads.filter((l) => l.driverId === id);
    const loadIds = driverLoads.map((l) => l.id);
    const linkedRequests = requests.filter(
      (r) => r.driverId === id || loadIds.includes(r.loadId || ""),
    );
    const linkedCalls = calls.filter((c) =>
      c.links.some((l) => l.entityId === id || loadIds.includes(l.entityId)),
    );
    const linkedMessages = messages.filter((m) =>
      loadIds.includes(m.loadId || ""),
    );
    const linkedIncidents = incidents.filter((i) => loadIds.includes(i.loadId));

    const timeline = buildTimeline([
      ...linkedRequests.map((r) => ({
        ...r,
        type: "REQUEST",
        timestamp: r.createdAt,
        actorName: r.createdBy,
        action: `${r.type} Request`,
      })),
      ...linkedCalls.map((c) => ({
        ...c,
        type: "CALL",
        timestamp: c.startTime,
        actorName: c.participants[0]?.name || "Unknown",
        action: "Interaction",
      })),
      ...linkedMessages.map((m) => ({
        ...m,
        type: "MESSAGE",
        action: "Strategic Note",
        actorName: m.senderName,
      })),
      ...linkedIncidents.map((i) => ({
        ...i,
        type: "INCIDENT",
        timestamp: i.reportedAt,
        actorName: "System",
        action: `${i.type} Reported`,
      })),
    ]);

    return {
      driver,
      loads: driverLoads,
      requests: linkedRequests,
      calls: linkedCalls,
      messages: linkedMessages,
      incidents: linkedIncidents,
      timeline,
    };
  } else if (type === "BROKER") {
    const allBrokersForRecord = await getBrokers();
    const broker = allBrokersForRecord.find((b) => b.id === id);
    const brokerLoads = loads.filter((l) => l.brokerId === id);
    const loadIds = brokerLoads.map((l) => l.id);
    const linkedRequests = requests.filter((r) =>
      r.links.some((l) => l.entityId === id || loadIds.includes(l.entityId)),
    );
    const linkedCalls = calls.filter((c) =>
      c.links.some((l) => l.entityId === id || loadIds.includes(l.entityId)),
    );

    const timeline = buildTimeline([
      ...linkedRequests.map((r) => ({
        ...r,
        type: "REQUEST",
        timestamp: r.createdAt,
        actorName: r.createdBy,
        action: `${r.type} Request`,
      })),
      ...linkedCalls.map((c) => ({
        ...c,
        type: "CALL",
        timestamp: c.startTime,
        actorName: c.participants[0]?.name || "Unknown",
        action: "Interaction",
      })),
    ]);

    return {
      broker,
      loads: brokerLoads,
      requests: linkedRequests,
      calls: linkedCalls,
      timeline,
    };
  } else if (type === "INCIDENT") {
    const incident = incidents.find((i) => i.id === id);
    const load = loads.find((l) => l.id === incident?.loadId);
    const driver = getStoredUsers().find((u) => u.id === load?.driverId);
    const linkedRequests = requests.filter((r) =>
      r.links.some((l) => l.entityId === id || l.entityId === incident?.loadId),
    );
    const linkedTasks = tasks.filter((t) =>
      t.links.some(
        (lk) => lk.entityId === id || lk.entityId === incident?.loadId,
      ),
    );
    const linkedCalls = calls.filter((c) =>
      c.links.some((l) => l.entityId === id || l.entityId === incident?.loadId),
    );
    const vaultDocs = (await _getRawVaultDocs()).filter(
      (d) => d.entityId === id || d.entityId === incident?.loadId,
    );

    const timeline = buildTimeline([
      ...(incident?.timeline || []).map((ev: any) => ({
        ...ev,
        type: "CRISIS_EVENT",
      })),
      ...linkedRequests.map((r) => ({
        ...r,
        type: "REQUEST",
        timestamp: r.createdAt,
        actorName: r.createdBy,
        action: `${r.type} Request`,
      })),
      ...linkedTasks.map((t) => ({
        ...t,
        type: "TASK",
        timestamp: t.createdAt,
        actorName: t.createdBy,
        action: `Task: ${t.title}`,
      })),
      ...linkedCalls.map((c) => ({
        ...c,
        type: "CALL",
        timestamp: c.startTime,
        actorName: c.participants[0]?.name || "Unknown",
        action: "Interaction",
      })),
    ]);

    return {
      incident,
      load,
      driver,
      requests: linkedRequests,
      tasks: linkedTasks,
      calls: linkedCalls,
      timeline,
      vaultDocs,
    };
  }

  return null;
};

export const getTriageQueues = async () => {
  const requests = await _getUnresolvedRequests();
  const incidents = await getIncidents();
  const tasks = await _getRawTasks();
  const calls = await _getRawCalls();
  const loads = getRawLoads();

  // DEMO_MODE seed calls removed -- data comes from API (STORY-016)

  const workItems = await _getWorkItems();
  // DEMO_MODE seed work items removed -- data comes from API (STORY-016)

  const finalWorkItems = workItems.filter((wi) => wi.status !== "Resolved");

  return {
    requests: requests.filter((r) =>
      ["NEW", "PENDING_APPROVAL"].includes(r.status),
    ),
    incidents: incidents.filter((i) => i.status !== "Closed"),
    tasks: tasks.filter((t) => t.status === "OPEN"),
    calls: (await _getRawCalls()).filter(
      (c) => !["RESOLVED", "COMPLETED"].includes(c.status),
    ),
    atRiskLoads: loads.filter(
      (l) =>
        (l.status === "in_transit" && l.isActionRequired) ||
        DispatchIntelligence.predictExceptionRisk(l).risk === "HIGH",
    ),
    workItems: finalWorkItems,
  };
};

export const initiateRepowerWorkflow = async (
  loadId: string,
  user: User,
  notes: string,
) => {
  // 1. Create Request
  const request: KCIRequest = {
    id: `REQ-${uuidv4().slice(0, 8).toUpperCase()}`,
    type: "REPOWER",
    status: "PENDING_APPROVAL",
    priority: "HIGH",
    currency: "USD",
    requiresDocs: false,
    links: [
      {
        id: uuidv4(),
        entityType: "LOAD",
        entityId: loadId,
        isPrimary: true,
        createdAt: new Date().toISOString(),
        createdBy: user.name,
      },
    ],
    loadId,
    source: "SAFETY",
    createdBy: user.name,
    requestedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 3600000).toISOString(),
    decisionLog: [],
  };
  await _saveRequest(request);

  // 2. Create Task for Dispatch
  const task: OperationalTask = {
    id: `TASK-${uuidv4().slice(0, 8).toUpperCase()}`,
    type: "REPOWER_HANDOFF",
    title: `URGENT: Repower Required for Load`,
    description: `Safety has triggered a repower request. Reason: ${notes}`,
    status: "OPEN",
    priority: "CRITICAL",
    assignedTo: "DISPATCH_TEAM",
    dueDate: new Date(Date.now() + 1800000).toISOString(),
    links: [
      {
        id: uuidv4(),
        entityType: "LOAD",
        entityId: loadId,
        isPrimary: true,
        createdAt: new Date().toISOString(),
        createdBy: user.name,
      },
    ],
    createdAt: new Date().toISOString(),
    createdBy: user.name,
  };
  await _saveTask(task);

  // 3. Mark shipment as At Risk (in-memory cache only)
  const idx = _cachedLoads.findIndex((l) => l.id === loadId);
  if (idx >= 0) {
    _cachedLoads[idx].isActionRequired = true;
    _cachedLoads[idx].actionSummary = "REPOWER PENDING";
  }

  // 4. Log Event
  await logDispatchEvent({
    loadId,
    dispatcherId: user.id,
    eventType: "SystemAlert",
    message: `REPOWER WORKFLOW INITIATED by Safety (${user.name})`,
  });
};

export const verifyTrailerDrop = async (
  loadId: string,
  user: User,
  data: {
    trailerId: string;
    location: string;
    photo?: string;
    condition: string;
  },
) => {
  // 1. Log Event
  await logDispatchEvent({
    loadId,
    dispatcherId: user.id,
    eventType: "Note",
    message: `TRAILER DROP VERIFIED: Unit ${data.trailerId} @ ${data.location}. Condition: ${data.condition}`,
  });

  // 2. Update shipment (in-memory cache only)
  const tvIdx = _cachedLoads.findIndex((l) => l.id === loadId);
  if (tvIdx >= 0) {
    const legs = _cachedLoads[tvIdx].legs || [];
    const legIdx = legs.findIndex((leg) => leg.type === "Dropoff");
    if (legIdx >= 0) {
      legs[legIdx].completed = true;
      legs[legIdx].completedAt = new Date().toISOString();
    }
    _cachedLoads[tvIdx].legs = legs;
  }
};
