import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Settlements } from "../../../components/Settlements";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Mock services used by Settlements
vi.mock("../../../services/storageService", () => ({
  generateInvoicePDF: vi.fn().mockResolvedValue(undefined),
  settleLoad: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/authService", () => ({
  addDriver: vi.fn(),
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
    name: "Test Admin",
  }),
  onUserChange: vi.fn(() => () => {}),
}));

vi.mock("../../../services/financialService", () => ({
  createSettlement: vi.fn().mockResolvedValue(undefined),
  uploadToVault: vi.fn().mockResolvedValue(undefined),
  getSettlements: vi.fn().mockResolvedValue([]),
  getBills: vi.fn().mockResolvedValue([]),
  batchFinalizeSettlements: vi.fn().mockResolvedValue({ updated: 1 }),
}));

vi.mock("../../../services/syncService", () => ({
  generateQBSummaryJournal: vi.fn(),
  exportToCSV: vi.fn(),
}));

vi.mock("../../../services/firebase", () => ({
  DEMO_MODE: false,
}));

const mockDriver: User = {
  id: "driver-1",
  companyId: "company-1",
  email: "driver@test.com",
  name: "Test Driver",
  role: "driver",
  payModel: "percent",
  payRate: 25,
  onboardingStatus: "Completed",
  safetyScore: 95,
};

const mockSalaryDriver: User = {
  id: "driver-2",
  companyId: "company-1",
  email: "salary@test.com",
  name: "Salary Driver",
  role: "driver",
  payModel: "salary",
  payRate: 5000,
  onboardingStatus: "Completed",
  safetyScore: 90,
};

const mockMileageDriver: User = {
  id: "driver-3",
  companyId: "company-1",
  email: "mileage@test.com",
  name: "Mileage Driver",
  role: "driver",
  payModel: "mileage",
  payRate: 0.6,
  onboardingStatus: "Completed",
  safetyScore: 88,
};

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.Delivered,
    carrierRate: 1500,
    driverPay: 750,
    pickupDate: "2025-12-01",
    pickup: { city: "Chicago", state: "IL", facilityName: "Acme Warehouse" },
    dropoff: { city: "Dallas", state: "TX" },
  },
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-002",
    status: LOAD_STATUS.Completed,
    carrierRate: 2000,
    driverPay: 1000,
    pickupDate: "2025-12-05",
    pickup: { city: "Atlanta", state: "GA", facilityName: "Beta Logistics" },
    dropoff: { city: "Miami", state: "FL" },
    financialStatus: "Invoiced",
  },
  {
    id: "load-3",
    companyId: "company-1",
    driverId: "driver-2",
    loadNumber: "LN-003",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 1800,
    driverPay: 900,
    pickupDate: "2025-12-10",
    pickup: { city: "Houston", state: "TX", facilityName: "Gamma Corp" },
    dropoff: { city: "Phoenix", state: "AZ" },
  },
];

