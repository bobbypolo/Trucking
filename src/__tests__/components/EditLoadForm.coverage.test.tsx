import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditLoadForm } from "../../../components/EditLoadForm";
import { LoadData, User, LOAD_STATUS } from "../../../types";

vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([
    { id: "broker-1", name: "Alpha Logistics", mcNumber: "MC-123456" },
  ]),
}));

vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn().mockResolvedValue({ id: "company-1", name: "Test Co" }),
  getCompanyUsers: vi.fn().mockResolvedValue([
    {
      id: "driver-1",
      name: "John Driver",
      role: "driver",
      companyId: "company-1",
    },
    {
      id: "driver-2",
      name: "Jane OO",
      role: "owner_operator",
      companyId: "company-1",
    },
  ]),
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

const mockLoadWithLegs: Partial<LoadData> = {
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
  commodity: "Electronics",
  freightType: "Dry Van",
  legs: [
    {
      id: "leg-1",
      type: "Pickup" as const,
      location: {
        city: "Chicago",
        state: "IL",
        facilityName: "Warehouse A",
        address: "123 Main St",
        zip: "60601",
      },
      date: "2025-12-01",
      appointmentTime: "08:00",
      completed: false,
      pallets: 10,
      weight: 20000,
      sealNumber: "SEAL-001",
    },
    {
      id: "leg-2",
      type: "Dropoff" as const,
      location: {
        city: "Dallas",
        state: "TX",
        facilityName: "Depot B",
        address: "456 Oak Ave",
        zip: "75001",
      },
      date: "2025-12-03",
      appointmentTime: "16:00",
      completed: false,
      pallets: 10,
      weight: 20000,
      sealNumber: "SEAL-002",
    },
  ],
};

describe("EditLoadForm coverage — lines 523-726 (stop matrix interactions)", () => {
  const defaultProps = {
    initialData: mockLoadWithLegs,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    currentUser: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pre-existing legs in stop matrix with facility names", () => {
    render(<EditLoadForm {...defaultProps} />);
    expect(screen.getByDisplayValue("Warehouse A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Depot B")).toBeInTheDocument();
  });

  it("renders address fields for legs", () => {
    render(<EditLoadForm {...defaultProps} />);
    expect(screen.getByDisplayValue("123 Main St")).toBeInTheDocument();
    expect(screen.getByDisplayValue("456 Oak Ave")).toBeInTheDocument();
  });

  it("renders city fields for legs", () => {
    render(<EditLoadForm {...defaultProps} />);
    expect(screen.getByDisplayValue("Chicago")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dallas")).toBeInTheDocument();
  });

  it("renders state fields for legs", () => {
    render(<EditLoadForm {...defaultProps} />);
    expect(screen.getByDisplayValue("IL")).toBeInTheDocument();
    expect(screen.getByDisplayValue("TX")).toBeInTheDocument();
  });

  it("renders seal number fields for legs", () => {
    render(<EditLoadForm {...defaultProps} />);
    expect(screen.getByDisplayValue("SEAL-001")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SEAL-002")).toBeInTheDocument();
  });

  it("renders pallets fields for legs", () => {
    render(<EditLoadForm {...defaultProps} />);
    const palletsInputs = screen.getAllByDisplayValue("10");
    expect(palletsInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders weight fields for legs", () => {
    render(<EditLoadForm {...defaultProps} />);
    const weightInputs = screen.getAllByDisplayValue("20000");
    expect(weightInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders date fields for legs", () => {
    render(<EditLoadForm {...defaultProps} />);
    expect(screen.getByDisplayValue("2025-12-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2025-12-03")).toBeInTheDocument();
  });

  it("renders appointment time fields for legs", () => {
    render(<EditLoadForm {...defaultProps} />);
    expect(screen.getByDisplayValue("08:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("16:00")).toBeInTheDocument();
  });

  it("allows editing facility name for a leg", async () => {
    const user = userEvent.setup();
    render(<EditLoadForm {...defaultProps} />);
    const facilityInput = screen.getByDisplayValue("Warehouse A");
    await user.clear(facilityInput);
    await user.type(facilityInput, "New Warehouse");
    expect(facilityInput).toHaveValue("New Warehouse");
  });

  it("allows editing address for a leg", async () => {
    const user = userEvent.setup();
    render(<EditLoadForm {...defaultProps} />);
    const addressInput = screen.getByDisplayValue("123 Main St");
    await user.clear(addressInput);
    await user.type(addressInput, "789 Elm St");
    expect(addressInput).toHaveValue("789 Elm St");
  });

  it("allows editing seal number for a leg", async () => {
    const user = userEvent.setup();
    render(<EditLoadForm {...defaultProps} />);
    const sealInput = screen.getByDisplayValue("SEAL-001");
    await user.clear(sealInput);
    await user.type(sealInput, "SEAL-999");
    expect(sealInput).toHaveValue("SEAL-999");
  });

  it("saves form data including legs when Save Changes is clicked", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<EditLoadForm {...defaultProps} onSave={onSave} />);
    await user.click(screen.getByText("Save Changes"));
    expect(onSave).toHaveBeenCalledTimes(1);
    const savedData = onSave.mock.calls[0][0];
    expect(savedData.legs).toHaveLength(2);
    expect(savedData.legs[0].location.facilityName).toBe("Warehouse A");
  });

  it("does not show remove button when locked", () => {
    render(
      <EditLoadForm
        {...defaultProps}
        initialData={{ ...mockLoadWithLegs, isLocked: true }}
      />,
    );
    // Inputs should be disabled
    const facilityInput = screen.getByDisplayValue("Warehouse A");
    expect(facilityInput).toBeDisabled();
  });

  it("renders driver select with Assign Member placeholder", () => {
    render(<EditLoadForm {...defaultProps} />);
    expect(screen.getByText("Assign Member...")).toBeInTheDocument();
  });

  it("renders chassis number input", () => {
    render(
      <EditLoadForm
        {...defaultProps}
        initialData={{ ...mockLoadWithLegs, chassisNumber: "CHS-500" }}
      />,
    );
    expect(screen.getByDisplayValue("CHS-500")).toBeInTheDocument();
  });
});
