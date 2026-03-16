import { API_URL } from "./config";
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
import { storage, DEMO_MODE } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  getCompany,
  updateCompany,
  getStoredUsers,
  getAuthHeaders,
  getCurrentUser,
} from "./authService";
export { getAuthHeaders };
import { getRawBrokers } from "./brokerService";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { v4 as uuidv4 } from "uuid";
import { DispatchIntelligence } from "./dispatchIntelligence";
import {
  fetchLoads as apiFetchLoads,
  createLoad as apiCreateLoad,
  updateLoadStatusApi,
  searchLoadsApi,
} from "./loadService";

// STORAGE_KEY for loads removed — load data comes from backend API only
// API endpoint paths for tenant-scoped operational entities
const API_PATH_INCIDENTS = "/api/incidents"; // used by fetch calls in getIncidents / saveIncident

/**
 * Tenant-scoped localStorage key builder (F-008 fix).
 *
 * Returns `loadpilot_{companyId}_{baseName}` when a companyId is available,
 * or the legacy `{baseName}` key as graceful degradation when no session exists.
 *
 * On first access, checks for data stored under the legacy unprefixed key and
 * migrates it to the new tenant-scoped key so existing user data is not lost.
 *
 * @param baseName - The short key name (e.g. "incidents_v1")
 */
export const getTenantKey = (baseName: string): string => {
  const companyId = getCurrentUser()?.companyId;
  const legacyKey = `loadpilot_${baseName}`;
  if (!companyId) return legacyKey; // graceful degradation — returns legacy key format
  const tenantKey = `loadpilot_${companyId}_${baseName}`;
  // Migrate legacy unprefixed key data to tenant-scoped key on first access
  migrateKey(legacyKey, tenantKey);
  return tenantKey;
};

/**
 * One-shot legacy key migration helper.
 * Copies data from `legacyKey` to `newKey` if legacy data exists and new key is empty.
 * Removes the legacy key after a successful migration.
 */
const migrateKey = (legacyKey: string, newKey: string): void => {
  try {
    const legacyData = localStorage.getItem(legacyKey);
    if (!legacyData) return; // nothing to migrate
    const newData = localStorage.getItem(newKey);
    if (newData) {
      // new key already has data — legacy key is stale, remove it
      localStorage.removeItem(legacyKey);
      return;
    }
    // migrate: copy legacy data to tenant key then remove old key
    localStorage.setItem(newKey, legacyData);
    localStorage.removeItem(legacyKey);
  } catch (_error: unknown) {
    // non-fatal — migration failure means data stays at legacy key
  }
};

// Tenant-scoped localStorage key accessors (replaces static STORAGE_KEY_* constants)
const STORAGE_KEY_INCIDENTS = (): string => getTenantKey("incidents_v1");
const STORAGE_KEY_MESSAGES = (): string => getTenantKey("messages_v1");
const STORAGE_KEY_REQUESTS = (): string => getTenantKey("requests_v1");
const STORAGE_KEY_CALLS = (): string => getTenantKey("calls_v1");
const STORAGE_KEY_PROVIDERS = (): string => getTenantKey("providers_v1");
const STORAGE_KEY_CONTACTS = (): string => getTenantKey("contacts_v1");
const STORAGE_KEY_TASKS = (): string => getTenantKey("tasks_v1");
const STORAGE_KEY_CRISIS = (): string => getTenantKey("crisis_v1");
const STORAGE_KEY_SERVICE_TICKETS = (): string =>
  getTenantKey("service_tickets_v1");
const STORAGE_KEY_NOTIFICATION_JOBS = (): string =>
  getTenantKey("notification_jobs_v1");
const STORAGE_KEY_QUOTES = (): string => getTenantKey("quotes_v1");
const STORAGE_KEY_BOOKINGS = (): string => getTenantKey("bookings_v1");
const STORAGE_KEY_LEADS = (): string => getTenantKey("leads_v1");
const STORAGE_KEY_WORK_ITEMS = (): string => getTenantKey("work_items_v1");
const STORAGE_KEY_VAULT_DOCS = (): string => getTenantKey("vault_docs_v1");

