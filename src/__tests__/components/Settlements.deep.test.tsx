import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Settlements } from "../../../components/Settlements";
import { LoadData, User, LOAD_STATUS } from "../../../types";

vi.mock("../../../services/storageService", () => ({ generateInvoicePDF: vi.fn().mockResolvedValue(undefined), settleLoad: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../../services/authService", () => ({ addDriver: vi.fn(), getCurrentUser: vi.fn().mockReturnValue({ id: "user-1", role: "admin", companyId: "company-1", name: "Test Admin" }) }));
vi.mock("../../../services/financialService", () => ({ createSettlement: vi.fn().mockResolvedValue(undefined), uploadToVault: vi.fn().mockResolvedValue(undefined), getSettlements: vi.fn().mockResolvedValue([]), getBills: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../services/syncService", () => ({ generateQBSummaryJournal: vi.fn(), exportToCSV: vi.fn() }));
vi.mock("../../../services/firebase", () => ({ DEMO_MODE: false }));

const makeDriver = (o: Partial<User> = {}): User => ({ id: "driver-1", companyId: "company-1", email: "d@t.com", name: "Test Driver", role: "driver", payModel: "percent", payRate: 25, onboardingStatus: "Completed", safetyScore: 95, ...o });
const makeLoad = (o: Partial<LoadData> = {}): LoadData => ({ id: "load-1", companyId: "company-1", driverId: "driver-1", loadNumber: "LN-001", status: LOAD_STATUS.Delivered, carrierRate: 2000, driverPay: 500, pickupDate: "2025-12-01", pickup: { city: "Chicago", state: "IL", facilityName: "Acme" }, dropoff: { city: "Dallas", state: "TX" }, ...o });

describe("Settlements deep coverage", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("Deductions (service layer)", () => {
    it("shows empty deductions from service layer (no hardcoded demo items)", async () => {
      const user = userEvent.setup();
      render(<Settlements loads={[makeLoad()]} users={[makeDriver()]} />);
      await user.click(await screen.findByText("Test Driver"));
      await waitFor(() => { expect(screen.getByText("Total Deductions")).toBeInTheDocument(); });
      // No hardcoded demo deduction items should appear
      expect(screen.queryByText("Occupational Accident Insurance")).not.toBeInTheDocument();
      expect(screen.queryByText("ELD / Dashcam Subscription")).not.toBeInTheDocument();
    });
  });

  describe("pay model calculations", () => {
    it("salary pay model", async () => {
      const user = userEvent.setup();
      render(<Settlements loads={[makeLoad({ driverId: "ds" })]} users={[makeDriver({ id: "ds", name: "Sal", payModel: "salary", payRate: 5000 })]} />);
      await user.click(await screen.findByText("Sal"));
      await waitFor(() => { expect(screen.getByText("Gross Earnings")).toBeInTheDocument(); });
    });
    it("mileage pay model", async () => {
      const user = userEvent.setup();
      render(<Settlements loads={[makeLoad({ driverId: "dm" })]} users={[makeDriver({ id: "dm", name: "Mil", payModel: "mileage", payRate: 0.6 })]} />);
      await user.click(await screen.findByText("Mil"));
      await waitFor(() => { expect(screen.getByText("Gross Earnings")).toBeInTheDocument(); });
    });
    it("default pay model fallback", async () => {
      const user = userEvent.setup();
      render(<Settlements loads={[makeLoad({ driverId: "dd" })]} users={[makeDriver({ id: "dd", name: "Def", payModel: undefined, payRate: undefined })]} />);
      await user.click(await screen.findByText("Def"));
      await waitFor(() => { expect(screen.getByText("Gross Earnings")).toBeInTheDocument(); });
    });
  });

  describe("filteredPersonnel role filtering", () => {
    it("shows only current user for non-admin role", async () => {
      const { getCurrentUser } = await import("../../../services/authService");
      (getCurrentUser as ReturnType<typeof vi.fn>).mockReturnValue({ id: "driver-1", role: "driver", companyId: "company-1", name: "Test Driver" });
      render(<Settlements loads={[makeLoad()]} users={[makeDriver(), makeDriver({ id: "other", name: "Other" })]} />);
      await waitFor(() => { expect(screen.getByText("Test Driver")).toBeInTheDocument(); });
      expect(screen.queryByText("Other")).not.toBeInTheDocument();
    });
  });

  describe("P&L zero revenue", () => {
    it("handles zero revenue without crash", async () => {
      const user = userEvent.setup();
      render(<Settlements loads={[]} users={[makeDriver()]} />);
      await user.click(screen.getByText(/Profit & Loss/));
      await waitFor(() => { expect(screen.getByText("Gross Revenue")).toBeInTheDocument(); });
      expect(screen.getByText("Financial breakdown")).toBeInTheDocument();
    });
  });

  describe("invoice PDF generation", () => {
    it("calls generateInvoicePDF on click", async () => {
      const { generateInvoicePDF } = await import("../../../services/storageService");
      const user = userEvent.setup();
      render(<Settlements loads={[makeLoad()]} users={[makeDriver()]} />);
      await user.click(screen.getByText("Accounts Receivable (Invoicing)"));
      await waitFor(() => { expect(screen.getByText("LN-001")).toBeInTheDocument(); });
      await user.click(screen.getByTitle("Generate PDF"));
      await waitFor(() => { expect(generateInvoicePDF).toHaveBeenCalled(); });
    });
  });

  describe("no eligible personnel", () => {
    it("shows message for ineligible roles", async () => {
      const { getCurrentUser } = await import("../../../services/authService");
      (getCurrentUser as ReturnType<typeof vi.fn>).mockReturnValue({ id: "user-1", role: "admin", companyId: "company-1", name: "Admin" });
      render(<Settlements loads={[makeLoad()]} users={[{ id: "cust-1", companyId: "company-1", email: "c@t.com", name: "Customer", role: "customer" as any, onboardingStatus: "Completed", safetyScore: 0 }]} />);
      await waitFor(() => { expect(screen.getByText("No eligible personnel found")).toBeInTheDocument(); });
    });
  });

  describe("settleLoad integration", () => {
    it("calls settleLoad per load on Authorize", async () => {
      const { settleLoad } = await import("../../../services/storageService");
      const user = userEvent.setup();
      render(<Settlements loads={[makeLoad(), makeLoad({ id: "load-2", loadNumber: "LN-002", financialStatus: "Invoiced" })]} users={[makeDriver()]} />);
      await user.click(await screen.findByText("Test Driver"));
      await waitFor(() => { expect(screen.getByText(/Authorize & Pay/)).toBeInTheDocument(); });
      await user.click(screen.getByText(/Authorize & Pay/));
      await waitFor(() => { expect(settleLoad).toHaveBeenCalledWith("load-1"); expect(settleLoad).toHaveBeenCalledWith("load-2"); });
    });
  });
});
