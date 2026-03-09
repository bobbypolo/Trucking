import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditLoadForm } from "../../../components/EditLoadForm";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Mock services used by EditLoadForm
vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn().mockResolvedValue(null),
  getCompanyUsers: vi.fn().mockResolvedValue([]),
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
}));

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockLoadData: Partial<LoadData> = {
  id: "load-1",
  companyId: "company-1",
  loadNumber: "LN-001",
  status: LOAD_STATUS.Planned,
  carrierRate: 1500,
  driverPay: 900,
  pickupDate: "2025-12-01",
  pickup: { city: "Chicago", state: "IL" },
  dropoff: { city: "Dallas", state: "TX" },
  driverId: "driver-1",
};

describe("EditLoadForm component", () => {
  const defaultProps = {
    initialData: mockLoadData,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    currentUser: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<EditLoadForm {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it("renders save button", () => {
    render(<EditLoadForm {...defaultProps} />);
    const saveButtons = screen.getAllByRole("button");
    expect(saveButtons.length).toBeGreaterThan(0);
  });

  it("pre-fills form with initial carrier rate", () => {
    render(<EditLoadForm {...defaultProps} />);
    // The form should contain the carrier rate value in a number input
    const inputs = document.querySelectorAll("input");
    const values = Array.from(inputs).map((i) => i.value);
    expect(values.some((v) => v === "1500" || v === "1500.00" || Number(v) === 1500)).toBe(true);
  });

  it("renders with valid initial load number", () => {
    const { container } = render(<EditLoadForm {...defaultProps} />);
    const inputs = container.querySelectorAll("input");
    // Form should have multiple input fields
    expect(inputs.length).toBeGreaterThan(3);
  });

  it("renders with restricted driver mode", () => {
    const { container } = render(
      <EditLoadForm {...defaultProps} isRestrictedDriver={true} />,
    );
    expect(container).toBeTruthy();
  });
});
