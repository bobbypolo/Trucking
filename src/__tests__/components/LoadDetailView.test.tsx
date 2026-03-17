import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
}));

vi.mock("../../../services/authService", () => ({
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
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
  {
    id: "disp-1",
    name: "Bob Dispatch",
    role: "dispatcher",
    companyId: "c1",
    email: "b@t.com",
    onboardingStatus: "Completed",
    safetyScore: 95,
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
  dispatcherId: "disp-1",
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
  legs: [
    {
      id: "leg-1",
      type: "Pickup",
      location: {
        city: "Los Angeles",
        state: "CA",
        facilityName: "LA Warehouse",
        address: "100 Main St",
        zip: "90001",
      },
      date: "2025-12-01",
      appointmentTime: "08:00",
      completed: false,
      pallets: 12,
      weight: 24000,
      sealNumber: "S-77281",
    },
    {
      id: "leg-2",
      type: "Dropoff",
      location: {
        city: "Phoenix",
        state: "AZ",
        facilityName: "PHX Distribution",
        address: "200 Oak Ave",
        zip: "85001",
      },
      date: "2025-12-03",
      appointmentTime: "16:00",
      completed: false,
      pallets: 12,
      weight: 24000,
      sealNumber: "S-77281",
    },
  ],
};

describe("LoadDetailView component", () => {
  const defaultProps = {
    load: mockLoad,
    onClose: vi.fn(),
    onEdit: vi.fn(),
    canViewRates: true,
    users: mockUsers,
    brokers: mockBrokers,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { container } = render(<LoadDetailView {...defaultProps} />);
      expect(container).toBeTruthy();
    });

    it("renders the manifest workspace header with load number", () => {
      render(<LoadDetailView {...defaultProps} />);
      const text = document.body.textContent || "";
      expect(text).toContain("LN-500");
    });

    it("renders Back button", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("Back")).toBeInTheDocument();
    });

    it("renders status badge", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText(LOAD_STATUS.Planned)).toBeInTheDocument();
    });

    it("renders Reference Matrix section", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("Reference Matrix")).toBeInTheDocument();
    });

    it("renders Relationships section", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("Relationships")).toBeInTheDocument();
    });

    it("renders Settlement section", () => {
      render(<LoadDetailView {...defaultProps} />);
      const text = document.body.textContent || "";
      expect(text).toContain("Settlement");
    });

    it("renders Stop Matrix section", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText(/Stop Matrix/)).toBeInTheDocument();
    });

    it("renders Digital Artifacts Matrix section", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText(/Digital Artifacts/)).toBeInTheDocument();
    });
  });

  describe("load data display", () => {
    it("displays the load number", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("LN-500")).toBeInTheDocument();
    });

    it("displays commodity", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("Furniture")).toBeInTheDocument();
    });

    it("displays equipment type", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("DRY VAN")).toBeInTheDocument();
    });

    it("displays broker name", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
    });

    it("displays driver name", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("John Driver")).toBeInTheDocument();
    });

    it("displays dispatcher name", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("Bob Dispatch")).toBeInTheDocument();
    });

    it("displays truck number", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("T-101")).toBeInTheDocument();
    });

    it("displays trailer number", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("TRL-55")).toBeInTheDocument();
    });
  });

  describe("financial data display", () => {
    it("displays carrier rate", () => {
      render(<LoadDetailView {...defaultProps} />);
      const text = document.body.textContent || "";
      expect(text).toContain("3,000");
    });

    it("displays driver pay", () => {
      render(<LoadDetailView {...defaultProps} />);
      const text = document.body.textContent || "";
      expect(text).toContain("1,800");
    });

    it("displays profit margin ($1,200)", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("$1,200")).toBeInTheDocument();
    });

    it("displays margin percentage (40.0%)", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("40.0%")).toBeInTheDocument();
    });

    it("shows negative margin for unprofitable loads", () => {
      const unprofitable = { ...mockLoad, carrierRate: 500, driverPay: 800 };
      render(<LoadDetailView {...defaultProps} load={unprofitable} />);
      const text = document.body.textContent || "";
      expect(text).toContain("-300");
    });
  });

  describe("legs/stops display", () => {
    it("displays Pickup leg type", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("Pickup")).toBeInTheDocument();
    });

    it("displays Dropoff leg type", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("Dropoff")).toBeInTheDocument();
    });

    it("displays facility names", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("LA Warehouse")).toBeInTheDocument();
      expect(screen.getByText("PHX Distribution")).toBeInTheDocument();
    });

    it("displays seal numbers", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getAllByText("S-77281").length).toBeGreaterThanOrEqual(1);
    });

    it("displays pallet counts", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);
    });

    it("displays weight values", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getAllByText("24,000").length).toBeGreaterThanOrEqual(1);
    });

    it("renders default legs from pickup/dropoff when no legs array", () => {
      const loadNoLegs = { ...mockLoad, legs: undefined };
      render(<LoadDetailView {...defaultProps} load={loadNoLegs} />);
      expect(screen.getByText("Pickup")).toBeInTheDocument();
      expect(screen.getByText("Dropoff")).toBeInTheDocument();
    });
  });

  describe("unassigned fields", () => {
    it("shows UNASSIGNED for missing driver", () => {
      const noDriver = { ...mockLoad, driverId: "nonexistent" };
      render(<LoadDetailView {...defaultProps} load={noDriver} />);
      expect(screen.getByText("-- UNASSIGNED --")).toBeInTheDocument();
    });

    it("shows UNASSIGNED for missing dispatcher", () => {
      const noDisp = { ...mockLoad, dispatcherId: "nonexistent" };
      render(<LoadDetailView {...defaultProps} load={noDisp} />);
      expect(screen.getByText("-- UNASSIGNED --")).toBeInTheDocument();
    });

    it("shows --- for missing broker", () => {
      const noBroker = { ...mockLoad, brokerId: "nonexistent" };
      render(<LoadDetailView {...defaultProps} load={noBroker} />);
      expect(screen.getAllByText("---").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("interactive elements", () => {
    it("calls onClose when Back is clicked", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);
      await user.click(screen.getByText("Back"));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Discard View is clicked", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);
      await user.click(screen.getByText("Discard View"));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onEdit when Authorize Manifest Edits is clicked", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);
      await user.click(screen.getByText("Authorize Manifest Edits"));
      expect(defaultProps.onEdit).toHaveBeenCalledWith(mockLoad);
    });

    it("renders Utilities dropdown", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);
      await user.click(screen.getByText("Utilities"));
      expect(screen.getByText("Print BOL")).toBeInTheDocument();
      expect(screen.getByText("Audit Logs")).toBeInTheDocument();
    });

    it("renders Tag for Action button", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("Tag for Action")).toBeInTheDocument();
    });

    it("renders Initialize Settlement button", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(
        screen.getByText("Initialize Settlement"),
      ).toBeInTheDocument();
    });
  });

  describe("lock state display", () => {
    it("shows Locked state for locked load", () => {
      const lockedLoad = { ...mockLoad, isLocked: true };
      render(<LoadDetailView {...defaultProps} load={lockedLoad} />);
      expect(screen.getByText("Locked")).toBeInTheDocument();
    });

    it("shows Unlocked state for unlocked load", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText("Unlocked")).toBeInTheDocument();
    });
  });

  describe("delivered status display", () => {
    it("displays delivered status with green styling", () => {
      const deliveredLoad = { ...mockLoad, status: "delivered" as const };
      render(<LoadDetailView {...defaultProps} load={deliveredLoad} />);
      expect(screen.getByText("delivered")).toBeInTheDocument();
    });
  });

  describe("invoice generation", () => {
    it("calls createARInvoice when Initialize Settlement is clicked", async () => {
      const { createARInvoice } = await import(
        "../../../services/financialService"
      );
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);
      await user.click(screen.getByText("Initialize Settlement"));
      await waitFor(() => {
        expect(createARInvoice).toHaveBeenCalled();
      });
    });
  });

  describe("hub callback", () => {
    it("calls onOpenHub when Log Call is clicked", async () => {
      const onOpenHub = vi.fn();
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} onOpenHub={onOpenHub} />);
      await user.click(screen.getByText("Log Call"));
      expect(onOpenHub).toHaveBeenCalledWith("messaging", true);
    });
  });

  describe("vault documents", () => {
    it("renders Inject Electronic Records placeholder", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(
        screen.getByText("Inject Electronic Records"),
      ).toBeInTheDocument();
    });

    it("shows BOL, POD, RATE CON, HAZMAT document types", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(screen.getByText(/BOL, POD, RATE CON, HAZMAT/)).toBeInTheDocument();
    });
  });

  describe("partial load data", () => {
    it("renders with minimal load data", () => {
      const minimal: LoadData = {
        id: "m1",
        companyId: "c1",
        driverId: "",
        loadNumber: "MIN-1",
        status: "draft",
        carrierRate: 0,
        driverPay: 0,
        pickupDate: "",
        pickup: { city: "", state: "" },
        dropoff: { city: "", state: "" },
      };
      const { container } = render(
        <LoadDetailView {...defaultProps} load={minimal} />,
      );
      expect(container).toBeTruthy();
    });
  });
});