describe("Settlements component", () => {
  const defaultProps = {
    loads: mockLoads,
    users: [mockDriver],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Header and tab navigation ---

  it("renders the Financial Command Center header", () => {
    render(<Settlements {...defaultProps} />);
    expect(screen.getByText("Financial Command Center")).toBeInTheDocument();
  });

  it("renders the header subtitle", () => {
    render(<Settlements {...defaultProps} />);
    expect(
      screen.getByText(
        "Payroll Approval, Invoicing, and Profitability Analysis.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the three tab buttons", () => {
    render(<Settlements {...defaultProps} />);
    expect(screen.getByText("Payroll Approval")).toBeInTheDocument();
    expect(
      screen.getByText("Accounts Receivable (Invoicing)"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Profit & Loss/)).toBeInTheDocument();
  });

  it("shows Pay Period date range inputs", () => {
    render(<Settlements {...defaultProps} />);
    expect(screen.getByText("Pay Period:")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12/01/2025")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12/31/2025")).toBeInTheDocument();
  });

  // --- Payroll tab ---

  it("shows driver name in payroll section", async () => {
    render(<Settlements {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
  });

  it("shows Ready for Payroll status on driver card", async () => {
    render(<Settlements {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Ready for Payroll")).toBeInTheDocument();
    });
  });

  it("shows TOTAL PAYABLE label on driver card", async () => {
    render(<Settlements {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("TOTAL PAYABLE")).toBeInTheDocument();
    });
  });

  it("shows payModel badge on driver card", async () => {
    render(<Settlements {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("percent")).toBeInTheDocument();
    });
  });

  it("shows empty state when no users provided", async () => {
    render(<Settlements loads={mockLoads} users={[]} />);
    await waitFor(() => {
      expect(screen.getByText("No personnel found")).toBeInTheDocument();
    });
  });

  it("expands driver card on click and shows financial breakdown", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    // Click the driver card to expand
    await user.click(await screen.findByText("Test Driver"));
    await waitFor(() => {
      expect(screen.getByText("Gross Earnings")).toBeInTheDocument();
    });
    expect(screen.getByText("Reimbursements")).toBeInTheDocument();
    expect(screen.getByText("Total Deductions")).toBeInTheDocument();
    expect(screen.getByText("NET PAYABLE")).toBeInTheDocument();
  });

  it("shows Validated Loads table in expanded card", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(await screen.findByText("Test Driver"));
    await waitFor(() => {
      expect(screen.getByText("Validated Loads")).toBeInTheDocument();
    });
    expect(screen.getByText("LN-001")).toBeInTheDocument();
    expect(screen.getByText("LN-002")).toBeInTheDocument();
  });

  it("shows Authorize & Pay button in expanded card", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(await screen.findByText("Test Driver"));
    await waitFor(() => {
      expect(screen.getByText(/Authorize & Pay/)).toBeInTheDocument();
    });
  });

  it("shows Generate Statement button in expanded card", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(await screen.findByText("Test Driver"));
    await waitFor(() => {
      expect(screen.getByText("Generate Statement")).toBeInTheDocument();
    });
  });

  it("calls createSettlement when Authorize & Pay is clicked", async () => {
    const { createSettlement } =
      await import("../../../services/financialService");
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(await screen.findByText("Test Driver"));
    await waitFor(() => {
      expect(screen.getByText(/Authorize & Pay/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Authorize & Pay/));
    await waitFor(() => {
      expect(createSettlement).toHaveBeenCalled();
    });
  });

  it("shows feedback after Authorize & Pay is clicked", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(await screen.findByText("Test Driver"));
    await waitFor(() => {
      expect(screen.getByText(/Authorize & Pay/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Authorize & Pay/));
    await waitFor(() => {
      expect(
        screen.getByText(/Settlement finalized for Test Driver/),
      ).toBeInTheDocument();
    });
  });

  it("shows deferred statement feedback when Generate Statement is clicked", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(await screen.findByText("Test Driver"));
    await waitFor(() => {
      expect(screen.getByText("Generate Statement")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Generate Statement"));
    await waitFor(() => {
      expect(
        screen.getByText(/Statement generation requested/),
      ).toBeInTheDocument();
    });
  });

  it("shows feedback after Generate Statement is clicked", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(await screen.findByText("Test Driver"));
    await waitFor(() => {
      expect(screen.getByText("Generate Statement")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Generate Statement"));
    await waitFor(() => {
      expect(
        screen.getByText(/Statement generation requested/),
      ).toBeInTheDocument();
    });
  });

  it("collapses expanded card when clicked again", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(await screen.findByText("Test Driver"));
    await waitFor(() => {
      expect(screen.getByText("Gross Earnings")).toBeInTheDocument();
    });
    await user.click(await screen.findByText("Test Driver"));
    await waitFor(() => {
      expect(screen.queryByText("Gross Earnings")).not.toBeInTheDocument();
    });
  });

  it("shows No activity when driver has no loads", async () => {
    const driverNoLoads: User = {
      ...mockDriver,
      id: "driver-noloads",
      name: "Empty Driver",
    };
    const user = userEvent.setup();
    render(<Settlements loads={mockLoads} users={[driverNoLoads]} />);
    await user.click(await screen.findByText("Empty Driver"));
    await waitFor(() => {
      expect(screen.getByText("No activity.")).toBeInTheDocument();
    });
  });

  it("renders salary pay model driver", async () => {
    render(<Settlements loads={mockLoads} users={[mockSalaryDriver]} />);
    await waitFor(() => {
      expect(screen.getByText("Salary Driver")).toBeInTheDocument();
    });
    expect(screen.getByText("salary")).toBeInTheDocument();
  });

  it("renders mileage pay model driver", async () => {
    render(<Settlements loads={mockLoads} users={[mockMileageDriver]} />);
    await waitFor(() => {
      expect(screen.getByText("Mileage Driver")).toBeInTheDocument();
    });
    expect(screen.getByText("mileage")).toBeInTheDocument();
  });

  it("dismisses feedback when X is clicked", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(await screen.findByText("Test Driver"));
    await waitFor(() => {
      expect(screen.getByText(/Authorize & Pay/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Authorize & Pay/));
    await waitFor(() => {
      expect(screen.getByText(/Settlement finalized/)).toBeInTheDocument();
    });
    // Find and click the dismiss X button on the feedback bar
    const feedbackBar = screen
      .getByText(/Settlement finalized/)
      .closest("div")!.parentElement!;
    const xBtn = feedbackBar.querySelector("button");
    await user.click(xBtn!);
    await waitFor(() => {
      expect(
        screen.queryByText(/Settlement finalized/),
      ).not.toBeInTheDocument();
    });
  });

  // --- Invoices tab ---

  it("switches to Invoices tab and shows Accounts Receivable heading", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(screen.getByText("Accounts Receivable")).toBeInTheDocument();
    });
  });

  it("shows invoice table headers on Invoices tab", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(screen.getByText("Load #")).toBeInTheDocument();
    });
    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("shows delivered loads as pending invoices on Invoices tab", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(screen.getByText("LN-001")).toBeInTheDocument();
    });
    expect(screen.getByText("Pending Invoice")).toBeInTheDocument();
    expect(screen.getByText("Acme Warehouse")).toBeInTheDocument();
  });

  it("shows Batch Print and Finalize All buttons on Invoices tab", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(screen.getByText("Batch Print")).toBeInTheDocument();
    });
    expect(screen.getByText("Finalize All")).toBeInTheDocument();
  });

  // R-P5-01: Chevron expand wired to setExpandedRow(id) toggle
  it("R-P5-01: invoice row chevron expands to show load details", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(screen.getByText("LN-001")).toBeInTheDocument();
    });
    // Click the chevron/expand button on the first invoice row
    const expandBtns = screen.getAllByTitle("Expand row");
    await user.click(expandBtns[0]);
    // Expanded row shows additional details
    await waitFor(() => {
      expect(screen.getByText(/Route:/)).toBeInTheDocument();
    });
  });

  it("R-P5-01: clicking chevron again collapses the expanded row", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(screen.getByText("LN-001")).toBeInTheDocument();
    });
    const expandBtns = screen.getAllByTitle("Expand row");
    await user.click(expandBtns[0]);
    await waitFor(() => {
      expect(screen.getByText(/Route:/)).toBeInTheDocument();
    });
    // Click again to collapse
    const collapseBtns = screen.getAllByTitle("Collapse row");
    await user.click(collapseBtns[0]);
    await waitFor(() => {
      expect(screen.queryByText(/Route:/)).not.toBeInTheDocument();
    });
  });

  // R-P5-02: Batch Print generates PDF using jsPDF
  it("R-P5-02: Batch Print generates a PDF document", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(screen.getByText("Batch Print")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Batch Print"));
    await waitFor(() => {
      expect(screen.getByText(/PDF generated/i)).toBeInTheDocument();
    });
  });

  // R-P5-03: Finalize calls PATCH /api/settlements/batch
  it("R-P5-03: Finalize All calls batchFinalizeSettlements API", async () => {
    const { batchFinalizeSettlements } =
      await import("../../../services/financialService");
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(screen.getByText("Finalize All")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Finalize All"));
    await waitFor(() => {
      expect(batchFinalizeSettlements).toHaveBeenCalled();
    });
  });

  it("R-P5-03: Finalize updates row status to Finalized after API call", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(screen.getByText("Finalize All")).toBeInTheDocument();
    });
    // Verify initial state is "Pending Invoice"
    expect(screen.getByText("Pending Invoice")).toBeInTheDocument();
    await user.click(screen.getByText("Finalize All"));
    // The feedback message confirms finalization
    await waitFor(() => {
      expect(screen.getByText(/Finalized 1 settlement/)).toBeInTheDocument();
    });
  });

  // R-P5-04: Export CSV triggers file download
  it("R-P5-04: Export CSV button exists on Invoices tab", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
    });
  });

  it("R-P5-04: Export CSV triggers download with settlement data", async () => {
    // Mock URL.createObjectURL and document.createElement for download
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:test");
    const mockRevokeObjectURL = vi.fn();
    Object.defineProperty(window, "URL", {
      value: {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      },
      writable: true,
    });
    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const el = originalCreateElement("a");
        el.click = mockClick;
        return el;
      }
      return originalCreateElement(tag);
    });

    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Export CSV"));
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
    expect(mockClick).toHaveBeenCalled();
  });

  it("shows empty invoice message when no delivered loads", async () => {
    const user = userEvent.setup();
    const loadsNoDelivered = mockLoads.filter(
      (l) => l.status !== LOAD_STATUS.Delivered,
    );
    render(<Settlements loads={loadsNoDelivered} users={[mockDriver]} />);
    await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
    await waitFor(() => {
      expect(
        screen.getByText(/No pending deliveries found for invoicing/),
      ).toBeInTheDocument();
    });
  });

  // --- P&L tab ---

  it("switches to Profit & Loss tab and shows P&L statistics", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText(/Profit & Loss/));
    await waitFor(() => {
      expect(screen.getByText("Gross Revenue")).toBeInTheDocument();
    });
    expect(screen.getByText("Operating Expenses")).toBeInTheDocument();
    expect(screen.getByText("Net Profit")).toBeInTheDocument();
  });

  it("shows financial breakdown section on P&L tab", async () => {
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} />);
    await user.click(screen.getByText(/Profit & Loss/));
    await waitFor(() => {
      expect(screen.getByText("Financial breakdown")).toBeInTheDocument();
    });
    expect(screen.getByText("Driver Settlements")).toBeInTheDocument();
    expect(screen.getByText("Fuel & Other Expenses")).toBeInTheDocument();
  });

  // --- Edge cases ---

  it("renders in dashboard mode", () => {
    render(<Settlements {...defaultProps} isDashboardMode={true} />);
    expect(screen.getByText("Financial Command Center")).toBeInTheDocument();
  });

  it("calls onUserUpdate when Force Financial Sync button is clicked", async () => {
    const onUserUpdate = vi.fn();
    const user = userEvent.setup();
    render(<Settlements {...defaultProps} onUserUpdate={onUserUpdate} />);
    // The Force Financial Sync button has title attribute
    const syncBtn = screen.getByTitle("Force Financial Sync");
    await user.click(syncBtn);
    expect(onUserUpdate).toHaveBeenCalledTimes(1);
  });

  it("renders multiple users with distinct pay data", async () => {
    render(
      <Settlements
        loads={mockLoads}
        users={[mockDriver, mockSalaryDriver, mockMileageDriver]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    expect(screen.getByText("Salary Driver")).toBeInTheDocument();
    expect(screen.getByText("Mileage Driver")).toBeInTheDocument();
  });
});