// In-memory cache for API-fetched data (browser storage removed)
let _cachedLoads: LoadData[] = [];

const getRawLoads = (): LoadData[] => {
  // Returns cached results from last API fetch
  return _cachedLoads;
};

const getRawIncidents = (): Incident[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_INCIDENTS());
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((inc: any) => ({
      ...inc,
      id: inc.id || uuidv4(),
      timeline: inc.timeline || [],
      billingItems: inc.billingItems || [],
    }));
  } catch (e) {
    return [];
  }
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
  } catch (e) {
    // Return cached loads if API is unavailable
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
  // Remove from in-memory cache; backend delete not yet implemented
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

export const linkSessionToRecord = async (
  sessionId: string,
  recordId: string,
  recordType: EntityType,
) => {
  const data = localStorage.getItem(STORAGE_KEY_CALLS());
  if (!data) return;
  let sessions: CallSession[] = JSON.parse(data);
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    const link: RecordLink = {
      id: uuidv4(),
      entityType: recordType,
      entityId: recordId,
      isPrimary: true,
      createdAt: new Date().toISOString(),
      createdBy: "SYSTEM",
    };
    sessions[idx].links = [...(sessions[idx].links || []), link];
    localStorage.setItem(STORAGE_KEY_CALLS(), JSON.stringify(sessions));
  }
};

export const logTime = async (log: Partial<TimeLog>) => {
  try {
    await fetch(`${API_URL}/time-logs`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        ...log,
        user_id: log.userId,
        load_id: log.loadId,
        activity_type: log.activityType,
        location_lat: log.location?.lat,
        location_lng: log.location?.lng,
      }),
    });
  } catch (e) {
    console.error("[storageService] logTime sync failed:", e);
  }
};

export const logDispatchEvent = async (event: Partial<DispatchEvent>) => {
  try {
    await fetch(`${API_URL}/dispatch-events`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        ...event,
        load_id: event.loadId,
        dispatcher_id: event.dispatcherId,
        event_type: event.eventType,
      }),
    });
  } catch (e) {
    console.error("[storageService] logDispatchEvent failed:", e);
  }
};

