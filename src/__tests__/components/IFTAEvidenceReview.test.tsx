import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    await waitFor(() => expect(container).toBeInTheDocument());
  });

  it("renders the trip review header with load number", async () => {
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/IFTA Trip Review/)).toBeInTheDocument();
      expect(screen.getByText("#LN-R001")).toBeInTheDocument();
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
      expect(screen.getByText("HIGH Confidence")).toBeInTheDocument();
    });
  });

  it("shows data points count", async () => {
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/3 Data Points Collected/)).toBeInTheDocument();
    });
  });

  it("calls onClose when close button in header is clicked", async () => {
    const user = userEvent.setup();
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/IFTA Trip Review/)).toBeInTheDocument();
    });
    // The header close button has hover:bg-white/10 class and the Lock icon
    const headerCloseBtn = screen.getAllByRole("button").find((b) =>
      b.className.includes("hover:bg-white/10"),
    );
    expect(headerCloseBtn).toBeInTheDocument();
    await user.click(headerCloseBtn!);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose when Discard Changes footer button is clicked", async () => {
    const user = userEvent.setup();
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/IFTA Trip Review/)).toBeInTheDocument();
    });
    const discardBtn = screen.getByRole("button", { name: /Discard Changes/i });
    expect(discardBtn).toBeInTheDocument();
    await user.click(discardBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("handles empty evidence gracefully", async () => {
    vi.mocked(getIFTAEvidence).mockResolvedValue([]);
    const { container } = render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
    // analyzeIFTA should NOT be called when evidence is empty
    expect(analyzeIFTA).not.toHaveBeenCalled();
  });

  it("shows Pending Confidence when analysis is not yet done", async () => {
    vi.mocked(analyzeIFTA).mockResolvedValue(null);
    vi.mocked(getIFTAEvidence).mockResolvedValue([]);
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Pending Confidence")).toBeInTheDocument();
    });
  });

  it("handles load without loadNumber gracefully", async () => {
    const loadNoNumber = { ...mockLoad, loadNumber: "" };
    render(
      <IFTAEvidenceReview {...defaultProps} load={loadNoNumber} />,
    );
    await waitFor(() => {
      // Should show truncated id
      expect(screen.getByText(/IFTA Trip Review/)).toBeInTheDocument();
    });
  });

  it("locks trip when attested and Lock button is clicked", async () => {
    const user = userEvent.setup();
    render(<IFTAEvidenceReview {...defaultProps} />);

    // Wait for analysis to complete
    await waitFor(() => {
      expect(screen.getByText("HIGH Confidence")).toBeInTheDocument();
    });

    // Check the attestation checkbox
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    await user.click(checkbox);

    // Now click the Lock Trip button
    const lockBtn = screen.getByRole("button", { name: /Lock Trip for Audit/i });
    expect(lockBtn).toBeInTheDocument();
    expect(lockBtn).not.toBeDisabled();
    await user.click(lockBtn);

    await waitFor(() => {
      expect(lockIFTATrip).toHaveBeenCalledTimes(1);
    });
    const auditArg = vi.mocked(lockIFTATrip).mock.calls[0][0];
    expect(auditArg).toMatchObject({
      loadId: "load-review-1",
      method: "ACTUAL_GPS",
      confidenceLevel: "HIGH",
      status: "LOCKED",
    });
    expect(defaultProps.onLocked).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("Lock Trip button is disabled when not attested", async () => {
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("HIGH Confidence")).toBeInTheDocument();
    });
    const lockBtn = screen.getByRole("button", { name: /Lock Trip for Audit/i });
    expect(lockBtn).toBeDisabled();
  });

  it("displays jurisdiction miles from analysis", async () => {
    render(<IFTAEvidenceReview {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("200.00 MI")).toBeInTheDocument();
      expect(screen.getByText("150.00 MI")).toBeInTheDocument();
    });
  });
});
