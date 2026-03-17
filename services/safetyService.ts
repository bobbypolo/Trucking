import { API_URL } from "./config";
import {
  SafetyQuiz,
  QuizResult,
  MaintenanceRecord,
  User,
  LoadData,
  DriverPerformance,
  Company,
  FleetEquipment,
  ActivityLogEntry,
  ServiceTicket,
  Provider,
} from "../types";
import { v4 as uuidv4 } from "uuid";
import { getLoads, getTenantKey } from "./storageService";
import { getCompany, updateCompany, updateUser } from "./authService";

// Tenant-scoped key accessors (F-008 fix) — replaces static string constants
const QUIZZES_KEY = (): string => getTenantKey("quizzes_v1");
const QUIZ_RESULTS_KEY = (): string => getTenantKey("quiz_results_v1");
const MAINTENANCE_KEY = (): string => getTenantKey("maintenance_v2");
const TICKETS_KEY = (): string => getTenantKey("service_tickets_v1");
const VENDORS_KEY = (): string => getTenantKey("vendors_v1");
const SAFETY_ACTIVITY_KEY = (): string => getTenantKey("safety_activity_v1");

const safeParse = <T>(key: string, fallback: T): T => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    return JSON.parse(data);
  } catch (e) {
    return fallback;
  }
};

export const getStoredQuizzes = (): SafetyQuiz[] =>
  safeParse(QUIZZES_KEY(), []);
export const getStoredResults = (): QuizResult[] =>
  safeParse(QUIZ_RESULTS_KEY(), []);
export const getStoredSafetyActivity = (): ActivityLogEntry[] =>
  safeParse(SAFETY_ACTIVITY_KEY(), []);
export const getMaintenanceRecords = (): MaintenanceRecord[] =>
  safeParse(MAINTENANCE_KEY(), []);
export const getServiceTickets = (): ServiceTicket[] =>
  safeParse(TICKETS_KEY(), []);
export const getVendors = (): Provider[] => safeParse(VENDORS_KEY(), []);

