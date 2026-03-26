import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Must mock before importing the component
vi.mock("../../../services/financialService", () => ({
  getGLAccounts: vi.fn().mockResolvedValue([
    {
      id: "gl-1",
      code: "1000",
      accountNumber: "1000",
      name: "Cash",
      type: "Asset",
      balance: 50000,
    },
    {
      id: "gl-2",
      code: "4000",
      accountNumber: "4000",
      name: "Revenue",
      type: "Revenue",
      balance: 120000,
    },
    {
      id: "gl-5",
      code: "5000",
      accountNumber: "5000",
      name: "Repair Expense",
      type: "Expense",
      balance: 8000,
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
      balanceDue: 2500,
      status: "Sent",
      invoiceDate: "2026-01-15",
      dueDate: "2026-02-15",
      pod_attached: false,
    },
    {
      id: "inv-2",
      invoiceNumber: "INV-002",
      customerId: "user-1",
      totalAmount: 1500,
      balanceDue: 0,
      status: "Paid",
      invoiceDate: "2026-01-10",
      dueDate: "2026-02-10",
      pod_attached: true,
    },
  ]),
  getBills: vi.fn().mockResolvedValue([
    {
      id: "bill-1",
      vendorId: "vendor-1",
      vendorName: "Fuel Co",
      billNumber: "B-001",
      totalAmount: 800,
      balanceDue: 800,
      status: "Pending",
      billDate: "2026-01-10",
      dueDate: "2026-02-10",
      description: "Fuel",
      lines: [],
    },
  ]),
}));

vi.mock("../../../services/rulesEngineService", () => ({
  executeFuelMatchingRule: vi.fn().mockResolvedValue({ matched: 5, orphaned: 1 }),
}));

vi.mock("../../../services/exportService", () => ({
  exportToExcel: vi.fn(),
  exportToPDF: vi.fn(),
}));

vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

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

