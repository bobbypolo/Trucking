/**
 * Sales-Demo Regression Guard — SafetyView with zero operators
 *
 * Context: A prior build hardcoded "13 Non-Compliant Drivers" in the
 * Non-Compliant KPI tile even when no operators were loaded. This regression
 * was fixed in commit de188a8 (feat(S-6.1): wire SafetyView KPIs to real API
 * data). This test locks the fix in place so it cannot regress before the
 * sales demo.
 *
 * Strategy: Render SafetyView with an empty company-users list (forcing
 * `operators` state to []) and assert the substring "13" does not appear
 * anywhere in the rendered DOM.
 *
 * Tests R-P5-01
 */

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SafetyView } from "../../../components/SafetyView";
import type { User } from "../../../types";

// Network-boundary stubs — operators come from authService.getCompanyUsers
vi.mock("../../../services/safetyService", () => ({
  checkDriverCompliance: vi.fn().mockResolvedValue({ compliant: true }),
  getDriverQuizzes: vi.fn().mockResolvedValue([]),
  saveQuiz: vi.fn().mockResolvedValue(undefined),
  calculateDriverPerformance: vi.fn().mockResolvedValue({
    driverId: "unused",
    totalScore: 85,
    grade: "Standard",
    status: "Ready",
    metrics: {
      safetyScore: 90,
      onTimeRate: 80,
      paperworkScore: 75,
      loadCount: 0,
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

// CRITICAL: zero operators on the company — this is the fixture under test
vi.mock("../../../services/authService", () => ({
  getCompanyUsers: vi.fn().mockResolvedValue([]),
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

describe("SafetyView regression guard — empty operators (R-P5-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render the substring '13' anywhere in the DOM when operators is empty", async () => {
    // Tests R-P5-01: locks the 'SafetyView hardcoded 13 Non-Compliant Drivers'
    //                regression fix from commit de188a8.
    const { container } = render(<SafetyView user={mockAdmin} />);

    // Wait for the KPI grid to appear (proves loadPayload resolved with zero
    // operators and the Non-Compliant tile rendered its empty-state branch).
    await waitFor(() => {
      expect(container.textContent).toContain("Non-Compliant");
    });

    const renderedText = container.textContent ?? "";

    // Hard assertion: the forbidden hardcoded number must not be anywhere
    // in the rendered DOM.
    expect(renderedText).not.toContain("13");

    // Defensive belt-and-suspenders: the Non-Compliant tile specifically must
    // show the empty-state value "N/A" (not "13", not "0"), because the
    // current code branches on `operators.length > 0` and the mocked users
    // list is empty.
    expect(renderedText).toContain("N/A");
  });
});
