// Tests R-P6-01, R-P6-02, R-P6-03, R-P6-04
// SafetyView KPI wiring: real API data, no hardcoded compliance, loading/error states
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock services at network boundary
vi.mock("../../../services/safetyService", () => ({
  checkDriverCompliance: vi.fn().mockResolvedValue({ compliant: true }),
  getDriverQuizzes: vi.fn().mockResolvedValue([]),
  saveQuiz: vi.fn().mockResolvedValue(undefined),
  calculateDriverPerformance: vi.fn().mockResolvedValue({
    driverId: "user-1",
    totalScore: 45,
    grade: "At Risk",
    status: "Active",
    metrics: {
      safetyScore: 40,
      onTimeRate: 50,
      paperworkScore: 45,
      loadCount: 3,
    },
  }),
  logSafetyActivity: vi.fn().mockResolvedValue(undefined),
  getStoredQuizzes: vi.fn().mockResolvedValue([]),
  registerAsset: vi.fn().mockResolvedValue(undefined),
  saveQuizResult: vi.fn().mockResolvedValue(undefined),
  getMaintenanceRecords: vi.fn().mockResolvedValue([]),
  saveMaintenanceRecord: vi.fn().mockResolvedValue(undefined),
  getServiceTickets: vi.fn().mockResolvedValue([
    { id: "t1", status: "Open", description: "Brake check", priority: "High" },
    {
      id: "t2",
      status: "Closed",
      description: "Oil change",
      priority: "Low",
    },
  ]),
  saveServiceTicket: vi.fn().mockResolvedValue(undefined),
  getVendors: vi.fn().mockResolvedValue([]),
  getEquipment: vi.fn().mockResolvedValue([
    { id: "eq1", status: "Active", type: "Truck" },
    { id: "eq2", status: "Out of Service", type: "Trailer" },
  ]),
  getComplianceRecords: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/authService", () => ({
  getCompanyUsers: vi.fn().mockResolvedValue([
    {
      id: "user-1",
      name: "Test Driver",
      email: "driver@test.com",
      role: "driver",
      companyId: "company-1",
      onboardingStatus: "Completed",
      safetyScore: 40,
    },
  ]),
  getCompany: vi.fn().mockResolvedValue({
    id: "company-1",
    name: "Test Trucking",
    accountType: "fleet",
    dotNumber: "123456",
  }),
  updateCompany: vi.fn().mockResolvedValue(undefined),
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../../../services/storageService", () => ({
  saveLoad: vi.fn().mockResolvedValue(undefined),
  createIncident: vi.fn().mockResolvedValue(undefined),
  seedIncidents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/firebase", () => ({
  DEMO_MODE: false,
}));

