// Tests R-P4-05
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock authService
vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  getStoredUsers: vi.fn().mockReturnValue([]),
  getAuthHeaders: vi.fn().mockResolvedValue({}),
  getCurrentUser: vi.fn(),
}));

// Mock storageService to avoid circular dependency + heavy deps
vi.mock("../../../services/storageService", () => ({
  getLoads: vi.fn().mockResolvedValue([]),
  getTenantKey: vi.fn((baseName: string) => {
    // Mock implementation: returns tenant-scoped key
    const user = (
      getCurrentUser as unknown as () => { companyId?: string } | null
    )();
    if (!user?.companyId) return `loadpilot_${baseName}`;
    return `loadpilot_${user.companyId}_${baseName}`;
  }),
}));

vi.mock("../../../services/firebase", () => ({
  storage: {},
  DEMO_MODE: false,
}));

import {
  getStoredQuizzes,
  saveQuiz,
  getMaintenanceRecords,
  saveMaintenanceRecord,
} from "../../../services/safetyService";
import { getCurrentUser } from "../../../services/authService";

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

describe("safetyService — tenant-scoped keys (R-P4-05)", () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    localStorageMock = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => localStorageMock[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        localStorageMock[key] = value;
      },
    );
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(
      (key: string) => {
        delete localStorageMock[key];
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getStoredQuizzes returns empty array when no quizzes stored", () => {
    mockGetCurrentUser.mockReturnValue({ companyId: "safety-co" });
    const quizzes = getStoredQuizzes();
    expect(quizzes).toEqual([]);
  });

  it("saveQuiz stores quiz under tenant-scoped key", () => {
    mockGetCurrentUser.mockReturnValue({ companyId: "safety-co" });
    const quiz = {
      id: "quiz-1",
      title: "Test Quiz",
      description: "Test",
      isMandatory: true,
      assignedTo: ["all"],
      createdAt: new Date().toISOString(),
      questions: [],
    };
    saveQuiz(quiz);
    // The key should contain the companyId
    const tenantKey = Object.keys(localStorageMock).find((k) =>
      k.includes("safety-co"),
    );
    expect(tenantKey).toBeTruthy();
    const stored = JSON.parse(localStorageMock[tenantKey!]);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("quiz-1");
  });

  it("getMaintenanceRecords returns empty array when nothing stored", () => {
    mockGetCurrentUser.mockReturnValue({ companyId: "fleet-co" });
    const records = getMaintenanceRecords();
    expect(records).toEqual([]);
  });

  it("two tenants store quizzes independently", () => {
    // Tenant A saves a quiz
    mockGetCurrentUser.mockReturnValue({ companyId: "tenant-a" });
    saveQuiz({
      id: "quiz-a",
      title: "Quiz A",
      description: "A",
      isMandatory: false,
      assignedTo: [],
      createdAt: new Date().toISOString(),
      questions: [],
    });

    // Tenant B saves a different quiz
    mockGetCurrentUser.mockReturnValue({ companyId: "tenant-b" });
    saveQuiz({
      id: "quiz-b",
      title: "Quiz B",
      description: "B",
      isMandatory: false,
      assignedTo: [],
      createdAt: new Date().toISOString(),
      questions: [],
    });

    // Tenant A keys and tenant B keys should be separate
    const keysA = Object.keys(localStorageMock).filter((k) =>
      k.includes("tenant-a"),
    );
    const keysB = Object.keys(localStorageMock).filter((k) =>
      k.includes("tenant-b"),
    );
    expect(keysA.length).toBeGreaterThan(0);
    expect(keysB.length).toBeGreaterThan(0);
    expect(keysA[0]).not.toBe(keysB[0]);
  });
});
