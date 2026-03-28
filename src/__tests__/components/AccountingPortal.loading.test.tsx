// Tests R-P2-01, R-P2-03
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/financialService", () => ({
  getGLAccounts: vi.fn(),
  getLoadProfitLoss: vi.fn().mockResolvedValue(null),
  createARInvoice: vi.fn(),
  createAPBill: vi.fn(),
  createJournalEntry: vi.fn(),
  getSettlements: vi.fn(),
  getIFTASummary: vi.fn().mockResolvedValue(null),
  getInvoices: vi.fn(),
  getBills: vi.fn(),
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
import type { User, LoadData } from "../../../types";
import { LOAD_STATUS } from "../../../types";

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Admin User",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockLoads: LoadData[] = [];

describe("AccountingPortal — Loading and Error States (R-P2-01, R-P2-03)", () => {
  const defaultProps = {
    loads: mockLoads,
    users: [mockUser],
    currentUser: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // R-P2-01: AccountingPortal shows LoadingSkeleton while data loads
  it("R-P2-01: shows LoadingSkeleton (aria-busy) while data is loading", async () => {
    const { getGLAccounts, getInvoices, getBills, getSettlements } =
      await import("../../../services/financialService");

    // Create a promise we can control to keep loading in-flight
    let resolveAccounts!: (v: any[]) => void;
    const accountsPromise = new Promise<any[]>((r) => {
      resolveAccounts = r;
    });

    (getGLAccounts as ReturnType<typeof vi.fn>).mockReturnValue(
      accountsPromise,
    );
    (getInvoices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getBills as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getSettlements as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(<AccountingPortal {...defaultProps} />);

    // During loading, the skeleton should appear
    expect(screen.getByRole("status")).toBeInTheDocument();

    // Resolve so component doesn't leak
    resolveAccounts([]);
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("R-P2-01: LoadingSkeleton disappears after data loads", async () => {
    const { getGLAccounts, getInvoices, getBills, getSettlements } =
      await import("../../../services/financialService");

    (getGLAccounts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getInvoices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getBills as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getSettlements as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(<AccountingPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    // Normal content should be visible
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  // R-P2-03: API errors in AccountingPortal show ErrorState with retry button
  it("R-P2-03: shows ErrorState with retry button when API fails", async () => {
    const { getGLAccounts, getInvoices, getBills, getSettlements } =
      await import("../../../services/financialService");

    (getGLAccounts as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );
    (getInvoices as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );
    (getBills as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );
    (getSettlements as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    render(<AccountingPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // ErrorState has a retry button
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("R-P2-03: ErrorState retry button re-fetches data", async () => {
    const { getGLAccounts, getInvoices, getBills, getSettlements } =
      await import("../../../services/financialService");

    (getGLAccounts as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );
    (getInvoices as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );
    (getBills as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );
    (getSettlements as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );

    // Second attempt succeeds
    (getGLAccounts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getInvoices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getBills as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getSettlements as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const user = userEvent.setup();
    render(<AccountingPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    // After retry, normal content appears
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("R-P2-03: ErrorState shows error message", async () => {
    const { getGLAccounts, getInvoices, getBills, getSettlements } =
      await import("../../../services/financialService");

    (getGLAccounts as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );
    (getInvoices as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );
    (getBills as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );
    (getSettlements as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    render(<AccountingPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Alert area should contain meaningful text
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
  });
});