export const getDispatchEvents = async (
  companyId: string,
): Promise<DispatchEvent[]> => {
  try {
    const res = await fetch(`${API_URL}/dispatch-events/${companyId}`, {
      headers: await getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data.map((e: any) => ({
        ...e,
        loadId: e.load_id,
        dispatcherId: e.dispatcher_id,
        eventType: e.event_type,
        createdAt: e.created_at,
      }));
    }
  } catch (e) {
    console.warn("[storageService] API fallback:", e);
  }
  return [];
};

export const getTimeLogs = async (
  userIdOrCompanyId: string,
  isCompany = false,
): Promise<TimeLog[]> => {
  try {
    const url = isCompany
      ? `${API_URL}/time-logs/company/${userIdOrCompanyId}`
      : `${API_URL}/time-logs/${userIdOrCompanyId}`;
    const res = await fetch(url, {
      headers: await getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
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
    }
  } catch (e) {
    console.warn("[storageService] API fallback:", e);
  }
  return [];
};

// Consolidated Work Item logic at the end of the file

export const settleLoad = async (loadId: string) => {
  // Update via API — no localStorage
  await updateLoadStatusApi(loadId, LOAD_STATUS.Settled, "system");

  // Update in-memory cache
  const idx = _cachedLoads.findIndex((l) => l.id === loadId);
  if (idx >= 0) {
    _cachedLoads[idx].status = LOAD_STATUS.Settled;
  }
};

// --- NEW QUOTE / BOOKING / LEAD SERVICE ---

export const getLeads = async (companyId: string): Promise<Lead[]> => {
  const data = localStorage.getItem(STORAGE_KEY_LEADS());
  const leads: Lead[] = data ? JSON.parse(data) : [];
  return leads.filter((l) => l.companyId === companyId);
};

export const saveLead = async (lead: Lead) => {
  const leads = await getLeads(lead.companyId);
  const idx = leads.findIndex((l) => l.id === lead.id);
  if (idx >= 0) leads[idx] = lead;
  else leads.unshift(lead);
  localStorage.setItem(STORAGE_KEY_LEADS(), JSON.stringify(leads));
};

export const getQuotes = async (companyId: string): Promise<Quote[]> => {
  const data = localStorage.getItem(STORAGE_KEY_QUOTES());
  const quotes: Quote[] = data ? JSON.parse(data) : [];
  return quotes.filter((q) => q.companyId === companyId);
};

export const saveQuote = async (quote: Quote) => {
  const data = localStorage.getItem(STORAGE_KEY_QUOTES());
  let quotes: Quote[] = data ? JSON.parse(data) : [];
  const idx = quotes.findIndex((q) => q.id === quote.id);
  if (idx >= 0) quotes[idx] = quote;
  else quotes.unshift(quote);
  localStorage.setItem(STORAGE_KEY_QUOTES(), JSON.stringify(quotes));
};

export const getBookings = async (companyId: string): Promise<Booking[]> => {
  const data = localStorage.getItem(STORAGE_KEY_BOOKINGS());
  const bookings: Booking[] = data ? JSON.parse(data) : [];
  return bookings.filter((b) => b.companyId === companyId);
};

export const saveBooking = async (booking: Booking) => {
  const data = localStorage.getItem(STORAGE_KEY_BOOKINGS());
  let bookings: Booking[] = data ? JSON.parse(data) : [];
  const idx = bookings.findIndex((b) => b.id === booking.id);
  if (idx >= 0) bookings[idx] = booking;
  else bookings.unshift(booking);
  localStorage.setItem(STORAGE_KEY_BOOKINGS(), JSON.stringify(bookings));
};

export const convertBookingToLoad = async (
  bookingId: string,
  user: User,
): Promise<LoadData | null> => {
  const bookings = await getBookings(user.companyId);
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) return null;

  const quotes = await getQuotes(user.companyId);
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
  await saveBooking(booking);

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

export const getIncidents = async (): Promise<Incident[]> => {
  try {
    const res = await fetch(`${API_URL}/incidents`, {
      headers: await getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      const remote = data.map((inc: any) => ({
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

      // Merge: Remote takes precedence for existing, but local-only (unsynced) are kept
      const local = getRawIncidents();
      const remoteIds = new Set(remote.map((r: any) => r.id));
      const localOnly = local.filter((l) => !remoteIds.has(l.id));
      const merged = [...remote, ...localOnly];

      localStorage.setItem(STORAGE_KEY_INCIDENTS(), JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.warn("[storageService] API fallback:", e);
  }

  return getRawIncidents();
};

export const seedIncidents = async (loads: LoadData[]) => {
  if (loads.length === 0) return;
  const existing = await getIncidents();
  if (existing.length > 0) return;

  const incidents: Incident[] = [
    {
      id: "inc-desc-001",
      loadId: loads[0].id,
      type: "Motor Breakdown",
      severity: "Critical",
      status: "Open",
      reportedAt: new Date(Date.now() - 3600000 * 4).toISOString(), // 4h ago
      slaDeadline: new Date(Date.now() + 3600000).toISOString(), // 1h left
      description:
        "Engine failure on I-90 EB. Smoke reported from engine bay. Vehicle stationary on shoulder.",
      location: { lat: 41.8781, lng: -87.6298 },
      timeline: [
        {
          id: uuidv4(),
          timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
          actorName: "System",
          action: "INCIDENT_REPORTED",
          notes: "Automated breakdown detection via ELD telemetry.",
        },
      ],
      billingItems: [],
      serviceTickets: [],
      isAtRisk: true,
    },
    {
      id: "inc-desc-002",
      loadId: (loads[1] || loads[0]).id,
      type: "Hours of Service Risk",
      severity: "High",
      status: "Open",
      reportedAt: new Date(Date.now() - 3600000).toISOString(), // 1h ago
      slaDeadline: new Date(Date.now() + 3600000 * 3).toISOString(), // 3h left
      description:
        "Driver nearing 11-hour driving limit while 80 miles from destination. High risk of violation.",
      location: { lat: 40.0, lng: -83.0 },
      timeline: [
        {
          id: uuidv4(),
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          actorName: "Safety Bot",
          action: "RISK_DETECTED",
          notes: "ELD analysis predicts violation in 45 minutes.",
        },
      ],
      billingItems: [],
      serviceTickets: [],
      isAtRisk: true,
    },
  ];

  for (const inc of incidents) {
    try {
      await fetch(`${API_URL}/incidents`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          ...inc,
          load_id: inc.loadId,
          sla_deadline: inc.slaDeadline,
        }),
      });

      for (const t of inc.timeline || []) {
        await fetch(`${API_URL}/incidents/${inc.id}/actions`, {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            ...t,
            actor_name: t.actorName,
          }),
        });
      }
    } catch (e) {
      console.error("[storageService] seedIncidents sync failed:", e);
    }
  }

  const currentLocal = getRawIncidents();
  localStorage.setItem(
    STORAGE_KEY_INCIDENTS(),
    JSON.stringify([...incidents, ...currentLocal]),
  );
};

export const createIncident = async (incident: Partial<Incident>) => {
  const incToSave = {
    ...incident,
    id: incident.id || uuidv4(),
    reportedAt: incident.reportedAt || new Date().toISOString(),
    timeline: incident.timeline || [],
    billingItems: incident.billingItems || [],
  };

  try {
    const res = await fetch(`${API_URL}/incidents`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        ...incToSave,
        load_id: incToSave.loadId,
        sla_deadline: incToSave.slaDeadline,
        location_lat: incToSave.location?.lat,
        location_lng: incToSave.location?.lng,
      }),
    });

    if (res.ok) {
      // Successfully synced
    }
  } catch (e) {
    console.error("[storageService] createIncident sync failed:", e);
  }

  // Always save to localStorage as safety
  const incidents = getRawIncidents();
  incidents.unshift(incToSave as Incident);
  localStorage.setItem(STORAGE_KEY_INCIDENTS(), JSON.stringify(incidents));
  return true; // Return true because we persisted at least locally
};

