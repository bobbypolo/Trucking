// Tests R-P1-16, R-P1-17, R-P1-18, R-P1-19, R-P1-20, R-P4-05
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the api module
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("../../../services/api", () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}));

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
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("getStoredQuizzes returns empty array when API returns empty", async () => {
    mockGet.mockResolvedValue([]);

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
    mockGet.mockResolvedValue([mockQuiz]);

    const quizzes = await getStoredQuizzes();
    expect(quizzes).toHaveLength(1);
    expect(quizzes[0].id).toBe("quiz-1");

    expect(mockGet).toHaveBeenCalledWith("/safety/quizzes");
  });

  it("saveQuiz POSTs to /api/safety/quizzes", async () => {
    mockPost.mockResolvedValue({ id: "quiz-1" });

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

    expect(mockPost).toHaveBeenCalledWith("/safety/quizzes", quiz);
  });

  it("getMaintenanceRecords returns empty array when API returns empty", async () => {
    mockGet.mockResolvedValue([]);

    const records = await getMaintenanceRecords();
    expect(records).toEqual([]);
  });

  it("saveMaintenanceRecord POSTs to /api/safety/maintenance", async () => {
    mockPost.mockResolvedValue({ id: "mr-1" });

    await saveMaintenanceRecord({ id: "mr-1" } as any);

    expect(mockPost).toHaveBeenCalledWith(
      "/safety/maintenance",
      expect.objectContaining({ id: "mr-1" }),
    );
  });
});
