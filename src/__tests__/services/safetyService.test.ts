// Tests R-P1-16, R-P1-17, R-P1-18, R-P1-19, R-P1-20, R-P4-05
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock authService
vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  getStoredUsers: vi.fn().mockReturnValue([]),
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
  getCurrentUser: vi.fn(),
}));

// Mock storageService
vi.mock("../../../services/storageService", () => ({
  getLoads: vi.fn().mockResolvedValue([]),
  getTenantKey: vi.fn((baseName: string) => `loadpilot_${baseName}`),
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

describe("safetyService — API-based functions (R-P1-16 through R-P1-20, R-P4-05)", () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReturnValue({ companyId: "safety-co" });
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getStoredQuizzes returns empty array when API returns empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as any);

    const quizzes = await getStoredQuizzes();
    expect(quizzes).toEqual([]);
  });

  it("getStoredQuizzes fetches from /api/safety/quizzes", async () => {
    const mockQuiz = {
      id: "quiz-1",
      title: "Test Quiz",
      description: "Test",
      isMandatory: true,
      assignedTo: ["all"],
      createdAt: new Date().toISOString(),
      questions: [],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockQuiz]),
    } as any);

    const quizzes = await getStoredQuizzes();
    expect(quizzes).toHaveLength(1);
    expect(quizzes[0].id).toBe("quiz-1");

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(fetchCall[0]).toContain("/safety/quizzes");
  });

  it("saveQuiz POSTs to /api/safety/quizzes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "quiz-1" }),
    } as any);

    const quiz = {
      id: "quiz-1",
      title: "Test Quiz",
      description: "Test",
      isMandatory: true,
      assignedTo: ["all"],
      createdAt: new Date().toISOString(),
      questions: [],
    };
    await saveQuiz(quiz);

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(fetchCall[0]).toContain("/safety/quizzes");
    expect(fetchCall[1].method).toBe("POST");
  });

  it("getMaintenanceRecords returns empty array when API returns empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as any);

    const records = await getMaintenanceRecords();
    expect(records).toEqual([]);
  });

  it("saveMaintenanceRecord POSTs to /api/safety/maintenance", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "mr-1" }),
    } as any);

    await saveMaintenanceRecord({ id: "mr-1" } as any);

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(fetchCall[0]).toContain("/safety/maintenance");
    expect(fetchCall[1].method).toBe("POST");
  });
});