export const getEquipment = async (
  companyId: string,
): Promise<FleetEquipment[]> => {
  try {
    const res = await fetch(`${API_URL}/equipment/${companyId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    return await res.json();
  } catch (e) {
    return [];
  }
};

export const getComplianceRecords = async (userId: string): Promise<any[]> => {
  try {
    const res = await fetch(`${API_URL}/compliance/${userId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    return await res.json();
  } catch (e) {
    return [];
  }
};

export const saveMaintenanceRecord = (record: MaintenanceRecord) => {
  const list = getMaintenanceRecords();
  list.unshift(record);
  localStorage.setItem(MAINTENANCE_KEY(), JSON.stringify(list));
};

export const saveServiceTicket = (ticket: ServiceTicket) => {
  const list = getServiceTickets();
  const idx = list.findIndex((t) => t.id === ticket.id);
  if (idx >= 0) list[idx] = ticket;
  else list.unshift(ticket);
  localStorage.setItem(TICKETS_KEY(), JSON.stringify(list));
};

export const saveVendor = (vendor: Provider) => {
  const list = getVendors();
  const idx = list.findIndex((v) => v.id === vendor.id);
  if (idx >= 0) list[idx] = vendor;
  else list.push(vendor);
  localStorage.setItem(VENDORS_KEY(), JSON.stringify(list));
};

export const logSafetyActivity = (
  message: string,
  type: "Status" | "Alert" | "Notification",
  user?: string,
) => {
  const logs = getStoredSafetyActivity();
  logs.unshift({
    id: uuidv4(),
    type,
    message,
    timestamp: new Date().toISOString(),
    user,
  });
  localStorage.setItem(
    SAFETY_ACTIVITY_KEY(),
    JSON.stringify(logs.slice(0, 50)),
  );
};

export const saveQuiz = (quiz: SafetyQuiz) => {
  const list = getStoredQuizzes();
  const idx = list.findIndex((q) => q.id === quiz.id);
  if (idx >= 0) list[idx] = quiz;
  else list.push(quiz);
  localStorage.setItem(QUIZZES_KEY(), JSON.stringify(list));
};

export const saveQuizResult = (result: QuizResult) => {
  const list = getStoredResults();
  list.push(result);
  localStorage.setItem(QUIZ_RESULTS_KEY(), JSON.stringify(list));
};

export const checkDriverCompliance = (
  user: User,
): { isCompliant: boolean; blockingReasons: string[]; safetyScore: number } => {
  const quizzes = getStoredQuizzes();
  const results = getStoredResults();
  const blockingReasons: string[] = [];
  let score = user.safetyScore || 100;

  // 1. Mandatory Quizzes
  const assignedMandatory = quizzes.filter(
    (q) =>
      q.isMandatory &&
      (q.assignedTo.includes("all") || q.assignedTo.includes(user.id)),
  );
  assignedMandatory.forEach((quiz) => {
    const hasPassed = results.some(
      (r) => r.quizId === quiz.id && r.driverId === user.id && r.passed,
    );
    if (!hasPassed) {
      blockingReasons.push(`Training: ${quiz.title} Required`);
      score -= 10;
    }
  });

  // 2. Compliance Checklist (Docs)
  if (user.complianceChecklist) {
    user.complianceChecklist.forEach((rec) => {
      if (
        rec.isMandatory &&
        (rec.status === "Expired" || rec.status === "Failed")
      ) {
        blockingReasons.push(`Compliance: ${rec.type} ${rec.status}`);
        score -= 15;
      }
    });
  }

  // 3. License check
  if (user.restricted) {
    blockingReasons.push(user.restrictionReason || "Administrative Lockout");
    score = Math.min(score, 50);
  }

  return {
    isCompliant: blockingReasons.length === 0,
    blockingReasons,
    safetyScore: Math.max(0, score),
  };
};

export const calculateDriverPerformance = async (
  user: User,
  company?: Company,
): Promise<DriverPerformance> => {
  const targetCompany = company || (await getCompany(user.companyId));
  const config = targetCompany?.scoringConfig || {
    minimumDispatchScore: 75,
    weights: { safety: 0.5, onTime: 0.3, paperwork: 0.2 },
  };
  const compliance = checkDriverCompliance(user);

  const allLoads = (await getLoads(user)) as LoadData[];
  const driverLoads = allLoads.filter(
    (l) =>
      l.driverId === user.id &&
      (l.status === "delivered" || l.financialStatus === "Invoiced"),
  );

  let onTimeLoads = 0;
  let paperWorkCompleteLoads = 0;

  driverLoads.forEach((load) => {
    const isLate = load.issues?.some(
      (i) =>
        i.category === "Dispatch" &&
        i.description.toLowerCase().includes("late"),
    );
    if (!isLate) onTimeLoads++;
    if (load.bolNumber || load.bolUrls?.length) paperWorkCompleteLoads++;
  });

  const loadCount = driverLoads.length;
  const onTimeRate = loadCount > 0 ? (onTimeLoads / loadCount) * 100 : 100;
  const paperworkScore =
    loadCount > 0 ? (paperWorkCompleteLoads / loadCount) * 100 : 100;
  const safetyScore = compliance.safetyScore;

  const totalScore = Math.round(
    safetyScore * config.weights.safety +
      onTimeRate * config.weights.onTime +
      paperworkScore * config.weights.paperwork,
  );

  return {
    driverId: user.id,
    totalScore,
    grade:
      totalScore >= 90
        ? "Elite"
        : totalScore < config.minimumDispatchScore
          ? "At Risk"
          : "Standard",
    status: totalScore < config.minimumDispatchScore ? "Blocked" : "Ready",
    metrics: { safetyScore, onTimeRate, paperworkScore, loadCount },
  };
};

export const getDriverQuizzes = (driverId: string) => {
  const quizzes = getStoredQuizzes();
  const results = getStoredResults();
  return quizzes
    .filter(
      (q) => q.assignedTo.includes("all") || q.assignedTo.includes(driverId),
    )
    .map((q) => {
      const result = results.find(
        (r) => r.quizId === q.id && r.driverId === driverId,
      );
      return {
        ...q,
        status: result ? (result.passed ? "Passed" : "Failed") : "Pending",
        score: result?.score,
        completedAt: result?.completedAt,
      };
    });
};

export const registerAsset = async (
  companyId: string,
  asset: FleetEquipment,
  user: User,
) => {
  const company = await getCompany(companyId);
  if (!company) return;
  const updatedCompany = {
    ...company,
    equipmentRegistry: [
      ...(company.equipmentRegistry || []),
      {
        ...asset,
        addedBy: user.name,
        addedAt: new Date().toISOString(),
      },
    ],
  };
  await updateCompany(updatedCompany);
  logSafetyActivity(
    `New Asset Registered: ${asset.id} (${asset.type})`,
    "Notification",
    user.name,
  );
};

export const updateEquipmentStatus = (
  company: Company,
  id: string,
  type: "Truck" | "Trailer" | "Chassis" | "Container",
  status: "Active" | "Out of Service" | "Removed",
  user: User,
  notes: string,
  location: string,
) => {
  const registry = company.equipmentRegistry || [];
  const eqIdx = registry.findIndex((e) => e.id === id);
  if (eqIdx >= 0) {
    registry[eqIdx] = { ...registry[eqIdx], status, location };
  } else {
    registry.push({
      id,
      type,
      status,
      location,
      ownershipType: "Company Owned",
      providerName: "Internal",
      dailyCost: 0,
      addedBy: user.name,
      addedAt: new Date().toISOString(),
    });
  }
  updateCompany({ ...company, equipmentRegistry: registry });
};

/**
 * @deprecated No-op. Seed data removed — safety module starts empty until
 * real vendors, quizzes, and tickets are created by users.
 */
export const seedSafetyData = (_force = false) => {
  // Intentionally empty — no seed data should be injected.
};
