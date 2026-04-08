/**
 * Sales-Demo Regression Guard — SafetyView with 5 compliant operators
 *
 * Context: Same regression as R-P5-01 (hardcoded "13 Non-Compliant Drivers").
 * With a non-empty operator list where every driver is compliant, the
 * Non-Compliant KPI tile must show value "0" and the caption "All Clear"
 * (green state, no flagged drivers). This locks the live-data path.
 *
 * Tests R-P5-02
 */

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SafetyView } from "../../../components/SafetyView";
import type { User } from "../../../types";

// 5 compliant operators — each with a Standard grade and a totalScore above
// the 70 default safety threshold, so the Non-Compliant filter returns zero.
// Declared via vi.hoisted so the vi.mock factory (hoisted to top of file by
// vitest) can safely reference the data.
const { compliantDrivers } = vi.hoisted(() => {
  const drivers: User[] = Array.from({ length: 5 }, (_, i) => ({
    id: `driver-${i + 1}`,
    name: `Compliant Driver ${i + 1}`,
    email: `driver${i + 1}@sales-demo.test`,
    role: "driver",
    companyId: "sales-demo-co",
    onboardingStatus: "Completed",
    safetyScore: 90,
  }));
  return { compliantDrivers: drivers };
});

vi.mock("../../../services/safetyService", () => ({
  checkDriverCompliance: vi.fn().mockResolvedValue({ compliant: true }),
  getDriverQuizzes: vi.fn().mockResolvedValue([]),
  saveQuiz: vi.fn().mockResolvedValue(undefined),
  calculateDriverPerformance: vi
    .fn()
    // Every driver is Standard grade with score 85 → passes the
    // `grade !== "At Risk"` filter AND the `totalScore >= 70` threshold.
    .mockImplementation((u: User) =>
      Promise.resolve({
        driverId: u.id,
        totalScore: 85,
        grade: "Standard",
        status: "Ready",
        metrics: {
          safetyScore: 90,
          onTimeRate: 90,
          paperworkScore: 85,
          loadCount: 4,
        },
      }),
    ),
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
  getCompanyUsers: vi.fn().mockResolvedValue(compliantDrivers),
  getCompany: vi.fn().mockResolvedValue({
    id: "sales-demo-co",
    name: "Sales Demo Trucking",
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

vi.mock("../../../services/firebase", () => ({ DEMO_MODE: false }));

vi.mock("../../../components/Scanner", () => ({
  Scanner: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="scanner-mock">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

const mockAdmin: User = {
  id: "sales-demo-admin",
  name: "Sales Demo Admin",
  email: "admin@sales-demo.test",
  role: "admin",
  companyId: "sales-demo-co",
  onboardingStatus: "Completed",
  safetyScore: 95,
};

describe("SafetyView regression guard — 5 compliant operators (R-P5-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders '0' and 'All Clear' in the Non-Compliant tile when all 5 operators are compliant", async () => {
    // Tests R-P5-02: locks the 'SafetyView Non-Compliant tile displays real
    // zero-count when no drivers are flagged' behaviour from commit de188a8.
    render(<SafetyView user={mockAdmin} />);

    // Wait for the KPI grid to appear (proves loadPayload resolved with all
    // 5 operators enriched via calculateDriverPerformance).
    await waitFor(() => {
      expect(screen.getByText("Non-Compliant")).toBeInTheDocument();
    });

    // Wait for the live-data branch to commit — the "All Clear" caption only
    // renders when operators.length > 0 AND nonCompliantCount === 0.
    await waitFor(() => {
      expect(screen.getByText("All Clear")).toBeInTheDocument();
    });

    // Locate the Non-Compliant tile by walking up to the nearest parent that
    // contains both the label and the KPI value. The label div is a small
    // child of the tile root; the value "0" and caption "All Clear" live as
    // sibling children of the same tile root (see SafetyView.tsx KPI block
    // around line 486). Walk upward until we find an ancestor that also
    // contains "All Clear".
    const nonCompliantLabel = screen.getByText("Non-Compliant");
    let tile: HTMLElement | null = nonCompliantLabel.parentElement;
    while (tile && !tile.textContent?.includes("All Clear")) {
      tile = tile.parentElement;
    }
    expect(tile).not.toBeNull();
    const scoped = within(tile as HTMLElement);
    expect(scoped.getByText("0")).toBeInTheDocument();
    expect(scoped.getByText("All Clear")).toBeInTheDocument();
  });
});
