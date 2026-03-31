// Tests R-P3-04, R-P3-05, R-P3-06, R-P3-07, R-P3-08, R-P3-11
import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import * as fs from "fs";
import * as path from "path";

// Mock authService at the module level
vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn().mockResolvedValue({
    id: "co-1",
    name: "Test Trucking",
    dotNumber: "12345",
    mcNumber: "67890",
  }),
  updateCompany: vi.fn().mockResolvedValue(undefined),
  getCompanyUsers: vi.fn().mockResolvedValue([
    {
      id: "user-1",
      companyId: "co-1",
      email: "alice@example.com",
      name: "Alice Driver",
      role: "driver",
      onboardingStatus: "Completed",
      safetyScore: 90,
      payModel: "percent",
      payRate: 25,
    },
    {
      id: "user-2",
      companyId: "co-1",
      email: "bob@example.com",
      name: "Bob Dispatcher",
      role: "admin",
      onboardingStatus: "Completed",
      safetyScore: 85,
      payModel: "hourly",
      payRate: 35,
    },
  ]),
  updateUser: vi.fn().mockResolvedValue(undefined),
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-admin",
    companyId: "co-1",
    email: "admin@example.com",
    name: "Admin",
    role: "admin",
    onboardingStatus: "Completed",
    safetyScore: 100,
  }),
  checkCapability: vi.fn().mockReturnValue(true),
  CAPABILITY_PRESETS: {},
}));

// Mock storageService
vi.mock("../../../services/storageService", () => ({
  logTime: vi.fn(),
  getTimeLogs: vi.fn().mockResolvedValue([]),
}));

// Mock api
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { accessorial_rates: [] } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock useAutoFeedback — returns [value, setter, clearer]
vi.mock("../../../hooks/useAutoFeedback", () => ({
  useAutoFeedback: vi.fn().mockReturnValue(["", vi.fn(), vi.fn()]),
}));

import { CompanyProfile } from "../../../components/CompanyProfile";
import { updateUser, getCompanyUsers } from "../../../services/authService";
import type { User } from "../../../types";

const adminUser: User = {
  id: "user-admin",
  companyId: "co-1",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
} as User;

// Source-level jargon check (legacy tests preserved)
const source = fs.readFileSync(
  path.resolve("components/CompanyProfile.tsx"),
  "utf-8",
);

describe("CompanyProfile.tsx jargon removal (R-P1-04)", () => {
  const bannedTerms = [
    "Authority DNA",
    "Logic Seed",
    "Identity Matrix",
    "Duty Cockpit",
    "Global Authority Profile",
    "Synchronize Matrix",
    "Terminate Duty Cycle",
    "Cargo Unit Telemetry",
    "Active Duty Engine",
    "Terminal Nodes",
    "Authority Structure",
    "Load Numbering Matrix",
    "Access Decision Matrix",
    "Acknowledge Exit",
    "Duty Cycle Terminated",
    "Legal Entity Entity",
    "Establishing Authority Connection",
    "Personnel Registry",
    "Hierarchy Permissions",
    "Compliance Governance",
    "Financial Protocols",
    "Secure File Download",
    "Authority Global State Synchronized",
    "Initial Duty Acknowledge",
    "Finalizing Cargo",
    "Operational DNA",
    "Authority ID",
  ];

  for (const term of bannedTerms) {
    it(`does not contain "${term}"`, () => {
      expect(source).not.toContain(term);
    });
  }
});

