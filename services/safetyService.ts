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
import { getLoads } from "./storageService";
import { getCompany, updateCompany, getAuthHeaders } from "./authService";

// ── Quizzes ────────────────────────────────────────────────────────────────

export const getStoredQuizzes = async (): Promise<SafetyQuiz[]> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/safety/quizzes`, { headers });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

export const saveQuiz = async (quiz: SafetyQuiz): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${API_URL}/safety/quizzes`, {
      method: "POST",
      headers,
      body: JSON.stringify(quiz),
    });
  } catch {
    // silently ignore
  }
};

// ── Quiz Results ──────────────────────────────────────────────────────────

export const getStoredResults = async (): Promise<QuizResult[]> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/safety/quiz-results`, { headers });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

export const saveQuizResult = async (result: QuizResult): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${API_URL}/safety/quiz-results`, {
      method: "POST",
      headers,
      body: JSON.stringify(result),
    });
  } catch {
    // silently ignore
  }
};

// ── Safety Activity ───────────────────────────────────────────────────────

export const getStoredSafetyActivity = async (): Promise<
  ActivityLogEntry[]
> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/safety/activity`, { headers });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

export const logSafetyActivity = async (
  message: string,
  type: "Status" | "Alert" | "Notification",
  user?: string,
): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${API_URL}/safety/activity`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: message, entity_type: type, actor: user }),
    });
  } catch {
    // silently ignore
  }
};

// ── Maintenance ───────────────────────────────────────────────────────────

export const getMaintenanceRecords = async (): Promise<MaintenanceRecord[]> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/safety/maintenance`, { headers });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

export const saveMaintenanceRecord = async (
  record: MaintenanceRecord,
): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${API_URL}/safety/maintenance`, {
      method: "POST",
      headers,
      body: JSON.stringify(record),
    });
  } catch {
    // silently ignore
  }
};

// ── Service Tickets ───────────────────────────────────────────────────────

export const getServiceTickets = async (): Promise<ServiceTicket[]> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/safety/service-tickets`, { headers });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

export const saveServiceTicket = async (
  ticket: ServiceTicket,
): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${API_URL}/safety/service-tickets`, {
      method: "POST",
      headers,
      body: JSON.stringify(ticket),
    });
  } catch {
    // silently ignore
  }
};

// ── Vendors ───────────────────────────────────────────────────────────────

export const getVendors = async (): Promise<Provider[]> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/safety/vendors`, { headers });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

export const saveVendor = async (vendor: Provider): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${API_URL}/safety/vendors`, {
      method: "POST",
      headers,
      body: JSON.stringify(vendor),
    });
  } catch {
    // silently ignore
  }
};

// ── Equipment ─────────────────────────────────────────────────────────────

export const getEquipment = async (
  companyId: string,
): Promise<FleetEquipment[]> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/equipment/${companyId}`, { headers });
    return await res.json();
  } catch {
    return [];
  }
};

export const getComplianceRecords = async (userId: string): Promise<any[]> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/compliance/${userId}`, { headers });
    return await res.json();
  } catch {
    return [];
  }
};

// ── Driver Logic ──────────────────────────────────────────────────────────

export const checkDriverCompliance = (
  user: User,
  quizzes: SafetyQuiz[] = [],
  results: QuizResult[] = [],
): { isCompliant: boolean; blockingReasons: string[]; safetyScore: number } => {
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

  const [quizzes, results] = await Promise.all([
    getStoredQuizzes(),
    getStoredResults(),
  ]);
  const compliance = checkDriverCompliance(user, quizzes, results);

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

export const getDriverQuizzes = async (driverId: string) => {
  const [quizzes, results] = await Promise.all([
    getStoredQuizzes(),
    getStoredResults(),
  ]);
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
  await logSafetyActivity(
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
