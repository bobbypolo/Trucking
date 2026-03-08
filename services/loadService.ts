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
import { LoadData, User, LoadStatus } from "../types";

/** Map a backend load row to frontend LoadData shape. */
function mapRowToLoadData(row: any): LoadData {
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
    pickupDate:
      row.pickup_date ||
      row.pickupDate ||
      new Date().toISOString().split("T")[0],
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
    pickup: row.legs?.find((leg: any) => leg.type === "Pickup")
      ? {
          city: row.legs.find((leg: any) => leg.type === "Pickup").city || "",
          state: row.legs.find((leg: any) => leg.type === "Pickup").state || "",
          facilityName:
            row.legs.find((leg: any) => leg.type === "Pickup").facility_name ||
            row.legs.find((leg: any) => leg.type === "Pickup").facilityName ||
            "",
        }
      : row.pickup || { city: "", state: "", facilityName: "" },
    dropoff: row.legs?.find((leg: any) => leg.type === "Dropoff")
      ? {
          city: row.legs.find((leg: any) => leg.type === "Dropoff").city || "",
          state:
            row.legs.find((leg: any) => leg.type === "Dropoff").state || "",
          facilityName:
            row.legs.find((leg: any) => leg.type === "Dropoff").facility_name ||
            row.legs.find((leg: any) => leg.type === "Dropoff").facilityName ||
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
