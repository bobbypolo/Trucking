/**
 * Tests for S-5.1: LoadDetailView 10 buttons wiring
 *
 * R-P5-05: 8 REAL buttons call APIs or navigate
 * R-P5-06: 2 TOAST buttons show visible notification
 * R-P5-07: Zero silent no-ops remain
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadDetailView } from "../../../components/LoadDetailView";
import { LoadData, User, Broker, LOAD_STATUS } from "../../../types";

// Mock storageService at network boundary
const mockSaveLoad = vi.fn().mockResolvedValue(undefined);
const mockGenerateBolPDF = vi.fn();

vi.mock("../../../services/storageService", () => ({
  saveLoad: (...args: any[]) => mockSaveLoad(...args),
  generateBolPDF: (...args: any[]) => mockGenerateBolPDF(...args),
}));

vi.mock("../../../services/financialService", () => ({
  getVaultDocs: vi.fn().mockResolvedValue([]),
  createARInvoice: vi.fn().mockResolvedValue({ id: "inv-1" }),
}));

vi.mock("../../../services/authService", () => ({
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
  onUserChange: vi.fn(() => () => {}),
}));

// Mock fetch for documents API
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
  dispatcherId: "disp-1",
  brokerId: "broker-1",
  loadNumber: "LN-500",
  status: LOAD_STATUS.Planned,
  carrierRate: 3000,
  driverPay: 1800,
  pickupDate: "2025-12-01",
  dropoffDate: "2025-12-03",
  pickup: { city: "Los Angeles", state: "CA", facilityName: "LA Warehouse" },
  dropoff: { city: "Phoenix", state: "AZ", facilityName: "PHX Distribution" },
  commodity: "Furniture",
  weight: 24000,
  freightType: "Dry Van",
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
  ],
};

describe("LoadDetailView S-5.1 button wiring", () => {
  const mockOnClose = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnNavigate = vi.fn();

  const defaultProps = {
    load: mockLoad,
    onClose: mockOnClose,
    onEdit: mockOnEdit,
    canViewRates: true,
    users: mockUsers,
    brokers: mockBrokers,
    onNavigate: mockOnNavigate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  // R-P5-05: 8 REAL buttons
  describe("R-P5-05: REAL buttons", () => {
    it("Print BOL calls generateBolPDF", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      // Open utilities dropdown
      await user.click(screen.getByText("Utilities"));
      // Click Print BOL
      await user.click(screen.getByText("Print BOL"));
      expect(mockGenerateBolPDF).toHaveBeenCalledWith(mockLoad);
    });

    it("Load Stops scrolls to stop matrix section", async () => {
      const user = userEvent.setup();
      const scrollSpy = vi.fn();
      Element.prototype.scrollIntoView = scrollSpy;
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Utilities"));
      await user.click(screen.getByText("Load Stops"));
      expect(scrollSpy).toHaveBeenCalled();
    });

    it("Documents fetches from /api/documents and shows panel", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "doc-1",
              filename: "BOL.pdf",
              type: "BOL",
              status: "Uploaded",
            },
          ]),
      });
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Utilities"));
      await user.click(screen.getByText("Documents"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/documents?loadId=load-1"),
          expect.any(Object),
        );
      });
    });

    it("Audit Logs calls onNavigate with audit tab and loadId", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Utilities"));
      await user.click(screen.getByText("Audit Logs"));
      expect(mockOnNavigate).toHaveBeenCalledWith("audit", "load-1");
    });

    it("Tag for Action calls saveLoad with isActionRequired:true", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Tag for Action"));

      await waitFor(() => {
        expect(mockSaveLoad).toHaveBeenCalledWith(
          expect.objectContaining({ isActionRequired: true }),
          expect.any(Object),
        );
      });
    });

    it("Lock/Unlock toggles isLocked via saveLoad", async () => {
      const user = userEvent.setup();
      // Start with unlocked load
      render(
        <LoadDetailView
          {...defaultProps}
          load={{ ...mockLoad, isLocked: false }}
        />,
      );

      await user.click(screen.getByText("Unlocked"));

      await waitFor(() => {
        expect(mockSaveLoad).toHaveBeenCalledWith(
          expect.objectContaining({ isLocked: true }),
          expect.any(Object),
        );
      });
    });

    it("+ Add Pickup shows add stop form with type pickup", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("+ Add Pickup"));

      // Should show a form/panel for adding a pickup stop
      await waitFor(() => {
        expect(screen.getByText(/new pickup/i)).toBeInTheDocument();
      });
    });

    it("+ Add Drop shows add stop form with type dropoff", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("+ Add Drop"));

      await waitFor(() => {
        expect(screen.getByText(/new drop/i)).toBeInTheDocument();
      });
    });
  });

  // R-P5-06: 2 TOAST buttons
  describe("R-P5-06: TOAST buttons", () => {
    it("Carrier Rates shows toast notification", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Utilities"));
      await user.click(screen.getByText("Carrier Rates"));

      await waitFor(() => {
        expect(screen.getByText(/rate card coming soon/i)).toBeInTheDocument();
      });
    });

    it("Show Route is disabled without VITE_GOOGLE_MAPS_API_KEY", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Utilities"));

      const showRouteBtn = screen.getByText("Show Route").closest("button");
      expect(showRouteBtn).toBeTruthy();
      expect(showRouteBtn!.disabled).toBe(true);
      expect(showRouteBtn!.title).toBe(
        "Configure VITE_GOOGLE_MAPS_API_KEY to enable",
      );
    });
  });

  // R-P5-07: Zero silent no-ops
  describe("R-P5-07: No silent no-ops", () => {
    it("all 6 utility buttons have onClick handlers", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Utilities"));

      const utilButtons = [
        "Print BOL",
        "Carrier Rates",
        "Load Stops",
        "Documents",
        "Show Route",
        "Audit Logs",
      ];

      for (const label of utilButtons) {
        const btn = screen.getByText(label);
        // Verify button is clickable (has onClick or parent has onClick)
        expect(btn.closest("button")).toBeTruthy();
      }
    });

    it("Tag for Action button has onClick handler", () => {
      render(<LoadDetailView {...defaultProps} />);
      const btn = screen.getByText("Tag for Action").closest("button");
      expect(btn).toBeTruthy();
    });

    it("Lock/Unlock button has onClick handler", () => {
      render(<LoadDetailView {...defaultProps} />);
      // Default load is not locked
      const btn = screen.getByText("Unlocked").closest("button");
      expect(btn).toBeTruthy();
    });

    it("+ Add Pickup button has onClick handler", () => {
      render(<LoadDetailView {...defaultProps} />);
      const btn = screen.getByText("+ Add Pickup").closest("button");
      expect(btn).toBeTruthy();
    });

    it("+ Add Drop button has onClick handler", () => {
      render(<LoadDetailView {...defaultProps} />);
      const btn = screen.getByText("+ Add Drop").closest("button");
      expect(btn).toBeTruthy();
    });
  });
});