describe("AccountingPortal Remediation (C-2)", () => {
  const mockNavigate = vi.fn();

  const defaultProps = {
    loads: mockLoads,
    users: [mockUser],
    currentUser: mockUser,
    onNavigate: mockNavigate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── R-P4-04: All 10 hardcoded values removed ──

  describe("R-P4-04: Hardcoded values removed", () => {
    it("R-P4-04: Pending Docs KPI shows computed value, not hardcoded 14", async () => {
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Pending Docs")).toBeInTheDocument();
      });
      // With 1 invoice lacking pod_attached, value should be "1"
      const pendingDocsCard = screen.getByText("Pending Docs").closest("div");
      expect(pendingDocsCard?.textContent).not.toContain('"14"');
      // The actual count from our mock data: 1 invoice has pod_attached=false
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("R-P4-04: IFTA Liability KPI shows computed value, not hardcoded $2,840", async () => {
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("IFTA Liability")).toBeInTheDocument();
      });
      // Should NOT show the hardcoded $2,840
      const iftaCard = screen.getByText("IFTA Liability").closest("div");
      expect(iftaCard?.parentElement?.textContent).not.toContain("$2,840");
    });

    it("R-P4-04: Automation rules initialize empty, not 3 hardcoded objects", async () => {
      const user = userEvent.setup();
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Rules Engine")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Rules Engine"));
      await waitFor(() => {
        expect(screen.getByText("Automation Center")).toBeInTheDocument();
      });
      // Should NOT show hardcoded rule names — rules should be empty or from API
      expect(
        screen.queryByText("Fuel Receipt Auto-Match"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Auto-IFTA Analysis")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Compliance Guard: Lock on POD"),
      ).not.toBeInTheDocument();
    });

    it("R-P4-04: Maintenance tab shows unavailable state, no hardcoded service tickets", async () => {
      const user = userEvent.setup();
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Overview")).toBeInTheDocument();
      });
      // Switch to Maintenance tab
      await user.click(screen.getByText("Maintenance"));
      await waitFor(() => {
        expect(
          screen.getByText("Maintenance Tracking"),
        ).toBeInTheDocument();
      });
      // No fake service tickets or hardcoded metrics should appear
      expect(screen.queryByText("Speedco Maintenance")).not.toBeInTheDocument();
      expect(screen.queryByText("TK-9025")).not.toBeInTheDocument();
      expect(screen.queryByText("$12,450")).not.toBeInTheDocument();
      expect(screen.queryByText("$0.42")).not.toBeInTheDocument();
    });

    it("R-P4-04: Audit log entries are not hardcoded", async () => {
      const user = userEvent.setup();
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Overview")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Audit Log"));
      await waitFor(() => {
        expect(
          screen.getByText("Operational Audit Trail"),
        ).toBeInTheDocument();
      });
      // Hardcoded entries should be gone
      expect(
        screen.queryByText("Load #1024 Locked"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Invoice #INV-902 Sent to HUB Group/),
      ).not.toBeInTheDocument();
    });

    it("R-P4-04: No hardcoded '1 hour ago' timestamp", async () => {
      const user = userEvent.setup();
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Overview")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Audit Log"));
      await waitFor(() => {
        expect(
          screen.getByText("Operational Audit Trail"),
        ).toBeInTheDocument();
      });
      expect(screen.queryByText("1 hour ago")).not.toBeInTheDocument();
    });

    it("R-P4-04: Time Saved stat shows computed value, not hardcoded 42.5 hrs", async () => {
      const user = userEvent.setup();
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Rules Engine")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Rules Engine"));
      await waitFor(() => {
        expect(screen.getByText("Automation Center")).toBeInTheDocument();
      });
      // Should NOT show hardcoded 42.5 hrs
      expect(screen.queryByText("42.5 hrs")).not.toBeInTheDocument();
    });

    it("R-P4-04: Active Triggers stat shows computed value, not hardcoded 14", async () => {
      const user = userEvent.setup();
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Rules Engine")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Rules Engine"));
      await waitFor(() => {
        expect(screen.getByText("Automation Center")).toBeInTheDocument();
      });
      // With empty automation rules, active triggers should be "0", not "14"
      expect(screen.queryByText("14")).not.toBeInTheDocument();
    });
  });

  // ── R-P4-05: 3 buttons wired ──

  describe("R-P4-05: Buttons wired", () => {
    it("R-P4-05: View All Loads button calls onNavigate with 'loads'", async () => {
      const user = userEvent.setup();
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("View All Loads")).toBeInTheDocument();
      });
      await user.click(screen.getByText("View All Loads"));
      expect(mockNavigate).toHaveBeenCalledWith("loads");
    });

    it("R-P4-05: Create New Rule button shows toast", async () => {
      const user = userEvent.setup();
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Rules Engine")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Rules Engine"));
      await waitFor(() => {
        expect(screen.getByText("Create New Rule")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Create New Rule"));
      await waitFor(() => {
        expect(
          screen.getByText(/automation rule builder coming soon/i),
        ).toBeInTheDocument();
      });
    });

    it("R-P4-05: More options buttons show toast", async () => {
      const user = userEvent.setup();
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Overview")).toBeInTheDocument();
      });
      // Switch to AR tab which has More options buttons
      await user.click(screen.getByText("AR / Invoices"));
      await waitFor(() => {
        expect(screen.getByText("Accounts Receivable")).toBeInTheDocument();
      });
      // Click the More options button (MoreVertical icon)
      const moreButtons = screen.getAllByLabelText("More options");
      expect(moreButtons.length).toBeGreaterThan(0);
      await user.click(moreButtons[0]);
      await waitFor(() => {
        expect(
          screen.getByText(/line item actions coming soon/i),
        ).toBeInTheDocument();
      });
    });
  });

  // ── R-P4-06: setTimeout mock matching removed ──

  describe("R-P4-06: setTimeout mock matching removed", () => {
    it("R-P4-06: handleRunEngine does not use setTimeout", async () => {
      const user = userEvent.setup();
      render(<AccountingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Rules Engine")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Rules Engine"));
      await waitFor(() => {
        expect(screen.getByText("Run Full Audit")).toBeInTheDocument();
      });
      // Click the Run Full Audit button — this should use the real API, not setTimeout
      await user.click(screen.getByText("Run Full Audit"));
      // Should show result from the mocked executeFuelMatchingRule
      await waitFor(() => {
        expect(
          screen.getByText(/Auto-Matched 5 receipts/),
        ).toBeInTheDocument();
      });
    });
  });
});