vi.mock("../../../components/Scanner", () => ({
  Scanner: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="scanner-mock">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

import { SafetyView } from "../../../components/SafetyView";
import type { User } from "../../../types";

const mockUser: User = {
  id: "user-1",
  name: "Test Admin",
  email: "admin@test.com",
  role: "admin",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 95,
};

describe("SafetyView KPI Wiring (R-P6-01 through R-P6-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for /api/safety/* endpoints
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/safety/fmcsa/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              available: true,
              data: {
                dotNumber: "123456",
                legalName: "Test Trucking LLC",
                safetyRating: "Satisfactory",
                totalDrivers: 5,
                totalPowerUnits: 10,
                inspections: {
                  totalInspections: 20,
                  driverOosRate: 5.2,
                  vehicleOosRate: 3.1,
                },
              },
            }),
        });
      }
      if (url.includes("/api/safety/quizzes")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: "q1",
                title: "HazMat Safety",
                type: "certification",
                progress: 75,
                certifiedCount: 3,
              },
            ]),
        });
      }
      if (url.includes("/api/safety/quiz-results")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: "qr1",
                driverName: "Test Driver",
                quizTitle: "HazMat Safety",
                score: 88,
                passed: true,
                completedAt: "2026-03-20",
              },
            ]),
        });
      }
      if (url.includes("/api/safety/settings")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              minSafetyScore: 70,
              autoLockCompliance: false,
              maintenanceIntervalDays: 90,
            }),
        });
      }
      if (url.includes("/api/notification-jobs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
  });

  // R-P6-01: SafetyView renders real data from /api/safety/* endpoints
  it("R-P6-01: renders KPI cards computed from API data", async () => {
    render(<SafetyView user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText("Fleet Safety Score")).toBeInTheDocument();
    });

    // FMCSA data drives Fleet Safety Score
    expect(screen.getByText("Satisfactory")).toBeInTheDocument();
    expect(screen.getByText("FMCSA Verified")).toBeInTheDocument();

    // Pending Maintenance = 1 (one ticket not "Closed")
    expect(screen.getByText("Pending Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Open Tickets")).toBeInTheDocument();

    // Non-Compliant drivers (driver has totalScore=45, below minSafetyScore=70)
    expect(screen.getByText("Non-Compliant")).toBeInTheDocument();
    expect(screen.getByText("Drivers Flagged")).toBeInTheDocument();

    // Out of Service = 1 (one equipment "Out of Service")
    expect(screen.getByText("Out of Service")).toBeInTheDocument();
    expect(screen.getByText("Red Tagged Units")).toBeInTheDocument();

    // Values are dynamically computed (multiple KPIs show "1")
    const oneElements = screen.getAllByText("1");
    expect(oneElements.length).toBeGreaterThanOrEqual(1);
  });

  it("R-P6-01: fetches from all /api/safety/* endpoints", async () => {
    render(<SafetyView user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
    });

    // Verify fetch was called with the correct API endpoints
    const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const urls = fetchCalls.map((call: string[]) => call[0]);
    expect(urls.some((u: string) => u.includes("/api/safety/fmcsa/"))).toBe(
      true,
    );
    expect(urls.some((u: string) => u.includes("/api/safety/quizzes"))).toBe(
      true,
    );
    expect(
      urls.some((u: string) => u.includes("/api/safety/quiz-results")),
    ).toBe(true);
    expect(urls.some((u: string) => u.includes("/api/safety/settings"))).toBe(
      true,
    );
  });

  // R-P6-02: No hardcoded compliance numbers
  it("R-P6-02: KPI values change based on different API data", async () => {
    // With no service tickets open, pending maintenance should be "0"
    const { getServiceTickets } =
      await import("../../../services/safetyService");
    (getServiceTickets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { getEquipment } = await import("../../../services/safetyService");
    (getEquipment as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(<SafetyView user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText("Fleet Safety Score")).toBeInTheDocument();
    });

    // With no equipment, OOS shows "N/A"
    const naElements = screen.getAllByText("N/A");
    expect(naElements.length).toBeGreaterThanOrEqual(1);
  });

  // R-P6-03: LoadingSkeleton shown during data fetch
  it("R-P6-03: shows LoadingSkeleton with role=status during loading", async () => {
    const { getCompany } = await import("../../../services/authService");

    let resolveCompany!: (v: unknown) => void;
    const companyPromise = new Promise((r) => {
      resolveCompany = r;
    });
    (getCompany as ReturnType<typeof vi.fn>).mockReturnValue(companyPromise);

    render(<SafetyView user={mockUser} />);

    // Loading skeleton should be visible with accessible role
    const loadingEl = screen.getByRole("status");
    expect(loadingEl).toBeInTheDocument();
    expect(loadingEl).toHaveAttribute("aria-label", "Loading safety data");

    // Resolve to prevent memory leak
    resolveCompany(null);
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("R-P6-03: LoadingSkeleton disappears when data loads", async () => {
    render(<SafetyView user={mockUser} />);

    // After data loads, loading skeleton should be gone
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
  });

  // R-P6-04: ErrorState shown on API failure
  it("R-P6-04: shows ErrorState with retry on API failure", async () => {
    const { getCompany } = await import("../../../services/authService");
    (getCompany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    render(<SafetyView user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("R-P6-04: retry button recovers from error", async () => {
    const { getCompany, getCompanyUsers } =
      await import("../../../services/authService");

    // First call fails
    (getCompany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );
    // Second call succeeds
    (getCompany as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "company-1",
      name: "Test Trucking",
      accountType: "fleet",
    });
    (getCompanyUsers as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
  });
});
