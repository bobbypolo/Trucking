// Tests R-P2-02, R-P2-04
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  getServiceTickets: vi.fn().mockResolvedValue([]),
  saveServiceTicket: vi.fn().mockResolvedValue(undefined),
  getVendors: vi.fn().mockResolvedValue([]),
  getEquipment: vi.fn().mockResolvedValue([]),
  getComplianceRecords: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/authService", () => ({
  getCompanyUsers: vi.fn(),
  getCompany: vi.fn(),
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

describe("SafetyView — Loading and Error States (R-P2-02, R-P2-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // R-P2-02: SafetyView shows LoadingSkeleton during initial fetch
  it("R-P2-02: shows LoadingSkeleton (aria-busy) while data is loading", async () => {
    const { getCompany } = await import("../../../services/authService");

    let resolveCompany!: (v: any) => void;
    const companyPromise = new Promise<any>((r) => {
      resolveCompany = r;
    });

    (getCompany as ReturnType<typeof vi.fn>).mockReturnValue(companyPromise);

    render(<SafetyView user={mockUser} />);

    // During loading, the skeleton should be present
    expect(screen.getByRole("status")).toBeInTheDocument();

    // Resolve to avoid memory leaks
    resolveCompany(null);
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("R-P2-02: LoadingSkeleton disappears after data loads", async () => {
    const { getCompany, getCompanyUsers } = await import(
      "../../../services/authService"
    );

    (getCompany as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "company-1",
      name: "Test Trucking",
      accountType: "fleet",
    });

    (getCompanyUsers as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(<SafetyView user={mockUser} />);

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    // Normal UI should be visible after loading
    expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
  });

  // R-P2-04: API errors in SafetyView show ErrorState with retry button
  it("R-P2-04: shows ErrorState with retry button when API fails", async () => {
    const { getCompany } = await import("../../../services/authService");

    (getCompany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    render(<SafetyView user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /retry/i }),
    ).toBeInTheDocument();
  });

  it("R-P2-04: ErrorState retry button re-fetches data", async () => {
    const { getCompany, getCompanyUsers } = await import(
      "../../../services/authService"
    );

    (getCompany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );

    // Second attempt succeeds
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

    // Normal content should be visible after successful retry
    expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
  });

  it("R-P2-04: ErrorState is displayed (not the feedback toast) when getCompany rejects", async () => {
    const { getCompany } = await import("../../../services/authService");

    (getCompany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    render(<SafetyView user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // The ErrorState component renders role="alert" with a retry button
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
  });
});