export const saveIncident = async (incident: Incident) => {
  try {
    // API primary: fetch api/incidents (tenant-scoped, durable storage)
    const res = await fetch(`${API_URL}/incidents`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
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
      }),
    });
    if (res.ok) {
      return true;
    }
  } catch (e) {
    console.warn("[storageService] saveIncident API call failed:", e);
  }

  // Fallback: write to localStorage if API unavailable
  const incidents = getRawIncidents();
  const idx = incidents.findIndex((i) => i.id === incident.id);
  if (idx >= 0) incidents[idx] = incident;
  else incidents.unshift(incident);
  localStorage.setItem(STORAGE_KEY_INCIDENTS(), JSON.stringify(incidents));
  return true;
};

export const saveIncidentAction = async (
  incidentId: string,
  action: Partial<IncidentAction>,
) => {
  try {
    const res = await fetch(`${API_URL}/incidents/${incidentId}/actions`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        ...action,
        actor_name: action.actorName,
      }),
    });
    if (res.ok) {
      // Synced
    }
  } catch (e) {
    console.error("[storageService] saveIncidentAction sync failed:", e);
  }

  // Persist locally
  const incidents = getRawIncidents();
  const idx = incidents.findIndex((inc) => inc.id === incidentId);
  if (idx >= 0) {
    const newAction: IncidentAction = {
      id: uuidv4(),
      incident_id: incidentId,
      action: action.action || "Unknown",
      actorName: action.actorName || "System",
      actor_name: action.actorName || "System",
      notes: action.notes || "",
      timestamp: new Date().toISOString(),
    };
    incidents[idx].timeline = [...(incidents[idx].timeline || []), newAction];
    localStorage.setItem(STORAGE_KEY_INCIDENTS(), JSON.stringify(incidents));
  }
  return true;
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
    await fetch(`${API_URL}/issues`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ ...newIssue, load_id: loadId }),
    });
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
    const res = await fetch(`${API_URL}/incidents/${incidentId}/charges`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        ...charge,
        provider_vendor: charge.providerVendor,
        approved_by: charge.approvedBy,
        receipt_url: charge.receiptUrl,
      }),
    });
    return res.ok;
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
    await fetch(`${API_URL}/call-logs`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(newCall),
    });
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
  companyId: string,
): Promise<OperationalTrend[]> => {
  // Demo mode: return sample ERP trends for demonstration purposes
  if (!DEMO_MODE) return [];
  return [
    {
      id: "t1",
      entityType: "Driver",
      entityId: "d1",
      trendType: "Consistent_Late",
      severity: "Critical",
      observationCount: 4,
      lastOccurrence: new Date().toISOString(),
    },
    {
      id: "t2",
      entityType: "Broker",
      entityId: "b1",
      trendType: "Contract_Risk",
      severity: "Warning",
      observationCount: 2,
      lastOccurrence: new Date().toISOString(),
    },
  ];
};

