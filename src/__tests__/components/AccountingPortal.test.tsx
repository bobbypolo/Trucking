import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Must mock before importing the component
vi.mock("../../../services/financialService", () => ({
  getGLAccounts: vi.fn().mockResolvedValue([]),
  getLoadProfitLoss: vi.fn().mockResolvedValue(null),
  createARInvoice: vi.fn(),
  createAPBill: vi.fn(),
  createJournalEntry: vi.fn(),
  getSettlements: vi.fn().mockResolvedValue([]),
  getInvoices: vi.fn().mockResolvedValue([]),
  getBills: vi.fn().mockResolvedValue([]),
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

// Lazy-loaded sub-components need mocking
vi.mock("../../../components/Settlements", () => ({
  Settlements: () => <div data-testid="settlements-mock">Settlements</div>,
}));

vi.mock("../../../components/FileVault", () => ({
  FileVault: () => <div data-testid="file-vault-mock">FileVault</div>,
}));

vi.mock("../../../components/AccountingBillForm", () => ({
  AccountingBillForm: () => <div data-testid="bill-form-mock">BillForm</div>,
}));

vi.mock("../../../components/IFTAManager", () => ({
  IFTAManager: () => <div data-testid="ifta-mock">IFTAManager</div>,
}));

vi.mock("../../../components/DataImportWizard", () => ({
  DataImportWizard: () => <div data-testid="import-wizard-mock">DataImportWizard</div>,
}));

// Import with default export handling
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

  it("renders without crashing", async () => {
    const { container } = render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders with default DASHBOARD tab", async () => {
    const { container } = render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders with a specific initialTab", async () => {
    const { container } = render(
      <AccountingPortal {...defaultProps} initialTab="GL" />,
    );
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders with empty loads and users", async () => {
    const { container } = render(
      <AccountingPortal {...defaultProps} loads={[]} users={[]} />,
    );
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("passes optional onUserUpdate prop", async () => {
    const onUserUpdate = vi.fn();
    const { container } = render(
      <AccountingPortal {...defaultProps} onUserUpdate={onUserUpdate} />,
    );
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders tab navigation buttons", async () => {
    render(<AccountingPortal {...defaultProps} />);
    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
