/**
 * Tests R-P10-04, R-P10-05, R-P10-06:
 * AnalyticsDashboard quarterly objectives enhancement
 *
 *  - R-P10-04: renders a quarter selector with 4 options (Q1-Q4)
 *              that filters displayed lane data by pickupDate quarter
 *  - R-P10-05: displays "Actual vs Target" progress bars when >= 1
 *              financial objective exists for the selected quarter
 *  - R-P10-06: shows a "Set quarterly targets" prompt when 0 objectives
 *              exist for the selected quarter
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnalyticsDashboard } from "../../../components/AnalyticsDashboard";
import { LoadData, User, LOAD_STATUS } from "../../../types";

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

function makeLoad(
  id: string,
  carrierRate: number,
  miles: number,
  pickupDate: string,
  driverPay = 0,
  pickupCity = "Chicago",
  dropoffCity = "Dallas",
): LoadData {
  return {
    id,
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: `LN-${id}`,
    status: LOAD_STATUS.Delivered,
    carrierRate,
    driverPay,
    miles,
    pickupDate,
    pickup: { city: pickupCity, state: "IL" },
    dropoff: { city: dropoffCity, state: "TX" },
  };
}

// Loads spanning 2026 Q1, Q2, and Q3 so we can verify the selector filters
const Q1_LOAD = makeLoad("l-q1", 2000, 500, "2026-02-15");
const Q2_LOAD = makeLoad(
  "l-q2",
  3000,
  1000,
  "2026-05-15",
  0,
  "Houston",
  "Atlanta",
);
const Q3_LOAD = makeLoad(
  "l-q3",
  1500,
  400,
  "2026-08-15",
  0,
  "Denver",
  "Phoenix",
);
const ALL_LOADS = [Q1_LOAD, Q2_LOAD, Q3_LOAD];

const MOCK_OBJECTIVE_Q2 = {
  id: "obj-q2-1",
  company_id: "company-1",
  quarter: "2026-Q2",
  revenue_target: 10000,
  expense_budget: 6000,
  profit_target: 4000,
  notes: null,
  created_at: "2026-04-11T00:00:00.000Z",
  updated_at: "2026-04-11T00:00:00.000Z",
};

function mockFetch(
  responseByQuarter: Record<string, unknown[]>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : String(input);
    const match = url.match(/quarter=([^&]+)/);
    const qKey = match ? decodeURIComponent(match[1]) : "";
    const body = responseByQuarter[qKey] ?? [];
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => body,
    } as unknown as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AnalyticsDashboard quarterly enhancement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── R-P10-04 ─────────────────────────────────────────────────────
  it("Tests R-P10-04 — renders quarter-selector with Q1-Q4 options", async () => {
    mockFetch({});
    render(
      <AnalyticsDashboard user={mockUser} loads={ALL_LOADS} brokers={[]} />,
    );

    const selector = await screen.findByTestId("quarter-selector");
    expect(selector).toBeTruthy();

    const options = selector.querySelectorAll("option");
    // Expect exactly 4 options: Q1, Q2, Q3, Q4
    expect(options.length).toBe(4);
    const values = Array.from(options, (o) => o.getAttribute("value"));
    expect(values).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  });

  // Tests R-P10-04 — quarter change filters lane data
  it("Tests R-P10-04 — changing quarter filters lane data by pickupDate", async () => {
    mockFetch({});
    render(
      <AnalyticsDashboard user={mockUser} loads={ALL_LOADS} brokers={[]} />,
    );

    const selector = (await screen.findByTestId(
      "quarter-selector",
    )) as HTMLSelectElement;

    // Default quarter is Q1 (for this test's determinism, we select it explicitly)
    fireEvent.change(selector, { target: { value: "Q1" } });
    await waitFor(() => {
      // Q1_LOAD → Chicago, IL → Dallas, TX should be visible
      expect(screen.getByText(/Chicago.*Dallas/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Houston.*Atlanta/i)).toBeNull();

    // Switch to Q2 — only Houston → Atlanta lane should render
    fireEvent.change(selector, { target: { value: "Q2" } });
    await waitFor(() => {
      expect(screen.getByText(/Houston.*Atlanta/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Chicago.*Dallas/i)).toBeNull();
  });

  // ── R-P10-05 ─────────────────────────────────────────────────────
  it("Tests R-P10-05 — displays 'Actual vs Target' progress bars when objectives exist", async () => {
    mockFetch({ "2026-Q2": [MOCK_OBJECTIVE_Q2] });

    render(
      <AnalyticsDashboard user={mockUser} loads={ALL_LOADS} brokers={[]} />,
    );

    const selector = (await screen.findByTestId(
      "quarter-selector",
    )) as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: "Q2" } });

    const actualVsTarget = await screen.findByTestId("actual-vs-target");
    expect(actualVsTarget).toBeTruthy();
    expect(actualVsTarget.textContent).toMatch(/Actual vs Target/i);
    // Should mention Revenue (R-P10-05 blueprint)
    expect(actualVsTarget.textContent).toMatch(/Revenue/i);

    // Should have at least 1 progress-bar element
    const bars = actualVsTarget.querySelectorAll(
      '[data-testid^="progress-bar-"]',
    );
    expect(bars.length).toBeGreaterThanOrEqual(1);

    // Prompt should NOT be displayed when objectives exist
    expect(screen.queryByTestId("set-quarterly-targets")).toBeNull();
  });

  // ── R-P10-06 ─────────────────────────────────────────────────────
  it("Tests R-P10-06 — shows 'Set quarterly targets' prompt when 0 objectives", async () => {
    mockFetch({ "2026-Q3": [] });

    render(
      <AnalyticsDashboard user={mockUser} loads={ALL_LOADS} brokers={[]} />,
    );

    const selector = (await screen.findByTestId(
      "quarter-selector",
    )) as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: "Q3" } });

    const prompt = await screen.findByTestId("set-quarterly-targets");
    expect(prompt).toBeTruthy();
    expect(prompt.textContent).toMatch(/Set quarterly targets/i);

    // The Actual-vs-Target panel must NOT be displayed when 0 objectives
    expect(screen.queryByTestId("actual-vs-target")).toBeNull();
  });

  // ── R-P10-04 guard — empty loads still renders empty-state (no selector) ──
  it("Tests R-P10-04 — empty loads array renders no-data state (no selector needed)", () => {
    mockFetch({});
    render(<AnalyticsDashboard user={mockUser} loads={[]} brokers={[]} />);
    // Empty state (pre-existing behavior) takes precedence
    expect(screen.queryByTestId("quarter-selector")).toBeNull();
  });
});