export const getMessages = async (loadId?: string): Promise<Message[]> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_MESSAGES());
    let messages: Message[] = data ? JSON.parse(data) : [];

    if (messages.length === 0 && DEMO_MODE) {
      // Demo mode: seed sample messages for demonstration
      messages = [
        {
          id: "1",
          loadId: "L-1001",
          senderId: "driver-123",
          senderName: "Alex Rivera",
          text: "Stuck at terminal gates. Long wait time today.",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: "2",
          loadId: "L-1001",
          senderId: "dispatcher-1",
          senderName: "Dispatcher",
          text: "Acknowledged. Log detention after 2 hours.",
          timestamp: new Date(Date.now() - 3000000).toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY_MESSAGES(), JSON.stringify(messages));
    }

    if (loadId) {
      return messages.filter((m) => m.loadId === loadId);
    }
    return messages;
  } catch (e) {
    return [];
  }
};

export const saveMessage = async (message: Message) => {
  try {
    const messages = await getMessages();
    messages.push(message);
    localStorage.setItem(STORAGE_KEY_MESSAGES(), JSON.stringify(messages));

    // Attempt remote sync if API is available
    try {
      await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(message),
      });
    } catch (e) {
      console.warn("[storageService] API fallback:", e);
    }
  } catch (e) {
    console.error("[storageService] saveMessage failed:", e);
  }
};
const STORAGE_KEY_THREADS = (): string => getTenantKey("threads_v1");

export const getThreads = async (
  companyId: string,
): Promise<OperationalThread[]> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_THREADS());
    if (!data) return [];
    const threads: OperationalThread[] = JSON.parse(data);
    return threads.filter(
      (t) => t.id.includes(companyId) || t.ownerId === companyId,
    ); // Broad tenant filter — matches thread ID or owner
  } catch (e) {
    return [];
  }
};

export const saveThread = async (thread: OperationalThread) => {
  try {
    const threads = await getThreads(""); // Get all
    const idx = threads.findIndex((t) => t.id === thread.id);
    if (idx >= 0) threads[idx] = thread;
    else threads.unshift(thread);
    localStorage.setItem(STORAGE_KEY_THREADS(), JSON.stringify(threads));
  } catch (e) {
    console.error("[storageService] saveThread failed:", e);
  }
};

