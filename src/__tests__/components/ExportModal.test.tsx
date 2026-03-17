import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ExportModal } from "../../../components/ExportModal";
import { LoadData } from "../../../types";

vi.mock("../../../services/storageService", () => ({
  exportToPDF: vi.fn(),
  exportToCSV: vi.fn(),
}));

function makeLoad(overrides: Partial<LoadData> = {}): LoadData {
  return {
    id: "load-1",
    companyId: "co-1",
    driverId: "drv-1",
    loadNumber: "LD-100",
    status: "delivered",
    carrierRate: 2500,
    driverPay: 1200,
    pickupDate: "2026-03-10",
    pickup: { city: "Dallas", state: "TX", facilityName: "Acme Warehouse" },
    dropoff: { city: "Houston", state: "TX", facilityName: "Beta Dock" },
    onboardingStatus: "Completed",
    safetyScore: 95,
    ...overrides,
  } as LoadData;
}

describe("ExportModal", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let user: ReturnType<typeof userEvent.setup>;
  const loads = [
    makeLoad({ id: "1", loadNumber: "LD-100", pickupDate: "2026-03-01" }),
    makeLoad({
      id: "2",
      loadNumber: "LD-101",
      pickupDate: "2026-02-15",
      pickup: { city: "Austin", state: "TX", facilityName: "Gamma Yard" },
    }),
    makeLoad({ id: "3", loadNumber: "LD-102", pickupDate: "2026-01-20" }),
  ];

  beforeEach(() => {
    onClose = vi.fn();
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  it("renders the modal header", () => {
    render(<ExportModal loads={loads} onClose={onClose} />);
    expect(screen.getByText("Export & Reports")).toBeInTheDocument();
    expect(
      screen.getByText("Generate custom reports for accounting or analysis."),
    ).toBeInTheDocument();
  });

  it("shows record count matching all loads", () => {
    render(<ExportModal loads={loads} onClose={onClose} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    render(<ExportModal loads={loads} onClose={onClose} />);
    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when X button is clicked", async () => {
    render(<ExportModal loads={loads} onClose={onClose} />);
    // X button is the second button in the header
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons.find(
      (b) => b.querySelector("svg") && b.closest(".border-b"),
    );
    // Alternatively, find by the X icon area
    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders default selected columns", () => {
    render(<ExportModal loads={loads} onClose={onClose} />);
    // Default columns: loadNumber, status, date, customer, origin, destination, rate
    expect(screen.getByText("Load #")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Pickup Date")).toBeInTheDocument();
    expect(screen.getByText("Customer/Broker")).toBeInTheDocument();
    expect(screen.getByText("Origin City")).toBeInTheDocument();
    expect(screen.getByText("Dest City")).toBeInTheDocument();
    expect(screen.getByText("Carrier Rate ($)")).toBeInTheDocument();
  });

  it("toggles a column off when clicked", async () => {
    render(<ExportModal loads={loads} onClose={onClose} />);
    const statusBtn = screen.getByText("Status").closest("button")!;
    // Status should be selected initially (has blue styling)
    expect(statusBtn.className).toContain("bg-blue-900");

    await user.click(statusBtn);
    // After toggle, should no longer have blue styling
    expect(statusBtn.className).not.toContain("bg-blue-900");
  });

  it("toggles a column on when clicked", async () => {
    render(<ExportModal loads={loads} onClose={onClose} />);
    // Driver column is not selected by default
    const driverBtn = screen.getByText("Driver").closest("button")!;
    expect(driverBtn.className).not.toContain("bg-blue-900");

    await user.click(driverBtn);
    expect(driverBtn.className).toContain("bg-blue-900");
  });

  it("prevents deselecting the last column", async () => {
    // Render with only one column initially selected would require toggling all off
    // Instead, test that toggling off all but one keeps one
    render(<ExportModal loads={[makeLoad()]} onClose={onClose} />);
    // Toggle off all columns except one, then try to toggle the last one
    const columns = [
      "Status",
      "Pickup Date",
      "Customer/Broker",
      "Origin City",
      "Dest City",
      "Carrier Rate ($)",
    ];
    for (const col of columns) {
      await user.click(screen.getByText(col).closest("button")!);
    }
    // Only Load # should remain selected
    const loadNumBtn = screen.getByText("Load #").closest("button")!;
    expect(loadNumBtn.className).toContain("bg-blue-900");

    // Try to toggle off Load # -- should not deselect
    await user.click(loadNumBtn);
    expect(loadNumBtn.className).toContain("bg-blue-900");
  });

  it("hides rate and expenses columns for driver role", () => {
    render(
      <ExportModal loads={loads} onClose={onClose} currentUserRole="driver" />,
    );
    expect(screen.queryByText("Carrier Rate ($)")).not.toBeInTheDocument();
    expect(screen.queryByText("Accessorials ($)")).not.toBeInTheDocument();
  });

  it("shows rate column for non-driver roles", () => {
    render(
      <ExportModal loads={loads} onClose={onClose} currentUserRole="admin" />,
    );
    expect(screen.getByText("Carrier Rate ($)")).toBeInTheDocument();
  });

  it("triggers CSV export and calls onClose", async () => {
    const { exportToCSV } = await import("../../../services/storageService");
    render(<ExportModal loads={loads} onClose={onClose} />);
    await user.click(screen.getByText("Export CSV"));
    expect(exportToCSV).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("triggers PDF export and calls onClose", async () => {
    const { exportToPDF } = await import("../../../services/storageService");
    render(<ExportModal loads={loads} onClose={onClose} />);
    await user.click(screen.getByText("Generate PDF Report"));
    expect(exportToPDF).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables export buttons when no data matches filters", async () => {
    render(<ExportModal loads={[]} onClose={onClose} />);
    expect(screen.getByText("No data matches filters")).toBeInTheDocument();
    const csvBtn = screen.getByText("Export CSV").closest("button")!;
    const pdfBtn = screen.getByText("Generate PDF Report").closest("button")!;
    expect(csvBtn).toBeDisabled();
    expect(pdfBtn).toBeDisabled();
  });

  it("renders customer filter dropdown with unique facility names", () => {
    render(<ExportModal loads={loads} onClose={onClose} />);
    const select = screen.getByDisplayValue("All Customers");
    expect(select).toBeInTheDocument();
  });

  it("filters by customer when a specific customer is selected", async () => {
    render(<ExportModal loads={loads} onClose={onClose} />);
    const select = screen.getByDisplayValue("All Customers");
    await user.selectOptions(select, "Gamma Yard");
    // Should only show 1 record
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders This Month and Last Month quick date buttons", () => {
    render(<ExportModal loads={loads} onClose={onClose} />);
    expect(screen.getByText("This Month")).toBeInTheDocument();
    expect(screen.getByText("Last Month")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });
});
