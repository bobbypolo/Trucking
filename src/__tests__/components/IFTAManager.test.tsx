import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IFTAManager } from "../../../components/IFTAManager";
import { LoadData, LOAD_STATUS, IFTASummary, MileageEntry } from "../../../types";

// Mock services
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
    { stateCode: "AR", totalMiles: 1500, totalGallons: 240, mpg: 6.25, taxPaidAtPump: 80, taxDue: 30 },
  ],
  totalMiles: 8500,
  totalGallons: 1360,
  netTaxDue: 195,
};

const mockMileageEntries: MileageEntry[] = [
  { id: "m-1", tenantId: "t-1", truckId: "TRK-100", date: "2026-01-15", stateCode: "TX", miles: 350, type: "ELD", state: "TX" },
  { id: "m-2", tenantId: "t-1", truckId: "TRK-100", date: "2026-01-16", stateCode: "OK", miles: 200, type: "Manual", state: "OK" },
];

const mockDeliveredLoads: LoadData[] = [
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

const mockEmptyLoads: LoadData[] = [
  {
    id: "load-e1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-E1",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 1500,
    driverPay: 900,
    pickupDate: "2026-01-10",
    pickup: { city: "Houston", state: "TX" },
    dropoff: { city: "Phoenix", state: "AZ" },
  },
];

describe("IFTAManager component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIFTASummary).mockResolvedValue(mockSummary);
    vi.mocked(getMileageEntries).mockResolvedValue(mockMileageEntries);
    vi.mocked(saveMileageEntry).mockResolvedValue(undefined);
    vi.mocked(postIFTAToLedger).mockResolvedValue(undefined);
  });

  it("renders without crashing", async () => {
    const { container } = render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders the IFTA Multi-State Compliance header", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByText(/IFTA Multi-State Compliance/)).toBeTruthy();
    });
  });

  it("renders quarter selector buttons", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByText("Q1")).toBeTruthy();
      expect(screen.getByText("Q2")).toBeTruthy();
      expect(screen.getByText("Q3")).toBeTruthy();
      expect(screen.getByText("Q4")).toBeTruthy();
    });
  });

  it("calls getIFTASummary on mount", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(getIFTASummary).toHaveBeenCalledWith(1, 2026);
    });
  });

  it("calls getMileageEntries on mount", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(getMileageEntries).toHaveBeenCalled();
    });
  });

  it("displays KPI cards when summary is loaded", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByText("Total Fleet Miles")).toBeTruthy();
      expect(screen.getByText("Fuel Consumed")).toBeTruthy();
      expect(screen.getByText("Fleet Average MPG")).toBeTruthy();
      expect(screen.getByText("Net Tax Position")).toBeTruthy();
    });
  });

  it("displays total miles from summary", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByText("8,500")).toBeTruthy();
    });
  });

  it("displays total gallons from summary", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByText("1,360")).toBeTruthy();
    });
  });

  it("displays fleet average MPG", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      // 8500 / 1360 = 6.25 - appears in KPI card and jurisdiction rows
      const mpgElements = screen.getAllByText("6.25");
      expect(mpgElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("displays net tax position", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByText("$195")).toBeTruthy();
    });
  });

  it("shows PAYABLE label when net tax is positive", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByText("PAYABLE")).toBeTruthy();
    });
  });

  it("renders jurisdiction worksheet table with state rows", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      // State codes appear in KPI cards and jurisdiction rows
      const txElements = screen.getAllByText("TX");
      expect(txElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("OK").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("AR").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows trips pending audit section for delivered loads", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByText("Trips Pending Audit")).toBeTruthy();
    });
  });

  it("shows load numbers in trips pending audit", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByText("#LN-D1")).toBeTruthy();
    });
  });

  it("shows empty message when no delivered loads", async () => {
    render(<IFTAManager loads={mockEmptyLoads} />);
    await waitFor(() => {
      expect(screen.getByText(/No trips currently pending audit/)).toBeTruthy();
    });
  });

  it("renders manual mileage section", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByText(/Manual Mileage Log/)).toBeTruthy();
    });
  });

  it("displays mileage entries", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      // TX appears in multiple places (jurisdiction rows + mileage entries)
      expect(screen.getAllByText("TX").length).toBeGreaterThanOrEqual(1);
      // TRK-100 should appear in mileage entries
      expect(screen.getAllByText("TRK-100").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Add Manual Entry button", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Add Manual Entry/i })).toBeTruthy();
    });
  });

  it("opens mileage form when Add Manual Entry is clicked", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Add Manual Entry/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Add Manual Entry/i }));
    expect(screen.getByText("Log Manual Mileage")).toBeTruthy();
    expect(screen.getByText("Submit corrections or non-ELD trips")).toBeTruthy();
  });

  it("renders form fields in mileage modal", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Add Manual Entry/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Add Manual Entry/i }));
    expect(screen.getByText("Truck ID")).toBeTruthy();
    expect(screen.getByText("State Code")).toBeTruthy();
    expect(screen.getByText("Miles")).toBeTruthy();
  });

  it("can close mileage modal with Cancel", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Add Manual Entry/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Add Manual Entry/i }));
    expect(screen.getByText("Log Manual Mileage")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.queryByText("Log Manual Mileage")).toBeNull();
  });

  it("changes quarter when quarter button is clicked", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(getIFTASummary).toHaveBeenCalledWith(1, 2026);
    });
    fireEvent.click(screen.getByText("Q2"));
    await waitFor(() => {
      expect(getIFTASummary).toHaveBeenCalledWith(2, 2026);
    });
  });

  it("renders export buttons", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Export Audit File/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Generate 101-IFTA/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Post to Ledger/i })).toBeTruthy();
    });
  });

  it("renders Generate Quarterly Package button", async () => {
    render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Generate Quarterly Package/i })).toBeTruthy();
    });
  });

  it("handles API failure gracefully", async () => {
    vi.mocked(getIFTASummary).mockRejectedValue(new Error("Network error"));
    vi.mocked(getMileageEntries).mockRejectedValue(new Error("Network error"));
    const { container } = render(<IFTAManager loads={mockDeliveredLoads} />);
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });
});
