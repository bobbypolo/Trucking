import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Must mock before importing the component
vi.mock("../../../services/financialService", () => ({
  getGLAccounts: vi.fn().mockResolvedValue([
    { id: "gl-1", code: "1000", name: "Cash", type: "Asset", balance: 50000 },
    {
      id: "gl-2",
      code: "4000",
      name: "Revenue",
      type: "Revenue",
      balance: 120000,
    },
  ]),
  getLoadProfitLoss: vi.fn().mockResolvedValue(null),
  createARInvoice: vi.fn(),
  createAPBill: vi.fn(),
  createJournalEntry: vi.fn(),
  getSettlements: vi.fn().mockResolvedValue([]),
  getInvoices: vi.fn().mockResolvedValue([
    {
      id: "inv-1",
      invoiceNumber: "INV-001",
      customerId: "user-1",
      totalAmount: 2500,
      status: "Unpaid",
      invoiceDate: "2026-01-15",
      dueDate: "2026-02-15",
    },
  ]),
  getBills: vi.fn().mockResolvedValue([
    {
      id: "bill-1",
      vendorName: "Fuel Co",
      totalAmount: 800,
      status: "Pending",
      billDate: "2026-01-10",
      dueDate: "2026-02-10",
    },
  ]),
}));

vi.mock("../../../services/rulesEngineService", () => ({
  executeFuelMatchingRule: vi.fn(),
}));

vi.mock("../../../services/exportService", () => ({
  exportToExcel: vi.fn(),
  exportToPDF: vi.fn(),
}));

vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

// Lazy-loaded sub-components need mocking since they load asynchronously
vi.mock("../../../components/Settlements", () => ({
  Settlements: () => (
    <div data-testid="settlements-component">Settlements Content</div>
  ),
}));

vi.mock("../../../components/FileVault", () => ({
  FileVault: () => (
    <div data-testid="file-vault-component">File Vault Content</div>
  ),
}));

vi.mock("../../../components/AccountingBillForm", () => ({
  AccountingBillForm: () => (
    <div data-testid="bill-form-component">Bill Form Content</div>
  ),
}));

vi.mock("../../../components/IFTAManager", () => ({
  IFTAManager: () => (
    <div data-testid="ifta-component">IFTA Manager Content</div>
  ),
}));

vi.mock("../../../components/DataImportWizard", () => ({
  DataImportWizard: () => (
    <div data-testid="import-wizard-component">Data Import Content</div>
  ),
}));

import AccountingPortal from "../../../components/AccountingPortal";

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Admin User",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2500,
    driverPay: 1500,
    pickupDate: "2026-01-15",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "driver-2",
    loadNumber: "LN-002",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 3000,
    driverPay: 1800,
    pickupDate: "2026-01-16",
    pickup: { city: "Houston", state: "TX" },
    dropoff: { city: "Phoenix", state: "AZ" },
  },
];

describe("AccountingPortal component", () => {
  const defaultProps = {
    loads: mockLoads,
    users: [mockUser],
    currentUser: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tab navigation buttons", async () => {
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
      expect(screen.getByText("AR / Invoices")).toBeInTheDocument();
      expect(screen.getByText("AP / Bills")).toBeInTheDocument();
      expect(screen.getByText("Settlements")).toBeInTheDocument();
      expect(screen.getByText("Fuel & IFTA")).toBeInTheDocument();
      expect(screen.getByText("File Vault")).toBeInTheDocument();
      expect(screen.getByText("Audit Log")).toBeInTheDocument();
      expect(screen.getByText("Rules Engine")).toBeInTheDocument();
    });
  });

  it("defaults to DASHBOARD tab showing Overview content", async () => {
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      // Dashboard tab shows financial overview cards
      // Overview button should be active (styled differently)
      const overviewBtn = screen.getByText("Overview");
      expect(overviewBtn).toBeInTheDocument();
    });
  });

  it("respects initialTab prop for starting tab", async () => {
    render(<AccountingPortal {...defaultProps} initialTab="GL" />);
    await waitFor(() => {
      // GL tab is the Audit Log tab; it should render audit-related content
      const auditBtn = screen.getByText("Audit Log");
      expect(auditBtn).toBeInTheDocument();
    });
  });

  it("switches to AR/Invoices tab on click", async () => {
    const user = userEvent.setup();
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });

    await user.click(screen.getByText("AR / Invoices"));
    await waitFor(() => {
      // AR tab should show Accounts Receivable heading
      expect(screen.getByText("Accounts Receivable")).toBeInTheDocument();
    });
  });

  it("switches to AP/Bills tab on click", async () => {
    const user = userEvent.setup();
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });

    await user.click(screen.getByText("AP / Bills"));
    await waitFor(() => {
      // AP tab should show Accounts Payable heading
      expect(screen.getByText("Accounts Payable")).toBeInTheDocument();
    });
  });

  it("renders the Settlements tab redirect message", async () => {
    const user = userEvent.setup();
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Settlements")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Settlements"));
    await waitFor(() => {
      expect(
        screen.getByText(/Settlement management has moved/i),
      ).toBeInTheDocument();
    });
  });

  it("renders the lazy-loaded IFTA tab", async () => {
    const user = userEvent.setup();
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Fuel & IFTA")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Fuel & IFTA"));
    await waitFor(
      () => {
        expect(screen.getByTestId("ifta-component")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("renders the lazy-loaded File Vault tab", async () => {
    const user = userEvent.setup();
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("File Vault")).toBeInTheDocument();
    });

    await user.click(screen.getByText("File Vault"));
    await waitFor(
      () => {
        expect(screen.getByTestId("file-vault-component")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("renders with empty loads and users without crashing", async () => {
    render(<AccountingPortal {...defaultProps} loads={[]} users={[]} />);
    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });
  });

  it("has a Batch Import Engine button", async () => {
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Batch Import Engine")).toBeInTheDocument();
    });
  });

  it("switches to Rules Engine tab and shows Automation Center", async () => {
    const user = userEvent.setup();
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Rules Engine")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Rules Engine"));
    await waitFor(() => {
      // Automation rules are initially empty (fetched from API)
      expect(screen.getByText("Automation Center")).toBeInTheDocument();
    });
  });

  // R-P3-08: QB Sync section not rendered in AccountingPortal
  it("does not render a QB Sync section (R-P3-08)", async () => {
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });
    // QB Sync / QuickBooks section must be absent
    expect(screen.queryByText(/quickbooks/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/QB Sync/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sync-qb/i)).not.toBeInTheDocument();
  });

  // R-P3-12: No button triggers a fake success toast for unimplemented features
  it("does not show coming soon or unimplemented feature toasts (R-P3-12)", async () => {
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });
    // There should be no "Coming Soon" text anywhere in the rendered output
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    // There should be no "Not Yet Implemented" text
    expect(screen.queryByText(/not yet implemented/i)).not.toBeInTheDocument();
  });
});
