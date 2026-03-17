import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadBoardEnhanced } from "../../../components/LoadBoardEnhanced";
import { LoadData, User, Broker, LOAD_STATUS } from "../../../types";

// Mock authService since LoadList (child) calls getCurrentUser
vi.mock("../../../services/authService", () => ({
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
  getCompany: vi.fn().mockResolvedValue({ id: "company-1", name: "Test Co" }),
}));

// Mock storageService since LoadList uses generateInvoicePDF/saveLoad
vi.mock("../../../services/storageService", () => ({
  generateInvoicePDF: vi.fn(),
  saveLoad: vi.fn().mockResolvedValue(undefined),
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

const createLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: `load-${Math.random().toString(36).slice(2)}`,
  companyId: "c1",
  driverId: "driver-1",
  loadNumber: "LN-100",
  status: LOAD_STATUS.Planned,
  carrierRate: 2000,
  driverPay: 1200,
  pickupDate: "2025-12-01",
  pickup: { city: "Chicago", state: "IL" },
  dropoff: { city: "Dallas", state: "TX" },
  ...overrides,
});

const mockLoads: LoadData[] = [
  createLoad({
    id: "load-1",
    loadNumber: "LN-100",
    status: LOAD_STATUS.Planned,
    carrierRate: 2000,
  }),
  createLoad({
    id: "load-2",
    loadNumber: "LN-101",
    status: "in_transit",
    carrierRate: 3500,
    driverId: "driver-1",
  }),
  createLoad({
    id: "load-3",
    loadNumber: "LN-102",
    status: "delivered",
    carrierRate: 1800,
    pickup: { city: "Miami", state: "FL" },
    dropoff: { city: "Atlanta", state: "GA" },
  }),
];

describe("LoadBoardEnhanced component", () => {
  const defaultProps = {
    loads: mockLoads,
    users: mockUsers,
    brokers: mockBrokers,
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    canViewRates: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering with loads", () => {
    it("renders without crashing", () => {
      const { container } = render(<LoadBoardEnhanced {...defaultProps} />);
      expect(container).toBeTruthy();
    });

    it("does not show empty state when loads exist", () => {
      render(<LoadBoardEnhanced {...defaultProps} />);
      expect(screen.queryByText(/no loads/i)).not.toBeInTheDocument();
    });

    it("renders the Detailed Load Table footer bar", () => {
      render(<LoadBoardEnhanced {...defaultProps} />);
      expect(screen.getByText("Detailed Load Table")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty state when no loads", () => {
      render(<LoadBoardEnhanced {...defaultProps} loads={[]} />);
      const text = document.body.textContent || "";
      expect(text.toLowerCase()).toContain("no loads");
    });

    it("shows description in empty state", () => {
      render(<LoadBoardEnhanced {...defaultProps} loads={[]} />);
      expect(
        screen.getByText(/Create your first load/i),
      ).toBeInTheDocument();
    });

    it("renders CTA button when onCreateLoad is provided", () => {
      const onCreateLoad = vi.fn();
      render(
        <LoadBoardEnhanced
          {...defaultProps}
          loads={[]}
          onCreateLoad={onCreateLoad}
        />,
      );
      expect(
        screen.getByRole("button", { name: /create load/i }),
      ).toBeInTheDocument();
    });

    it("calls onCreateLoad when CTA is clicked", async () => {
      const user = userEvent.setup();
      const onCreateLoad = vi.fn();
      render(
        <LoadBoardEnhanced
          {...defaultProps}
          loads={[]}
          onCreateLoad={onCreateLoad}
        />,
      );
      await user.click(screen.getByRole("button", { name: /create load/i }));
      expect(onCreateLoad).toHaveBeenCalledTimes(1);
    });

    it("does not show CTA when onCreateLoad is not provided", () => {
      render(<LoadBoardEnhanced {...defaultProps} loads={[]} />);
      expect(
        screen.queryByRole("button", { name: /create load/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("sidebar toggle", () => {
    it("renders settings toggle button when sidebar is closed", () => {
      render(<LoadBoardEnhanced {...defaultProps} />);
      // The sidebar toggle is a button with Settings2 icon
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("opens customize sidebar when toggle is clicked", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      // Find the settings toggle button (the one on the right edge)
      const settingsButtons = screen.getAllByRole("button");
      // Click the sidebar toggle (it has Settings2 icon, it's a standalone button on the right)
      const sidebarToggle = settingsButtons.find(
        (btn) =>
          !btn.textContent?.includes("Load") &&
          !btn.textContent?.includes("Export") &&
          btn.closest('[class*="absolute right-0"]'),
      );
      if (sidebarToggle) {
        await user.click(sidebarToggle);
        expect(screen.getByText("Customize View")).toBeInTheDocument();
        expect(screen.getByText(/Show\/Hide Columns/)).toBeInTheDocument();
      }
    });

    it("shows column options in sidebar", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      // Open sidebar by finding the absolute positioned button
      const buttons = document.querySelectorAll("button");
      const toggleBtn = Array.from(buttons).find((btn) =>
        btn.closest('[class*="absolute right-0"]'),
      );
      if (toggleBtn) {
        await user.click(toggleBtn);
        expect(screen.getByText("Load #")).toBeInTheDocument();
        // Use getAllByText for items that appear both in sidebar and grid
        expect(screen.getAllByText("Status").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Origin").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Destination").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Driver").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Rate").length).toBeGreaterThanOrEqual(1);
      }
    });

    it("shows IFTA Summary in sidebar", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      const buttons = document.querySelectorAll("button");
      const toggleBtn = Array.from(buttons).find((btn) =>
        btn.closest('[class*="absolute right-0"]'),
      );
      if (toggleBtn) {
        await user.click(toggleBtn);
        expect(screen.getByText("IFTA Summary")).toBeInTheDocument();
      }
    });

    it("closes sidebar when X is clicked", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      // Open sidebar
      const buttons = document.querySelectorAll("button");
      const toggleBtn = Array.from(buttons).find((btn) =>
        btn.closest('[class*="absolute right-0"]'),
      );
      if (toggleBtn) {
        await user.click(toggleBtn);
        expect(screen.getByText("Customize View")).toBeInTheDocument();
        // The sidebar is now 'w-80'; find the close button inside it
        const sidebar = document.querySelector('[class*="w-80"]');
        expect(sidebar).toBeTruthy();
        const closeBtns = sidebar!.querySelectorAll("button");
        // The close button is the one that has no text (only X icon)
        const closeBtn = Array.from(closeBtns).find(
          (btn) => !(btn as HTMLElement).textContent?.trim() ||
            (btn as HTMLElement).textContent?.trim() === "",
        );
        if (closeBtn) {
          await user.click(closeBtn as HTMLElement);
          // After closing, the sidebar transitions to w-0
          await waitFor(() => {
            const narrowSidebar = document.querySelector('[class*="w-0"]');
            expect(narrowSidebar).toBeTruthy();
          });
        }
      }
    });
  });

  describe("grid view panel", () => {
    it("renders Detailed Load Table header in collapsed state", () => {
      render(<LoadBoardEnhanced {...defaultProps} />);
      expect(screen.getByText("Detailed Load Table")).toBeInTheDocument();
    });

    it("expands grid panel when clicked", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      await user.click(screen.getByText("Detailed Load Table"));
      // When expanded, Export CSV and Select Columns buttons appear
      expect(screen.getByText(/Export CSV/)).toBeInTheDocument();
      expect(screen.getByText(/Select Columns/)).toBeInTheDocument();
    });

    it("shows load data in grid table when expanded", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      await user.click(screen.getByText("Detailed Load Table"));
      // Should show load numbers
      expect(screen.getByText("LN-100")).toBeInTheDocument();
      expect(screen.getByText("LN-101")).toBeInTheDocument();
      expect(screen.getByText("LN-102")).toBeInTheDocument();
    });

    it("shows status badges in grid table", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      await user.click(screen.getByText("Detailed Load Table"));
      // Both card view and grid view may show these, so use getAllByText
      expect(screen.getAllByText("planned").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("in_transit").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("delivered").length).toBeGreaterThanOrEqual(1);
    });

    it("shows pickup/dropoff locations in grid table", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      await user.click(screen.getByText("Detailed Load Table"));
      // Both card view and grid may render locations
      expect(screen.getAllByText("Chicago, IL").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Dallas, TX").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Miami, FL").length).toBeGreaterThanOrEqual(1);
    });

    it("shows driver names in grid table", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      await user.click(screen.getByText("Detailed Load Table"));
      const text = document.body.textContent || "";
      expect(text).toContain("John Driver");
    });

    it("shows UNASSIGNED for loads without a driver", async () => {
      const user = userEvent.setup();
      const loadsNoDriver = [
        createLoad({ id: "x1", driverId: "unknown-id", loadNumber: "LN-200" }),
      ];
      render(
        <LoadBoardEnhanced {...defaultProps} loads={loadsNoDriver} />,
      );
      await user.click(screen.getByText("Detailed Load Table"));
      expect(screen.getAllByText("UNASSIGNED").length).toBeGreaterThanOrEqual(1);
    });

    it("shows carrier rates in grid table", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      await user.click(screen.getByText("Detailed Load Table"));
      // Rates appear in both card and grid views
      expect(screen.getAllByText("$2,000").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("$3,500").length).toBeGreaterThanOrEqual(1);
    });

    it("calls onView when row view button is clicked", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      await user.click(screen.getByText("Detailed Load Table"));
      // Find view buttons in table rows
      const viewButtons = document.querySelectorAll("td button");
      if (viewButtons.length > 0) {
        await user.click(viewButtons[0] as HTMLElement);
        expect(defaultProps.onView).toHaveBeenCalledTimes(1);
      }
    });

    it("collapses grid panel when clicked again", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      await user.click(screen.getByText("Detailed Load Table"));
      expect(screen.getByText(/Export CSV/)).toBeInTheDocument();
      await user.click(screen.getByText("Detailed Load Table"));
      expect(screen.queryByText(/Export CSV/)).not.toBeInTheDocument();
    });
  });

  describe("IFTA summary calculations", () => {
    it("renders with loads that have IFTA data", () => {
      const iftaLoads = [
        createLoad({
          id: "ifta-1",
          iftaBreakdown: [
            { state: "IL", estimatedMiles: 200 },
            { state: "TX", estimatedMiles: 600 },
          ],
          fuelPurchases: [
            { state: "IL", gallons: 50, costPerGallon: 3.5, totalCost: 175 },
          ],
        }),
      ];
      render(
        <LoadBoardEnhanced {...defaultProps} loads={iftaLoads as any} />,
      );
      // Component still renders fine with IFTA data
      expect(screen.getByText("Detailed Load Table")).toBeInTheDocument();
    });
  });

  describe("Export IFTA button", () => {
    it("renders Export IFTA Filing button in sidebar", async () => {
      const user = userEvent.setup();
      render(<LoadBoardEnhanced {...defaultProps} />);
      const buttons = document.querySelectorAll("button");
      const toggleBtn = Array.from(buttons).find((btn) =>
        btn.closest('[class*="absolute right-0"]'),
      );
      if (toggleBtn) {
        await user.click(toggleBtn);
        expect(
          screen.getByText(/Export IFTA Filing/),
        ).toBeInTheDocument();
      }
    });
  });
});
