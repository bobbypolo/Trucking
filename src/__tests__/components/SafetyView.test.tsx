import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SafetyView } from "../../../components/SafetyView";
import type { User } from "../../../types";

// Stub services at network boundary
vi.mock("../../../services/safetyService", () => ({
  checkDriverCompliance: vi.fn().mockResolvedValue({ compliant: true }),
  getDriverQuizzes: vi.fn().mockResolvedValue([]),
  saveQuiz: vi.fn().mockResolvedValue(undefined),
  calculateDriverPerformance: vi.fn().mockResolvedValue({
    driverId: "user-1",
    totalScore: 85,
    grade: "Solid",
    status: "Active",
    metrics: {
      safetyScore: 90,
      onTimeRate: 80,
      paperworkScore: 75,
      loadCount: 10,
    },
  }),
  logSafetyActivity: vi.fn().mockResolvedValue(undefined),
  getStoredQuizzes: vi.fn().mockResolvedValue([]),
  registerAsset: vi.fn().mockResolvedValue(undefined),
  saveQuizResult: vi.fn().mockResolvedValue(undefined),
  getMaintenanceRecords: vi.fn().mockResolvedValue([]),
  saveMaintenanceRecord: vi.fn().mockResolvedValue(undefined),
  getServiceTickets: vi.fn().mockReturnValue([]),
  saveServiceTicket: vi.fn().mockResolvedValue(undefined),
  getVendors: vi.fn().mockReturnValue([]),
  getEquipment: vi.fn().mockResolvedValue([]),
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
      safetyScore: 90,
    },
    {
      id: "user-2",
      name: "Test Admin",
      email: "admin@test.com",
      role: "admin",
      companyId: "company-1",
      onboardingStatus: "Completed",
      safetyScore: 95,
    },
  ]),
  getCompany: vi.fn().mockResolvedValue({
    id: "company-1",
    name: "Test Trucking",
    accountType: "fleet",
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

const mockUser: User = {
  id: "user-1",
  name: "Test Admin",
  email: "admin@test.com",
  role: "admin",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 95,
};

describe("SafetyView component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Existing tests (overview, header, nav) ---

  it("renders the Safety & Compliance header", async () => {
    render(<SafetyView user={mockUser} />);
    expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
  });

  it("renders the overview tab navigation", async () => {
    render(<SafetyView user={mockUser} />);
    expect(screen.getByText("Monitor")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("Service")).toBeInTheDocument();
    expect(screen.getByText("Academy")).toBeInTheDocument();
    expect(screen.getByText("Rules")).toBeInTheDocument();
  });

  it("shows the overview KPI cards on initial render", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Fleet Safety Score")).toBeInTheDocument();
    });
    expect(screen.getByText("Pending Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Non-Compliant")).toBeInTheDocument();
    expect(screen.getByText("Out of Service")).toBeInTheDocument();
  });

  it("shows Fleet Health Status bars on overview tab", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Quiz Completion")).toBeInTheDocument();
    });
    expect(screen.getByText("Vehicle Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Incident Free Days")).toBeInTheDocument();
  });

  it("shows Fleet Chain of Custody section on overview tab", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText(/Fleet Chain of Custody/)).toBeInTheDocument();
    });
  });

  it("shows 'No active incidents' when no incidents provided", async () => {
    render(<SafetyView user={mockUser} incidents={[]} />);
    await waitFor(() => {
      expect(screen.getByText("No active incidents")).toBeInTheDocument();
    });
  });

  it("renders incidents when provided", async () => {
    const incidents = [
      {
        id: "inc-1",
        type: "Breakdown",
        severity: "Critical",
        timeline: [
          {
            actorName: "Driver A",
            timestamp: "2026-03-15T10:00:00Z",
            action: "Reported breakdown",
            notes: "Engine stalled on highway",
          },
        ],
      },
    ];
    render(<SafetyView user={mockUser} incidents={incidents} />);
    await waitFor(() => {
      expect(screen.getByText("Reported breakdown")).toBeInTheDocument();
    });
    expect(screen.getByText(/Driver A/)).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("switches to Roster tab when clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      // Roster tab should show operator cards after loading
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
  });

  it("renders operator cards on roster tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    expect(screen.getByText("Test Admin")).toBeInTheDocument();
  });

  it("switches to Assets tab when clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Assets"));
    // Assets tab should be visible (equipment section)
    await waitFor(() => {
      expect(screen.queryByText("Fleet Safety Score")).not.toBeInTheDocument();
    });
  });

  it("switches to Service tab when clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(screen.queryByText("Fleet Safety Score")).not.toBeInTheDocument();
    });
  });

  it("shows Logic Plane synchronized indicator", async () => {
    render(<SafetyView user={mockUser} />);
    expect(screen.getByText("Logic Plane: Synchronized")).toBeInTheDocument();
  });

  it("shows Global Fleet Governance Matrix subtitle", async () => {
    render(<SafetyView user={mockUser} />);
    expect(
      screen.getByText("Global Fleet Governance Matrix"),
    ).toBeInTheDocument();
  });

  it("shows feedback message when data loading fails", async () => {
    const { getCompany } = await import("../../../services/authService");
    (getCompany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText(/Logic Sync Interrupted/)).toBeInTheDocument();
    });
  });

  it("dismisses feedback message when X is clicked", async () => {
    const user = userEvent.setup();
    const { getCompany } = await import("../../../services/authService");
    (getCompany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText(/Logic Sync Interrupted/)).toBeInTheDocument();
    });
    const feedbackText = screen.getByText(/Logic Sync Interrupted/);
    const feedbackContainer = feedbackText.closest('[class*="fixed"]');
    expect(feedbackContainer).not.toBeNull();
    const closeBtn = feedbackContainer!.querySelector("button");
    expect(closeBtn).not.toBeNull();
    await user.click(closeBtn!);
    await waitFor(() => {
      expect(
        screen.queryByText(/Logic Sync Interrupted/),
      ).not.toBeInTheDocument();
    });
  });
});
