import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadDetailView } from "../../../components/LoadDetailView";
import { LoadData, User, Broker, LOAD_STATUS } from "../../../types";

// Mock services at network boundary
vi.mock("../../../services/financialService", () => ({
  getVaultDocs: vi.fn().mockResolvedValue([]),
  createARInvoice: vi.fn().mockResolvedValue({ id: "inv-1" }),
}));

vi.mock("../../../services/storageService", () => ({
  saveLoad: vi.fn().mockResolvedValue(undefined),
  generateBolPDF: vi.fn(),
}));

vi.mock("../../../services/storage/vault", () => ({
  getDocuments: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ documents: [] }),
  },
}));

vi.mock("../../../services/authService", () => ({
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
  onUserChange: vi.fn(() => () => {}),
}));

vi.mock("../../../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    id: "user-1",
    name: "Admin",
    role: "admin",
    companyId: "company-1",
  }),
}));

vi.mock("../../../hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

const mockUsers: User[] = [
  {
    id: "driver-1",
    name: "John Driver",
    role: "driver",
    companyId: "c1",
    email: "j@t.com",
    onboardingStatus: "Completed",
    safetyScore: 90,
  },
];

const mockBrokers: Broker[] = [
  {
    id: "broker-1",
    name: "Alpha Logistics",
    mcNumber: "MC-123",
    isShared: true,
    clientType: "Broker",
    approvedChassis: [],
  },
];

const mockLoad: LoadData = {
  id: "load-1",
  companyId: "company-1",
  driverId: "driver-1",
  dispatcherId: null as any,
  brokerId: "broker-1",
  loadNumber: "LN-500",
  status: LOAD_STATUS.Planned,
  carrierRate: 3000,
  driverPay: 1800,
  pickupDate: "2025-12-01",
  dropoffDate: "2025-12-03",
  pickup: { city: "Los Angeles", state: "CA" },
  dropoff: { city: "Phoenix", state: "AZ" },
  commodity: "Furniture",
  freightType: "Dry Van",
  truckNumber: "T-101",
  trailerNumber: "TRL-55",
  legs: [],
};

describe("LoadDetailView back button (STORY-002 Phase 2)", () => {
  const baseProps = () => ({
    load: mockLoad,
    onClose: vi.fn(),
    onEdit: vi.fn(),
    canViewRates: true,
    users: mockUsers,
    brokers: mockBrokers,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tests R-P2-01
  it("renders a visible 'Back to Load Board' button with ArrowLeft icon above the manifest header", () => {
    const props = baseProps();
    render(<LoadDetailView {...props} />);

    const backButton = screen.getByRole("button", {
      name: /back to load board/i,
    });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveTextContent("Back to Load Board");

    // ArrowLeft icon from lucide-react should be present (rendered as SVG with specific class)
    const icon = backButton.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("lucide-arrow-left");

    // The button should appear above the "Manifest Workspace" header in DOM order
    const manifestHeader = screen.getByText(/Manifest Workspace/i);
    expect(manifestHeader).toBeInTheDocument();
    // compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING (4) means manifestHeader follows backButton
    const position = backButton.compareDocumentPosition(manifestHeader);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  // Tests R-P2-02
  it("calls the onClose prop exactly once when the back button is clicked", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<LoadDetailView {...props} />);

    const backButton = screen.getByRole("button", {
      name: /back to load board/i,
    });
    await user.click(backButton);

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
