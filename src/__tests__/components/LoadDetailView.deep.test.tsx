import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadDetailView } from "../../../components/LoadDetailView";
import { LoadData, User, Broker, LOAD_STATUS } from "../../../types";

// Mock services at network boundary
const mockGetVaultDocs = vi.fn();
const mockCreateARInvoice = vi.fn();
const mockSaveLoad = vi.fn();

vi.mock("../../../services/financialService", () => ({
  getVaultDocs: (...args: unknown[]) => mockGetVaultDocs(...args),
  createARInvoice: (...args: unknown[]) => mockCreateARInvoice(...args),
}));

vi.mock("../../../services/storageService", () => ({
  saveLoad: (...args: unknown[]) => mockSaveLoad(...args),
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

describe("LoadDetailView deep coverage — lines 151-190", () => {
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
    mockGetVaultDocs.mockResolvedValue([]);
    mockCreateARInvoice.mockResolvedValue({ id: "inv-1" });
    mockSaveLoad.mockResolvedValue(undefined);
  });

  describe("toast display after invoice generation (lines 175-180)", () => {
    it("renders success toast after Initialize Settlement succeeds", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Initialize Settlement"));

      await waitFor(() => {
        const bodyText = document.body.textContent || "";
        expect(bodyText).toContain("Invoice Generated and posted to GL");
      });
    });

    it("renders error toast when Initialize Settlement fails", async () => {
      mockCreateARInvoice.mockRejectedValue(new Error("API error"));
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Initialize Settlement"));

      await waitFor(() => {
        const bodyText = document.body.textContent || "";
        expect(bodyText).toContain("Failed to generate invoice");
      });
    });

    it("toast success type is rendered for successful invoice", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Initialize Settlement"));

      await waitFor(() => {
        expect(
          screen.getByText("Invoice Generated and posted to GL"),
        ).toBeInTheDocument();
      });
    });

    it("disables Initialize Settlement button while generating", async () => {
      let resolveInvoice: (value: unknown) => void;
      mockCreateARInvoice.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveInvoice = resolve;
          }),
      );

      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      const settleBtn = screen.getByText("Initialize Settlement");
      await user.click(settleBtn);

      await waitFor(() => {
        expect(settleBtn).toBeDisabled();
      });

      // Resolve to clean up
      resolveInvoice!({ id: "inv-1" });
    });
  });

  describe("invoice generation calls createARInvoice correctly (lines 102-137)", () => {
    it("passes correct invoice structure to createARInvoice", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Initialize Settlement"));

      await waitFor(() => {
        expect(mockCreateARInvoice).toHaveBeenCalledTimes(1);
      });

      const invoiceArg = mockCreateARInvoice.mock.calls[0][0];
      expect(invoiceArg.loadId).toBe("load-1");
      expect(invoiceArg.customerId).toBe("broker-1");
      expect(invoiceArg.invoiceNumber).toBe("INV-LN-500");
      expect(invoiceArg.status).toBe("Draft");
      expect(invoiceArg.totalAmount).toBe(3000);
      expect(invoiceArg.lines).toHaveLength(1);
      expect(invoiceArg.lines[0].description).toBe("Primary Linehaul");
      expect(invoiceArg.lines[0].quantity).toBe(1);
      expect(invoiceArg.lines[0].unitPrice).toBe(3000);
    });

    it("generates invoice with correct tenant ID from current user", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Initialize Settlement"));

      await waitFor(() => {
        expect(mockCreateARInvoice).toHaveBeenCalled();
      });

      const invoiceArg = mockCreateARInvoice.mock.calls[0][0];
      expect(invoiceArg.tenantId).toBe("company-1");
    });

    it("sets due date 30 days after invoice date", async () => {
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} />);

      await user.click(screen.getByText("Initialize Settlement"));

      await waitFor(() => {
        expect(mockCreateARInvoice).toHaveBeenCalled();
      });

      const invoiceArg = mockCreateARInvoice.mock.calls[0][0];
      const invoiceDate = new Date(invoiceArg.invoiceDate);
      const dueDate = new Date(invoiceArg.dueDate);
      const daysDiff = Math.round(
        (dueDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBe(30);
    });
  });

  describe("ConfirmDialog not visible initially (line 182-190)", () => {
    it("ConfirmDialog is not visible on initial render (confirmClose=false)", () => {
      render(<LoadDetailView {...defaultProps} />);
      expect(
        screen.queryByText("Close Load Without POD"),
      ).not.toBeInTheDocument();
    });
  });

  describe("vault docs loading on mount (lines 83-90)", () => {
    it("calls getVaultDocs with load id on mount", async () => {
      render(<LoadDetailView {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetVaultDocs).toHaveBeenCalledWith({ loadId: "load-1" });
      });
    });

    it("handles vault doc loading failure gracefully without crash", async () => {
      mockGetVaultDocs.mockRejectedValue(new Error("Vault unavailable"));

      render(<LoadDetailView {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetVaultDocs).toHaveBeenCalled();
      });

      // Component should still render without crashing
      expect(screen.getByText("LN-500")).toBeInTheDocument();
    });

    it("renders vault document cards when documents are loaded", async () => {
      mockGetVaultDocs.mockResolvedValue([
        {
          id: "doc-1",
          filename: "BOL-001.pdf",
          type: "BOL",
          status: "Approved",
        },
        {
          id: "doc-2",
          filename: "POD-001.pdf",
          type: "POD",
          status: "Pending",
        },
      ]);

      render(<LoadDetailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("BOL-001.pdf")).toBeInTheDocument();
        expect(screen.getByText("POD-001.pdf")).toBeInTheDocument();
      });
    });

    it("renders vault document type labels", async () => {
      mockGetVaultDocs.mockResolvedValue([
        {
          id: "doc-1",
          filename: "BOL-001.pdf",
          type: "BOL",
          status: "Approved",
        },
      ]);

      render(<LoadDetailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("BOL")).toBeInTheDocument();
      });
    });

    it("renders vault document status badges", async () => {
      mockGetVaultDocs.mockResolvedValue([
        {
          id: "doc-1",
          filename: "BOL-001.pdf",
          type: "BOL",
          status: "Approved",
        },
      ]);

      render(<LoadDetailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Approved")).toBeInTheDocument();
      });
    });
  });

  describe("delivered status green styling (line 210-212)", () => {
    it("renders delivered status with green styling class", () => {
      const deliveredLoad = {
        ...mockLoad,
        status: "delivered" as const,
      };
      render(<LoadDetailView {...defaultProps} load={deliveredLoad} />);

      const statusBadge = screen.getByText("delivered");
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.className).toContain("green");
    });

    it("renders planned status without green styling", () => {
      render(<LoadDetailView {...defaultProps} />);

      const statusBadge = screen.getByText("planned");
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.className).toContain("blue");
    });
  });

  describe("onOpenHub integration for Log Call", () => {
    it("calls onOpenHub with messaging tab and showCallForm=true", async () => {
      const onOpenHub = vi.fn();
      const user = userEvent.setup();
      render(<LoadDetailView {...defaultProps} onOpenHub={onOpenHub} />);

      await user.click(screen.getByText("Log Call"));
      expect(onOpenHub).toHaveBeenCalledWith("messaging", true);
    });
  });
});
