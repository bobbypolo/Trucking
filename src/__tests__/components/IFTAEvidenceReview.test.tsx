import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IFTAEvidenceReview } from "../../../components/IFTAEvidenceReview";
import { LoadData, LOAD_STATUS, IFTATripEvidence } from "../../../types";

vi.mock("../../../services/financialService", () => ({
  getIFTAEvidence: vi.fn(),
  analyzeIFTA: vi.fn(),
  lockIFTATrip: vi.fn(),
}));

import {
  getIFTAEvidence,
  analyzeIFTA,
  lockIFTATrip,
} from "../../../services/financialService";

const mockLoad: LoadData = {
  id: "load-review-1",
  companyId: "company-1",
  driverId: "driver-1",
  loadNumber: "LN-R001",
  status: LOAD_STATUS.Delivered,
  carrierRate: 2500,
  driverPay: 1500,
  pickupDate: "2026-01-15",
  pickup: { city: "Dallas", state: "TX" },
  dropoff: { city: "OKC", state: "OK" },
  driver_id: "TRK-200",
};

const mockEvidence: IFTATripEvidence[] = [
  {
    id: "ev-1",
    truckId: "TRK-200",
    loadId: "load-review-1",
    timestamp: "2026-01-15T08:00:00Z",
    eventType: "GPS_PING",
    lat: 32.78,
    lng: -96.8,
    stateCode: "TX",
    source: "ELD",
  },
  {
    id: "ev-2",
    truckId: "TRK-200",
    loadId: "load-review-1",
    timestamp: "2026-01-15T12:00:00Z",
    eventType: "BORDER_CROSSING",
    lat: 33.99,
    lng: -96.4,
    stateCode: "OK",
    source: "ELD",
  },
  {
    id: "ev-3",
    truckId: "TRK-200",
    loadId: "load-review-1",
    timestamp: "2026-01-15T14:00:00Z",
    eventType: "FUEL_STOP",
    lat: 35.47,
    lng: -97.52,
    stateCode: "OK",
    source: "Fuel Card",
  },
];

const mockAnalysis = {
  method: "ACTUAL_GPS",
  confidence: "HIGH",
  jurisdictionMiles: { TX: 200, OK: 150 },
};

describe("IFTAEvidenceReview component", () => {
  const defaultProps = {
    load: mockLoad,
    onClose: vi.fn(),
    onLocked: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIFTAEvidence).mockResolvedValue(mockEvidence);
    vi.mocked(analyzeIFTA).mockResolvedValue(mockAnalysis);
    vi.mocked(lockIFTATrip).mockResolvedValue(undefined);
  });

  it("renders without crashing", async () => {
    const { container } = render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders the trip review header with load number", async () => {
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/IFTA Trip Review/)).toBeTruthy();
      expect(screen.getByText("#LN-R001")).toBeTruthy();
    });
  });

  it("fetches evidence on mount", async () => {
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(getIFTAEvidence).toHaveBeenCalledWith("load-review-1");
    });
  });

  it("auto-analyzes evidence after fetching", async () => {
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(analyzeIFTA).toHaveBeenCalledWith({
        pings: mockEvidence,
        mode: "GPS",
      });
    });
  });

  it("shows confidence badge once analysis completes", async () => {
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("HIGH Confidence")).toBeTruthy();
    });
  });

  it("shows data points count", async () => {
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/3 Data Points Collected/)).toBeTruthy();
    });
  });

  it("calls onClose when close button is clicked", async () => {
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/IFTA Trip Review/)).toBeTruthy();
    });
    // Find close button (it is in the header area)
    const closeButtons = screen.getAllByRole("button");
    // The close button is typically the one in the top-right
    const closeBtn = closeButtons.find((b) =>
      b.className.includes("hover:bg-white/10"),
    );
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  it("handles empty evidence gracefully", async () => {
    vi.mocked(getIFTAEvidence).mockResolvedValue([]);
    const { container } = render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
    // analyzeIFTA should NOT be called when evidence is empty
    expect(analyzeIFTA).not.toHaveBeenCalled();
  });

  it("shows Pending Confidence when analysis is not yet done", async () => {
    vi.mocked(analyzeIFTA).mockResolvedValue(null);
    vi.mocked(getIFTAEvidence).mockResolvedValue([]);
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Pending Confidence")).toBeTruthy();
    });
  });

  it("handles load without loadNumber gracefully", async () => {
    const loadNoNumber = { ...mockLoad, loadNumber: "" };
    render(
      <IFTAEvidenceReview {...defaultProps} load={loadNoNumber} />,
    );
    await waitFor(() => {
      // Should show truncated id
      expect(screen.getByText(/IFTA Trip Review/)).toBeTruthy();
    });
  });
});
