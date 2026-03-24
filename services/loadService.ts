/**
 * Load API Service — dedicated frontend service for load CRUD operations.
 *
 * All load data flows through the backend API. companyId is derived
 * server-side from the authenticated user's tenant context — it is
 * NEVER passed in URL paths for operational routes.
 *
 * Replaces legacy browser-storage-based operations in storageService.ts.
 */
import { api } from "./api";
import { v4 as uuidv4 } from "uuid";
import { LoadData, User, LoadStatus } from "../types";

/** Map a backend load row to frontend LoadData shape. */
function mapRowToLoadData(row: any): LoadData {
  // Derive dropoffDate from the Dropoff leg when not explicitly on the row.
  // CalendarView uses pickupDate + dropoffDate to render multi-day spans.
  const pickupLeg = (row.legs || []).find((leg: any) => leg.type === "Pickup");
  const dropoffLeg = (row.legs || []).find(
    (leg: any) => leg.type === "Dropoff",
  );

  const pickupDate =
    row.pickup_date ||
    row.pickupDate ||
    pickupLeg?.date ||
    new Date().toISOString().split("T")[0];

  const dropoffDate =
    row.dropoff_date || row.dropoffDate || dropoffLeg?.date || undefined;

  return {
    id: row.id,
    companyId: row.company_id || row.companyId || "",
    driverId: row.driver_id || row.driverId || "",
    dispatcherId: row.dispatcher_id || row.dispatcherId,
    brokerId: row.customer_id || row.brokerId,
    loadNumber: row.load_number || row.loadNumber || "UNKNOWN",
    status: row.status || "draft",
    carrierRate: Number(row.carrier_rate ?? row.carrierRate) || 0,
    driverPay: Number(row.driver_pay ?? row.driverPay) || 0,
    pickupDate,
    dropoffDate,
    freightType: row.freight_type || row.freightType,
    commodity: row.commodity,
    weight: row.weight,
    containerNumber: row.container_number || row.containerNumber,
    containerSize: row.container_size || row.containerSize,
    chassisNumber: row.chassis_number || row.chassisNumber,
    chassisProvider: row.chassis_provider || row.chassisProvider,
    bolNumber: row.bol_number || row.bolNumber,
    notificationEmails:
      row.notificationEmails ||
      (row.notification_emails
        ? typeof row.notification_emails === "string"
          ? JSON.parse(row.notification_emails)
          : row.notification_emails
        : []),
    contractId: row.contract_id || row.contractId,
    legs: (row.legs || []).map((leg: any) => ({
      id: leg.id,
      type: leg.type,
      location: {
        city: leg.city || leg.location?.city || "",
        state: leg.state || leg.location?.state || "",
        facilityName:
          leg.facility_name ||
          leg.facilityName ||
          leg.location?.facilityName ||
          "",
      },
      date: leg.date || "",
      appointmentTime: leg.appointment_time || leg.appointmentTime || "",
      completed: leg.completed ?? false,
      completedAt: leg.completedAt || leg.completed_at,
    })),
    pickup: pickupLeg
      ? {
          city: pickupLeg.city || pickupLeg.location?.city || "",
          state: pickupLeg.state || pickupLeg.location?.state || "",
          facilityName:
            pickupLeg.facility_name ||
            pickupLeg.facilityName ||
            pickupLeg.location?.facilityName ||
            "",
        }
      : row.pickup || { city: "", state: "", facilityName: "" },
    dropoff: dropoffLeg
      ? {
          city: dropoffLeg.city || dropoffLeg.location?.city || "",
          state: dropoffLeg.state || dropoffLeg.location?.state || "",
          facilityName:
            dropoffLeg.facility_name ||
            dropoffLeg.facilityName ||
            dropoffLeg.location?.facilityName ||
            "",
        }
      : row.dropoff || { city: "", state: "", facilityName: "" },
    createdAt: row.created_at
      ? new Date(row.created_at).getTime()
      : row.createdAt,
    version: row.version || 1,
    customerUserId: row.customer_user_id || row.customerUserId,
  };
}

/** Map frontend LoadData to backend API payload. */
function mapLoadDataToPayload(load: LoadData): Record<string, unknown> {
  return {
    id: load.id,
    // company_id intentionally omitted — derived from auth context server-side
    customer_id: load.brokerId,
    driver_id: load.driverId,
    dispatcher_id: load.dispatcherId,
    load_number: load.loadNumber,
    status: load.status,
    carrier_rate: load.carrierRate,
    driver_pay: load.driverPay,
    pickup_date: load.pickupDate,
    freight_type: load.freightType,
    commodity: load.commodity,
    weight: load.weight,
    container_number: load.containerNumber,
    chassis_number: load.chassisNumber,
    bol_number: load.bolNumber,
    notification_emails: load.notificationEmails,
    contract_id: load.contractId,
    gpsHistory: [],
    podUrls: [],
    customerUserId: load.customerUserId,
    legs: (load.legs || []).map((leg, i) => ({
      id: leg.id,
      type: leg.type,
      facility_name: leg.location?.facilityName || "",
      city: leg.location?.city || "",
      state: leg.location?.state || "",
      date: leg.date,
      appointment_time: leg.appointmentTime || "",
      completed: leg.completed,
      sequence_order: i,
    })),
    issues: load.issues?.map((issue) => ({
      id: issue.id,
      category: issue.category,
      description: issue.description,
      status: issue.status,
    })),
  };
}

