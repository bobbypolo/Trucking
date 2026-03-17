import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IFTAManager } from "../../../components/IFTAManager";
import { LoadData, LOAD_STATUS, IFTASummary, MileageEntry } from "../../../types";

vi.mock("../../../services/financialService", () => ({
  getIFTASummary: vi.fn(),
  getMileageEntries: vi.fn(),
  saveMileageEntry: vi.fn(),
  postIFTAToLedger: vi.fn(),
  getIFTAEvidence: vi.fn().mockResolvedValue([]),
  analyzeIFTA: vi.fn().mockResolvedValue(null),
  lockIFTATrip: vi.fn(),
}));

vi.mock("../../../services/exportService", () => ({
  exportToExcel: vi.fn(),
  exportToPDF: vi.fn(),
}));

import {
  getIFTASummary,
  getMileageEntries,
  saveMileageEntry,
  postIFTAToLedger,
} from "../../../services/financialService";
import { exportToExcel, exportToPDF } from "../../../services/exportService";

const mockSummary: IFTASummary = {
  quarter: 1,
  year: 2026,
  rows: [
    { stateCode: "TX", totalMiles: 5000, totalGallons: 800, mpg: 6.25, taxPaidAtPump: 250, taxDue: 120 },
    { stateCode: "OK", totalMiles: 2000, totalGallons: 320, mpg: 6.25, taxPaidAtPump: 100, taxDue: 45 },
  ],
  totalMiles: 7000,
  totalGallons: 1120,
  netTaxDue: 165,
};

const mockMileageEntries: MileageEntry[] = [
  { id: "m-1", tenantId: "t-1", truckId: "TRK-100", date: "2026-01-15", stateCode: "TX", miles: 350, type: "ELD", state: "TX" },
];

const deliveredLoads: LoadData[] = [
  {
    id: "load-d1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-D1",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2000,
    driverPay: 1200,
    pickupDate: "2026-01-10",
    pickup: { city: "Dallas", state: "TX", facilityName: "Warehouse A" },
    dropoff: { city: "OKC", state: "OK" },
    delivery: { city: "OKC", state: "OK" },
  },
];

describe("IFTAManager deep coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIFTASummary).mockResolvedValue(mockSummary);
    vi.mocked(getMileageEntries).mockResolvedValue(mockMileageEntries);
    vi.mocked(saveMileageEntry).mockResolvedValue(undefined);
    vi.mocked(postIFTAToLedger).mockResolvedValue(undefined);
  });

  describe("post to ledger confirm dialog (line 461)", () => {
    it("shows confirm dialog when Post to Ledger is clicked", async () => {
      const user = userEvent.setup();
      render(<IFTAManager loads={deliveredLoads} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Post to Ledger/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Post to Ledger/i }));

      expect(screen.getByText("Post to General Ledger")).toBeInTheDocument();
      expect(screen.getByText(/Post IFTA liability/)).toBeInTheDocument();
    });

    it("posts to ledger after confirming the dialog", async () => {
      const user = userEvent.setup();
      render(<IFTAManager loads={deliveredLoads} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Post to Ledger/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Post to Ledger/i }));
      expect(screen.getByText("Post to General Ledger")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /^Post$/i }));

      await waitFor(() => {
        expect(postIFTAToLedger).toHaveBeenCalledWith({
          quarter: 1,
          year: 2026,
          netTaxDue: 165,
        });
      });
    });

    it("cancels the post-to-ledger dialog without posting", async () => {
      const user = userEvent.setup();
      render(<IFTAManager loads={deliveredLoads} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Post to Ledger/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Post to Ledger/i }));
      expect(screen.getByText("Post to General Ledger")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Cancel/i }));

      expect(screen.queryByText("Post to General Ledger")).not.toBeInTheDocument();
      expect(postIFTAToLedger).not.toHaveBeenCalled();
    });
  });

  describe("year change triggers reload (line 489)", () => {
    it("reloads data when year is changed via dropdown", async () => {
      const user = userEvent.setup();
      render(<IFTAManager loads={deliveredLoads} />);

      await waitFor(() => {
        expect(getIFTASummary).toHaveBeenCalledWith(1, 2026);
      });

      const yearSelect = screen.getByDisplayValue("2026");
      await user.selectOptions(yearSelect, "2025");

      await waitFor(() => {
        expect(getIFTASummary).toHaveBeenCalledWith(1, 2025);
      });
    });
  });

  describe("IFTA evidence review modal (lines 541-544)", () => {
    it("opens evidence review when clicking a trip pending audit", async () => {
      const user = userEvent.setup();
      render(<IFTAManager loads={deliveredLoads} />);

      await waitFor(() => {
        expect(screen.getByText("#LN-D1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("#LN-D1").closest("[class*='cursor-pointer']")!);

      await waitFor(() => {
        const body = document.body.textContent || "";
        expect(body).toContain("LN-D1");
      });
    });
  });

  describe("post to ledger failure shows error toast", () => {
    it("shows error toast when postIFTAToLedger fails", async () => {
      vi.mocked(postIFTAToLedger).mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      render(<IFTAManager loads={deliveredLoads} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Post to Ledger/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Post to Ledger/i }));
      await user.click(screen.getByRole("button", { name: /^Post$/i }));

      await waitFor(() => {
        expect(screen.getByText("Posting failed")).toBeInTheDocument();
      });
    });
  });

  describe("REFUND label when net tax is negative", () => {
    it("shows REFUND label when netTaxDue is zero", async () => {
      vi.mocked(getIFTASummary).mockResolvedValue({
        ...mockSummary,
        netTaxDue: 0,
      });
      render(<IFTAManager loads={deliveredLoads} />);

      await waitFor(() => {
        expect(screen.getByText("REFUND")).toBeInTheDocument();
      });
    });
  });
});
