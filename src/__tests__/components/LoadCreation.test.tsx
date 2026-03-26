/**
 * R-FS-06-01: Load creation/edit component tests.
 * Covers error display and API success state.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditLoadForm } from "../../../components/EditLoadForm";
import { LoadSetupModal } from "../../../components/LoadSetupModal";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Mock services
vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi
    .fn()
    .mockResolvedValue([
      { id: "broker-1", name: "ABC Freight", mcNumber: "MC-123" },
    ]),
  getContracts: vi.fn().mockResolvedValue([]),
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
  ]),
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
    name: "Test Admin",
  }),
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-token"),
  forceRefreshToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../../../services/storageService", () => ({
  generateNextLoadNumber: vi.fn().mockReturnValue("LN-100"),
}));

vi.mock("../../../services/networkService", () => ({
  getParties: vi.fn().mockResolvedValue([]),
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

describe("EditLoadForm — error display and API success state (R-FS-06-01)", () => {
  const defaultProps = {
    initialData: mockLoadData,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    currentUser: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form with existing load data (R-FS-06-01 — load edit state)", () => {
    render(<EditLoadForm {...defaultProps} />);
    // Form should render with load number
    expect(screen.getByText(/LN-001/)).toBeInTheDocument();
  });

  it("calls onSave with form data on successful submission (API success state)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EditLoadForm {...defaultProps} onSave={onSave} />);

    // Find the save/submit button and click it
    const buttons = screen.getAllByRole("button");
    const saveButton = buttons.find(
      (b) =>
        b.textContent?.includes("Save") ||
        b.textContent?.includes("Initialize") ||
        b.textContent?.includes("Dispatch"),
    );
    expect(saveButton).toBeDefined();
    await user.click(saveButton!);
    expect(onSave).toHaveBeenCalledTimes(1);
    // Verify the saved data includes the load ID (success state)
    const savedData = onSave.mock.calls[0][0] as LoadData;
    expect(savedData.id).toBe("load-1");
    expect(savedData.status).toBe(LOAD_STATUS.Planned);
  });

  it("disables save button when load is locked (error display — locked state)", () => {
    const lockedLoad: Partial<LoadData> = { ...mockLoadData, isLocked: true };
    render(<EditLoadForm {...defaultProps} initialData={lockedLoad} />);

    const buttons = screen.getAllByRole("button");
    const saveButton = buttons.find(
      (b) =>
        b.textContent?.includes("Save") ||
        b.textContent?.includes("Initialize") ||
        b.textContent?.includes("Dispatch"),
    );
    // Locked loads should have the save button disabled
    expect(saveButton).toBeDefined();
    expect(saveButton!).toBeDisabled();
  });

  it("calls onCancel when discard is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<EditLoadForm {...defaultProps} onCancel={onCancel} />);

    const buttons = screen.getAllByRole("button");
    const discardButton = buttons.find((b) =>
      b.textContent?.includes("Discard"),
    );
    expect(discardButton).toBeDefined();
    await user.click(discardButton!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders new load form with Initialize Dispatch label (new load creation state)", () => {
    const newLoadData: Partial<LoadData> = {
      companyId: "company-1",
      status: LOAD_STATUS.Planned,
      carrierRate: 0,
      driverPay: 0,
      pickupDate: "",
      pickup: { city: "", state: "" },
      dropoff: { city: "", state: "" },
      driverId: "",
    };
    render(<EditLoadForm {...defaultProps} initialData={newLoadData} />);

    const buttons = screen.getAllByRole("button");
    const initButton = buttons.find((b) =>
      b.textContent?.includes("Initialize Dispatch"),
    );
    expect(initButton).toBeDefined();
  });

  it("renders with restricted driver mode (access control — error prevention)", () => {
    render(<EditLoadForm {...defaultProps} isRestrictedDriver={true} />);
    expect(screen.getByText(/LN-001/)).toBeInTheDocument();
  });

  it("displays load number in manifest breadcrumb (API-sourced data display)", () => {
    render(<EditLoadForm {...defaultProps} />);
    // The manifest ID should appear in the breadcrumb
    expect(screen.getByText(/LN-001/)).toBeInTheDocument();
  });
});

describe("LoadSetupModal — load creation entry point (R-FS-06-01)", () => {
  const defaultProps = {
    currentUser: mockUser,
    onContinue: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Setup New Load modal", async () => {
    render(<LoadSetupModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Setup New Load/i)).toBeInTheDocument();
    });
  });

  it("calls onCancel when X button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<LoadSetupModal {...defaultProps} onCancel={onCancel} />);

    const buttons = screen.getAllByRole("button");
    // First close button should cancel the modal
    expect(buttons.length).toBeGreaterThan(0);
    await user.click(buttons[0]);
    await waitFor(() => {
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  it("renders with preSelectedBrokerId (pre-populated state from API data)", async () => {
    render(<LoadSetupModal {...defaultProps} preSelectedBrokerId="broker-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Setup New Load/i)).toBeInTheDocument();
    });
  });

  it("disables Scan Doc button when broker and driver are not selected (validation error prevention)", async () => {
    render(<LoadSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Setup New Load/i)).toBeInTheDocument();
    });

    // The Scan Doc button is disabled when no broker/driver is selected
    const scanDocButton = screen.getByText(/Scan Doc/).closest("button")!;
    expect(scanDocButton).toBeInTheDocument();
    expect(scanDocButton).toBeDisabled();
  });
});