/**
 * Fetch all loads for the current user's company.
 * GET /api/loads — companyId derived from auth token server-side.
 */
export async function fetchLoads(): Promise<LoadData[]> {
  const rows = await api.get("/loads");
  return (rows as any[]).map(mapRowToLoadData);
}

/**
 * Create or update a load.
 * POST /api/loads — company_id derived from auth token server-side.
 */
export async function createLoad(load: LoadData): Promise<void> {
  const payload = mapLoadDataToPayload(load);
  await api.post("/loads", payload);
}

/**
 * Update load status.
 * PATCH /api/loads/:id/status
 */
export async function updateLoadStatusApi(
  loadId: string,
  status: LoadStatus,
  dispatcherId: string,
): Promise<void> {
  await api.patch(`/loads/${loadId}/status`, {
    status,
    dispatcher_id: dispatcherId,
  });
}

/**
 * Delete a load (soft-delete on backend).
 * DELETE /api/loads/:id — tenant isolation enforced server-side.
 */
export async function deleteLoadApi(loadId: string): Promise<void> {
  await api.delete(`/loads/${loadId}`);
}

/**
 * Search loads (client-side filter over API results).
 * Falls back to fetching all loads and filtering.
 */
export async function searchLoadsApi(query: string): Promise<LoadData[]> {
  const allLoads = await fetchLoads();
  if (!query) return allLoads.slice(0, 10);

  const q = query.toLowerCase();
  return allLoads.filter(
    (l) =>
      l.loadNumber.toLowerCase().includes(q) ||
      l.pickup.facilityName?.toLowerCase().includes(q) ||
      l.dropoff.facilityName?.toLowerCase().includes(q) ||
      l.pickup.city?.toLowerCase().includes(q) ||
      l.dropoff.city?.toLowerCase().includes(q),
  );
}

/**
 * Driver-first intake: create a load from driver-submitted data.
 * POST /api/loads with status="draft" and source="driver_intake".
 *
 * The created load will have pickup/dropoff dates and immediately appear
 * in schedule views (CalendarView) and the Load Board via the shared
 * backend truth — no synthetic local state needed.
 */
export async function createDriverIntake(intakeData: {
  pickup: {
    city?: string;
    state?: string;
    address?: string;
    facilityName?: string;
  };
  dropoff: {
    city?: string;
    state?: string;
    address?: string;
    facilityName?: string;
  };
  pickupDate?: string;
  dropoffDate?: string;
  commodity?: string;
  weight?: number;
  referenceNumbers?: string[];
  specialInstructions?: string;
  driverId: string;
  companyId: string;
  scannedDocUrls?: string[];
  source: "driver_intake";
}): Promise<LoadData> {
  const id = uuidv4();
  const loadNumber = `DI-${Date.now().toString(36).toUpperCase()}`;

  const legs: Record<string, unknown>[] = [];

  if (intakeData.pickup) {
    legs.push({
      id: uuidv4(),
      type: "Pickup",
      facility_name: intakeData.pickup.facilityName || "",
      city: intakeData.pickup.city || "",
      state: intakeData.pickup.state || "",
      date: intakeData.pickupDate || "",
      appointment_time: "",
      completed: false,
      sequence_order: 0,
    });
  }

  if (intakeData.dropoff) {
    legs.push({
      id: uuidv4(),
      type: "Dropoff",
      facility_name: intakeData.dropoff.facilityName || "",
      city: intakeData.dropoff.city || "",
      state: intakeData.dropoff.state || "",
      date: intakeData.dropoffDate || "",
      appointment_time: "",
      completed: false,
      sequence_order: 1,
    });
  }

  const payload = {
    id,
    load_number: loadNumber,
    status: "draft",
    driver_id: intakeData.driverId,
    pickup_date: intakeData.pickupDate || "",
    commodity: intakeData.commodity,
    weight: intakeData.weight,
    notification_emails: [],
    gpsHistory: [],
    podUrls: intakeData.scannedDocUrls || [],
    legs,
    // source stored as dispatcher_notes prefix until a dedicated column exists
    // broker (customer_id) intentionally omitted — driver intakes may not know the broker
  };

  const result = await api.post("/loads", payload);

  // Return the created load mapped to LoadData shape for immediate UI use
  return mapRowToLoadData({
    id,
    load_number: loadNumber,
    status: "draft",
    driver_id: intakeData.driverId,
    company_id: intakeData.companyId,
    pickup_date: intakeData.pickupDate || "",
    commodity: intakeData.commodity,
    weight: intakeData.weight,
    legs: legs.map((leg) => ({
      ...leg,
      facilityName: leg.facility_name,
    })),
    ...(result && typeof result === "object" ? result : {}),
  });
}

/**
 * Fetch loads for schedule rendering (CalendarView).
 *
 * Returns loads that have valid pickup/dropoff dates, filtered by an
 * optional date range. Uses the same backend endpoint with a query
 * parameter so results come from shared backend truth — not local state.
 *
 * GET /api/loads?for=schedule[&start=YYYY-MM-DD&end=YYYY-MM-DD]
 */
export async function fetchScheduleLoads(
  dateRange?: { start: string; end: string },
): Promise<LoadData[]> {
  let url = "/loads?for=schedule";
  if (dateRange) {
    url += `&start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}`;
  }
  const rows = await api.get(url);
  return (rows as any[]).map(mapRowToLoadData);
}