describe("CompanyProfile registry tab inline quick-edit", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
  });

  async function renderAndNavigateToRegistry() {
    const result = render(
      <CompanyProfile
        user={adminUser}
        onUserRegistryChange={() => {}}
      />,
    );
    // Wait for data to load (loadingState transitions from "loading" to "ready")
    await waitFor(() => {
      expect(screen.getByText("Personnel")).toBeInTheDocument();
    });
    // Navigate to registry (Personnel) tab
    const personnelTab = screen.getByText("Personnel");
    await user.click(personnelTab);
    // Wait for registry to render with user rows
    await waitFor(() => {
      expect(screen.getByText("Alice Driver")).toBeInTheDocument();
    });
    return result;
  }

  // Tests R-P3-04 — renders 1 <select> with aria-label containing "role" per user row
  it("renders 1 role <select> per user row with aria-label containing 'role'", async () => {
    await renderAndNavigateToRegistry();
    const roleSelects = screen.getAllByLabelText(/role/i);
    // 2 users = 2 role selects
    expect(roleSelects.length).toBe(2);
    // Verify they are <select> elements
    for (const el of roleSelects) {
      expect(el.tagName).toBe("SELECT");
    }
  });

  // Tests R-P3-05 — changing role select to "dispatcher" calls updateUser
  it("changing role select to 'dispatcher' calls updateUser with { role: 'dispatcher' }", async () => {
    await renderAndNavigateToRegistry();
    const roleSelects = screen.getAllByLabelText(/role/i);
    // Alice is first user, currently "driver"
    fireEvent.change(roleSelects[0], { target: { value: "dispatcher" } });
    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: "dispatcher" }),
      );
    });
  });

  // Tests R-P3-06 — renders 1 <input type="number"> with aria-label containing "pay rate" per user row
  it("renders 1 pay rate <input type='number'> per user row with aria-label containing 'pay rate'", async () => {
    await renderAndNavigateToRegistry();
    const payInputs = screen.getAllByLabelText(/pay rate/i);
    // 2 users = 2 pay rate inputs
    expect(payInputs.length).toBe(2);
    for (const el of payInputs) {
      expect(el).toHaveAttribute("type", "number");
    }
  });

  // Tests R-P3-07 — blurring payRate input with value 50 calls updateUser
  it("blurring payRate input with value 50 calls updateUser with { payRate: 50 }", async () => {
    await renderAndNavigateToRegistry();
    const payInputs = screen.getAllByLabelText(/pay rate/i);
    // Clear and set value to 50, then blur
    fireEvent.change(payInputs[0], { target: { value: "50" } });
    fireEvent.blur(payInputs[0]);
    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        expect.objectContaining({ payRate: 50 }),
      );
    });
  });

  // Tests R-P3-08 — clicking ChevronRight details button renders UserProfilePanel
  it("clicking Details button renders UserProfilePanel with Identity tab", async () => {
    await renderAndNavigateToRegistry();
    const detailsBtns = screen.getAllByLabelText(/details for/i);
    expect(detailsBtns.length).toBe(2);
    await user.click(detailsBtns[0]);
    // UserProfilePanel slide-out now renders alongside CompanyProfile tabs.
    // CompanyProfile has its own "Identity" tab, so after opening the slide-out
    // there should be 2 "Identity" elements: one from CompanyProfile nav + one from UserProfilePanel.
    await waitFor(() => {
      const identityElements = screen.getAllByText("Identity");
      expect(identityElements.length).toBe(2);
    });
    // Also confirm the slide-out panel shows user header alongside the row
    const aliceElements = screen.getAllByText("Alice Driver");
    // 1 in the registry row + 1 in the slide-out header = 2
    expect(aliceElements.length).toBe(2);
  });

  // Tests R-P3-11 — entering payRate -1 does NOT trigger updateUser
  it("entering payRate value -1 does NOT trigger updateUser (invalid input rejected)", async () => {
    await renderAndNavigateToRegistry();
    vi.mocked(updateUser).mockClear();
    const payInputs = screen.getAllByLabelText(/pay rate/i);
    fireEvent.change(payInputs[0], { target: { value: "-1" } });
    fireEvent.blur(payInputs[0]);
    // Give it a tick to ensure no async call happens
    await new Promise((r) => setTimeout(r, 50));
    expect(updateUser).not.toHaveBeenCalled();
  });

  // Negative test: empty pay rate does not trigger update
  it("empty payRate input on blur does NOT trigger updateUser", async () => {
    await renderAndNavigateToRegistry();
    vi.mocked(updateUser).mockClear();
    const payInputs = screen.getAllByLabelText(/pay rate/i);
    fireEvent.change(payInputs[0], { target: { value: "" } });
    fireEvent.blur(payInputs[0]);
    await new Promise((r) => setTimeout(r, 50));
    expect(updateUser).not.toHaveBeenCalled();
  });
});
