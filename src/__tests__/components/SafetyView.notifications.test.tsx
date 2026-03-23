import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SafetyView } from "../../../components/SafetyView";
import type { User } from "../../../types";

// Stub services at network boundary — match existing SafetyView.test.tsx pattern
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

const mockUser: User = {
  id: "user-1",
  name: "Test Admin",
  email: "admin@test.com",
  role: "admin",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 95,
};

const mockNotificationJobs = [
  {
    id: "job-1",
    message: "CDL expiring for driver-1",
    channel: "email",
    status: "SENT",
    sent_at: "2026-03-20T12:00:00Z",
    sync_error: false,
  },
  {
    id: "job-2",
    message: "HazMat expired for driver-3",
    channel: "email",
    status: "FAILED",
    sent_at: "2026-03-20T11:00:00Z",
    sync_error: "SMTP not configured",
  },
  {
    id: "job-3",
    message: "Medical card reminder",
    channel: "email",
    status: "PENDING",
    sent_at: "2026-03-20T10:00:00Z",
    sync_error: false,
  },
];

describe("SafetyView — Notification Integration", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation((url: RequestInfo | URL) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/safety/fmcsa/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ available: false, reason: "fmcsa_unavailable" }),
        } as Response);
      }
      if (urlStr.includes("/api/safety/expiring-certs")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                driverId: "driver-1",
                certType: "CDL",
                expiryDate: "2026-03-25",
                daysRemaining: 4,
              },
            ]),
        } as Response);
      }
      if (urlStr.includes("/api/notification-jobs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockNotificationJobs),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
      } as Response);
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("renders cert expiry section in overview tab after loading", async () => {
    render(<SafetyView user={mockUser} />);

    // Wait for component to finish loading (same pattern as existing SafetyView.test.tsx)
    await waitFor(() => {
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
    });

    // Cert expiry component should be present (either warnings or empty)
    await waitFor(() => {
      const warnings = document.querySelector(
        '[data-testid="cert-expiry-warnings"], [data-testid="cert-expiry-empty"]',
      );
      expect(warnings).not.toBeNull();
    });
  });

  it("renders notification jobs with all three status badges", async () => {
    render(<SafetyView user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
    });

    // Wait for notification jobs section to appear
    await waitFor(() => {
      expect(
        screen.getByTestId("notification-jobs-section"),
      ).toBeInTheDocument();
    });

    // All 3 status badges should be present
    expect(screen.getByTestId("notification-badge-SENT")).toBeInTheDocument();
    expect(
      screen.getByTestId("notification-badge-FAILED"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("notification-badge-PENDING"),
    ).toBeInTheDocument();
  });

  it("shows sync_error text on FAILED notification badges", async () => {
    render(<SafetyView user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("notification-jobs-section"),
      ).toBeInTheDocument();
    });

    const failedBadge = screen.getByTestId("notification-badge-FAILED");
    expect(failedBadge.textContent).toContain("SMTP not configured");
  });

  it("displays notification job messages and count", async () => {
    render(<SafetyView user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("notification-jobs-section"),
      ).toBeInTheDocument();
    });

    // Job messages should be visible
    expect(
      screen.getByText("CDL expiring for driver-1"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("HazMat expired for driver-3"),
    ).toBeInTheDocument();
    expect(screen.getByText("Medical card reminder")).toBeInTheDocument();

    // Count badge
    const items = screen.getAllByTestId("notification-job-item");
    expect(items.length).toBe(3);
  });
});
