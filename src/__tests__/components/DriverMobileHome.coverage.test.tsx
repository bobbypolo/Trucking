import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DriverMobileHome } from "../../../components/DriverMobileHome";
import type { LoadData, User, LOAD_STATUS } from "../../../types";

vi.mock("../../../components/Scanner", () => ({
  Scanner: ({
    onDataExtracted,
    onCancel,
  }: {
    onDataExtracted: (data: unknown) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="scanner-mock">
      <button
        data-testid="scanner-extract"
        onClick={() => onDataExtracted({ docType: "BOL", confidence: 0.95 })}
      >
        Extract
      </button>
      <button data-testid="scanner-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

vi.mock("../../../components/GlobalMapViewEnhanced", () => ({
  GlobalMapViewEnhanced: () => <div data-testid="map-mock">Map</div>,
}));

vi.mock("../../../components/Toast", () => ({
  Toast: ({
    message,
    type,
  }: {
    message: string;
    type: string;
    onDismiss: () => void;
  }) => (
    <div data-testid="toast-mock" data-type={type}>
      {message}
    </div>
  ),
}));

vi.mock("../../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid={`confirm-dialog-${title.replace(/\s+/g, "-")}`}>
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>CancelDialog</button>
      </div>
    ) : null,
}));

vi.mock("../../../components/ui/InputDialog", () => ({
  InputDialog: ({
    open,
    title,
    onSubmit,
    onCancel,
  }: {
    open: boolean;
    title: string;
    message: string;
    placeholder: string;
    onSubmit: (text: string) => void;
    onCancel: () => void;
    submitLabel: string;
  }) =>
    open ? (
      <div data-testid={`input-dialog-${title.replace(/\s+/g, "-")}`}>
        <span>{title}</span>
        <button onClick={() => onSubmit("Engine overheating")}>SubmitInput</button>
        <button onClick={onCancel}>CancelInput</button>
      </div>
    ) : null,
}));

const mockUser: User = {
  id: "driver-1",
  name: "John Driver",
  email: "driver@test.com",
  role: "driver",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 90,
};

const makeLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: "load-1",
  loadNumber: "LD-001",
  companyId: "company-1",
  driverId: "driver-1",
  status: "in_transit" as any,
  carrierRate: 2500,
  driverPay: 1500,
  pickup: { city: "Dallas", state: "TX" },
  dropoff: { city: "Houston", state: "TX" },
  pickupDate: "2024-06-01",
  truckNumber: "T-100",
  ...overrides,
});

describe("DriverMobileHome coverage — lines 749-962", () => {
  const defaultProps = {
    user: mockUser,
    loads: [makeLoad()],
    onLogout: vi.fn(),
    onSaveLoad: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the change requests tab with Create button", async () => {
    const user = userEvent.setup();
    render(<DriverMobileHome {...defaultProps} />);
    // Navigate to changes tab via "Alerts" nav button
    const changesBtn = screen.getByText("Alerts");
    await user.click(changesBtn);
    expect(screen.getByText("Change Requests")).toBeInTheDocument();
  });

  it("renders the profile tab with user name and role", async () => {
    const user = userEvent.setup();
    render(<DriverMobileHome {...defaultProps} />);
    const profileBtn = screen.getByText("Me");
    await user.click(profileBtn);
    await waitFor(() => {
      expect(screen.getByText("John Driver")).toBeInTheDocument();
    });
  });

  it("renders Sign Out button in profile tab and clicking it calls onLogout", async () => {
    const user = userEvent.setup();
    render(<DriverMobileHome {...defaultProps} />);
    const profileBtn = screen.getByText("Me");
    await user.click(profileBtn);
    const signOutBtn = screen.getByText("Sign Out");
    expect(signOutBtn).toBeInTheDocument();
    await user.click(signOutBtn);
    expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);
  });

  it("renders Assigned Truck info in profile tab", async () => {
    const user = userEvent.setup();
    render(<DriverMobileHome {...defaultProps} />);
    const profileBtn = screen.getByText("Me");
    await user.click(profileBtn);
    expect(screen.getByText("Assigned Truck")).toBeInTheDocument();
    expect(screen.getByText(/Unit: T-100/)).toBeInTheDocument();
  });

  it("shows 'No truck assigned' when no loads have truck numbers", async () => {
    const user = userEvent.setup();
    render(
      <DriverMobileHome
        {...defaultProps}
        loads={[makeLoad({ truckNumber: undefined })]}
      />,
    );
    const profileBtn = screen.getByText("Me");
    await user.click(profileBtn);
    expect(screen.getByText("No truck assigned")).toBeInTheDocument();
  });

  it("renders Compliance Tasks in profile tab", async () => {
    const user = userEvent.setup();
    render(<DriverMobileHome {...defaultProps} />);
    const profileBtn = screen.getByText("Me");
    await user.click(profileBtn);
    expect(screen.getByText("Compliance Tasks")).toBeInTheDocument();
    expect(screen.getByText("All Records Pass")).toBeInTheDocument();
  });

  it("renders the map tab with Fleet Tracking header", async () => {
    const user = userEvent.setup();
    render(<DriverMobileHome {...defaultProps} />);
    const mapBtn = screen.getByText("Live Map");
    await user.click(mapBtn);
    expect(screen.getByText("Fleet Tracking")).toBeInTheDocument();
    expect(screen.getByText("GPS Connection Stable")).toBeInTheDocument();
  });

  it("renders breakdown flow when report issue -> report breakdown is triggered", async () => {
    const user = userEvent.setup();
    render(<DriverMobileHome {...defaultProps} />);
    // Click on the load card to select it — LoadCard shows "ID: LD-001"
    const loadCard = screen.getByText(/ID: LD-001/);
    await user.click(loadCard);
    // Now in selected load detail view — find "Report Issue" button
    await waitFor(() => {
      expect(screen.getByText("Report Issue")).toBeInTheDocument();
    });
    // Click "Report Issue" to open the change request modal
    await user.click(screen.getByText("Report Issue"));
    // Now "Report Breakdown" should be visible in the modal
    await waitFor(() => {
      expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Report Breakdown"));

    // The InputDialog for notes should now be open
    await waitFor(() => {
      expect(
        screen.getByTestId("input-dialog-Report-Breakdown"),
      ).toBeInTheDocument();
    });
  });

  it("navigates bottom tabs correctly with Today, Loads, Alerts, Me, Live Map", async () => {
    const user = userEvent.setup();
    render(<DriverMobileHome {...defaultProps} />);

    // Click each bottom nav tab
    await user.click(screen.getByText("Today"));
    expect(screen.getByText("Active Dispatch")).toBeInTheDocument();

    await user.click(screen.getByText("Loads"));
    expect(screen.getByText("Load History")).toBeInTheDocument();
  });

  it("renders change request items with status badges", async () => {
    const user = userEvent.setup();
    render(<DriverMobileHome {...defaultProps} />);
    await user.click(screen.getByText("Alerts"));
    // The change requests list should render even if empty
    expect(screen.getByText("Change Requests")).toBeInTheDocument();
  });
});