export const getUnifiedEvents = async (
  selectedThreadId?: string,
): Promise<OperationalEvent[]> => {
  // 1. Get native events from threads if selected
  let events: OperationalEvent[] = [];
  if (selectedThreadId) {
    const threads = await getThreads("");
    const thread = threads.find((t) => t.id === selectedThreadId);
    if (thread) events = [...thread.events];
  }

  // 2. Wrap legacy data as events for transition
  const rawLoads = getRawLoads();
  const rawIncidents = await getIncidents();
  const rawMessages = await getMessages();

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
  const requests = getRawRequests();
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
  const tasks = getRawTasks();
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
  const crisisActions = getRawCrisisActions();
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

export const getRawCalls = (): CallSession[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_CALLS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveCallSession = async (session: CallSession) => {
  const sessions = getRawCalls();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  localStorage.setItem(STORAGE_KEY_CALLS(), JSON.stringify(sessions));
};

export const attachToRecord = async (
  callId: string,
  entityType: string,
  entityId: string,
  actorName: string,
) => {
  const sessions = getRawCalls();
  const idx = sessions.findIndex((s) => s.id === callId);
  if (idx >= 0) {
    const session = sessions[idx];
    const newLink: RecordLink = {
      id: uuidv4(),
      entityType: entityType as any,
      entityId,
      isPrimary: session.links.length === 0,
      createdAt: new Date().toISOString(),
      createdBy: actorName,
    };
    session.links.push(newLink);
    localStorage.setItem(STORAGE_KEY_CALLS(), JSON.stringify(sessions));
    return session;
  }
  return null;
};

const getRawRequests = (): KCIRequest[] => {
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
      // Then Overdue (not implemented strictly here, but could use dueAt)
      // Then Oldest
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
};

export const getLoadSummary = async (
  loadId: string,
): Promise<LoadSummary | null> => {
  const loads = getRawLoads();
  const load = loads.find((l) => l.id === loadId);
  if (!load) return null;

  const requests = getRawRequests().filter((r) => r.loadId === loadId);
  const unresolved = requests.filter((r) =>
    ["NEW", "PENDING_APPROVAL", "NEEDS_INFO"].includes(r.status),
  );
  const calls = getRawCalls().filter((c) =>
    c.links.some((l) => l.entityId === loadId),
  );
  const messages = (await getMessages()).filter((m) => m.loadId === loadId);
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
  const brokers = getRawBrokers();
  const broker = brokers.find((b) => b.id === brokerId);
  if (!broker) return null;

  const loads = getRawLoads().filter((l) => l.brokerId === brokerId);
  const loadIds = loads.map((l) => l.id);
  const requests = getRawRequests().filter((r) =>
    loadIds.includes(
      r.loadId ||
        r.links.find((lk) => lk.entityType === "LOAD")?.entityId ||
        "",
    ),
  );
  const calls = getRawCalls().filter((c) =>
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
    safetyRating: 9.8, // Mock rating
  };
};

export const globalSearch = async (
  query: string,
): Promise<GlobalSearchResult[]> => {
  if (!query) return [];
  const q = query.toLowerCase();

  // Try to fetch from backend first for 360 degree intelligence
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${API_URL}/global-search?query=${encodeURIComponent(query)}`,
      {
        headers,
      },
    );
    if (res.ok) {
      return await res.json();
    }
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
  const requests = getRawRequests();
  requests
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
  const brokers = getRawBrokers();
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
  const requests = getRawRequests();
  const calls = getRawCalls();
  const messages = await getMessages();
  const incidents = await getIncidents();
  const tasks = getRawTasks();
  const contacts = getRawContacts();

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
    const broker = getRawBrokers().find((b) => b.id === load?.brokerId);

    const vaultDocs = getRawVaultDocs().filter((d) => d.entityId === id);

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
    const broker = getRawBrokers().find((b) => b.id === id);
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
    const vaultDocs = getRawVaultDocs().filter(
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
  const requests = await getUnresolvedRequests();
  const incidents = await getIncidents();
  const tasks = getRawTasks();
  const calls = getRawCalls();
  const loads = getRawLoads();

  if (calls.length === 0) {
    const seedCalls: CallSession[] = [
      {
        id: "CALL-INT-101",
        startTime: new Date(Date.now() - 300000).toISOString(),
        status: "WAITING",
        participants: [{ id: "D-22", name: "Robert Miller", role: "DRIVER" }],
        lastActivityAt: new Date().toISOString(),
        links: [
          {
            id: uuidv4(),
            entityType: "LOAD",
            entityId: "L-1001",
            isPrimary: true,
            createdAt: new Date().toISOString(),
            createdBy: "System",
          },
        ],
      },
    ];
    localStorage.setItem(STORAGE_KEY_CALLS(), JSON.stringify(seedCalls));
  }

  const workItems = await getWorkItems();
  if (workItems.length === 0) {
    const seedWorkItems: WorkItem[] = [
      {
        id: "WI-5001",
        companyId: "iscope-authority-001",
        type: "Detention_Review",
        label: "Detention: Load LP-9001",
        description:
          "Driver Alex R. has been at receiver for 3.5 hours. Automated detention trigger.",
        priority: "High",
        status: "Pending",
        entityType: "LOAD",
        entityId: "L-1001",
        createdAt: new Date().toISOString(),
      },
      {
        id: "WI-5002",
        companyId: "iscope-authority-001",
        type: "Document_Issue",
        label: "Missing BOL: Load LP-9002",
        description:
          "Load delivered but no BOL artifact uploaded. SLA breach in 45m.",
        priority: "Critical",
        status: "Pending",
        entityType: "LOAD",
        entityId: "L-1002",
        createdAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem(
      STORAGE_KEY_WORK_ITEMS(),
      JSON.stringify(seedWorkItems),
    );
  }

  const finalWorkItems = workItems.filter((wi) => wi.status !== "Resolved");

  return {
    requests: requests.filter((r) =>
      ["NEW", "PENDING_APPROVAL"].includes(r.status),
    ),
    incidents: incidents.filter((i) => i.status !== "Closed"),
    tasks: tasks.filter((t) => t.status === "OPEN"),
    calls: (await getRawCalls()).filter(
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

// --- Centralized Directory & Tasks ---

export const getRawProviders = (): Provider[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PROVIDERS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveProvider = async (provider: Provider) => {
  const providers = getRawProviders();
  const idx = providers.findIndex((p) => p.id === provider.id);
  if (idx >= 0) providers[idx] = provider;
  else providers.unshift(provider);
  localStorage.setItem(STORAGE_KEY_PROVIDERS(), JSON.stringify(providers));
  return provider;
};

export const getRawContacts = (): Contact[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_CONTACTS());
    const parsed = data ? JSON.parse(data) : [];
    if (parsed.length === 0) {
      const seed: Contact[] = [
        {
          id: "c1",
          name: "John Dispatcher",
          title: "Senior Operator",
          phone: "555-0199",
          email: "john@asset.com",
          type: "Internal",
          preferredChannel: "Phone",
          normalizedPhone: "5550199",
        },
        {
          id: "c2",
          name: "Sarah Broker",
          title: "Agent",
          phone: "555-0288",
          email: "sarah@choptank.com",
          type: "Broker",
          preferredChannel: "SMS",
          normalizedPhone: "5550288",
        },
      ];
      localStorage.setItem(STORAGE_KEY_CONTACTS(), JSON.stringify(seed));
      return seed;
    }
    return parsed;
  } catch (e) {
    return [];
  }
};

export const getProviders = async (): Promise<Provider[]> => {
  const providers = getRawProviders();
  if (providers.length === 0) {
    const seed: Provider[] = [
      {
        id: "p1",
        name: "Titan Recovery Specialists",
        type: "Recovery",
        status: "Preferred",
        is247: true,
        coverage: { regions: ["Northeast", "Mid-Atlantic"] },
        capabilities: ["Heavy Tow", "Recovery", "Transload"],
        contacts: [
          {
            id: "pc1",
            name: "Mike Titan",
            phone: "800-555-9000",
            email: "mike@titan.com",
            type: "Provider",
            preferredChannel: "Phone",
          },
        ],
        afterHoursContacts: [],
      },
      {
        id: "p2",
        name: "Rapid Tire & Service",
        type: "Tire",
        status: "Approved",
        is247: true,
        coverage: { regions: ["National"] },
        capabilities: ["Tire", "Mobile Mechanic"],
        contacts: [
          {
            id: "pc2",
            name: "Dispatch",
            phone: "800-RAPID-NOW",
            email: "service@rapid.com",
            type: "Provider",
            preferredChannel: "Phone",
          },
        ],
        afterHoursContacts: [],
      },
    ];
    localStorage.setItem(STORAGE_KEY_PROVIDERS(), JSON.stringify(seed));
    return seed;
  }
  return providers;
};

export const getContacts = async (): Promise<Contact[]> => {
  return getRawContacts();
};

export const saveContact = async (contact: Contact) => {
  const contacts = getRawContacts();
  const idx = contacts.findIndex((c) => c.id === contact.id);
  if (idx >= 0) contacts[idx] = contact;
  else contacts.unshift(contact);
  localStorage.setItem(STORAGE_KEY_CONTACTS(), JSON.stringify(contacts));
  return contact;
};

export const getRawTasks = (): OperationalTask[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_TASKS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveTask = async (task: OperationalTask) => {
  const tasks = getRawTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) tasks[idx] = task;
  else tasks.unshift(task);
  localStorage.setItem(STORAGE_KEY_TASKS(), JSON.stringify(tasks));
  return task;
};

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
  await saveRequest(request);

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
  await saveTask(task);

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

export const getDirectory = async () => {
  return {
    providers: getRawProviders(),
    contacts: getRawContacts(),
  };
};

export const getRawWorkItems = (): WorkItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_WORK_ITEMS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const getWorkItems = async (companyId?: string): Promise<WorkItem[]> => {
  const items = getRawWorkItems();
  if (companyId) return items.filter((i) => i.companyId === companyId);
  return items;
};

export const saveWorkItem = async (item: WorkItem) => {
  const items = getRawWorkItems();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.unshift(item);
  localStorage.setItem(STORAGE_KEY_WORK_ITEMS(), JSON.stringify(items));
  return item;
};

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

export const getRawNotificationJobs = (): NotificationJob[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_NOTIFICATION_JOBS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveNotificationJob = async (job: NotificationJob) => {
  const jobs = getRawNotificationJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) jobs[idx] = job;
  else jobs.unshift(job);
  localStorage.setItem(STORAGE_KEY_NOTIFICATION_JOBS(), JSON.stringify(jobs));

  // Sync to API
  try {
    await fetch(`${API_URL}/notification-jobs`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(job),
    });
  } catch (e) {
    console.warn("[storageService] API fallback:", e);
  }

  return job;
};

// --- Vault / Depository System ---

export const getRawVaultDocs = (): VaultDoc[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_VAULT_DOCS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveVaultDoc = async (doc: VaultDoc) => {
  const docs = getRawVaultDocs();
  const idx = docs.findIndex((d) => d.id === doc.id);
  if (idx >= 0) docs[idx] = doc;
  else docs.unshift(doc);
  localStorage.setItem(STORAGE_KEY_VAULT_DOCS(), JSON.stringify(docs));
  return doc;
};

export const uploadVaultDoc = async (
  file: File,
  docType: VaultDocType,
  tenantId: string,
  metadata: any = {},
): Promise<VaultDoc> => {
  const id = uuidv4();
  const filename = `${id}_${file.name}`;
  const storageRef = ref(
    storage,
    `tenants/${tenantId}/docs/${docType}/${filename}`,
  );

  // Upload to Firebase Storage
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const doc: VaultDoc = {
    id,
    tenantId,
    type: docType,
    url,
    filename: file.name,
    mimeType: file.type,
    fileSize: file.size,
    status: "Submitted",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...metadata,
  };

  return await saveVaultDoc(doc);
};
