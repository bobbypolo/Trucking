import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadData, User, LOAD_STATUS, DriverSettlement } from "../../../types";

// Mock financialService before importing the component
vi.mock("../../../services/financialService", () => ({
  getSettlements: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../components/Settlements", () => ({
  Settlements: () => (
    <div data-testid="settlements-component">Settlements Content</div>
  ),
}));

import DriverPayPortal from "../../../components/DriverPayPortal";
import { getSettlements } from "../../../services/financialService";

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "driver@test.com",
  name: "Test Driver",
  role: "driver",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "user-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2500,
    driverPay: 1500,
    pickupDate: "2026-01-15",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "user-1",
    loadNumber: "LN-002",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 3000,
    driverPay: 1800,
    pickupDate: "2026-01-16",
    pickup: { city: "Houston", state: "TX" },
    dropoff: { city: "Phoenix", state: "AZ" },
  },
];

const mockSettlements: DriverSettlement[] = [
  {
    id: "stl-1",
    tenantId: "company-1",
    driverId: "user-1",
    settlementDate: "2026-01-15",
    status: "Paid",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-15",
    totalEarnings: 3200,
    totalDeductions: 450,
    totalReimbursements: 0,
    netPay: 2750,
    lines: [],
  },
  {
    id: "stl-2",
    tenantId: "company-1",
    driverId: "user-1",
    settlementDate: "2026-01-31",
    status: "Draft",
    periodStart: "2026-01-16",
    periodEnd: "2026-01-31",
    totalEarnings: 2800,
    totalDeductions: 300,
    totalReimbursements: 0,
    netPay: 2500,
    lines: [],
  },
];

describe("DriverPayPortal (COM-05)", () => {
  const mockNavigate = vi.fn();

  const defaultProps = {
    loads: mockLoads,
    users: [mockUser],
    currentUser: mockUser,
    onNavigate: mockNavigate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── COM-05: Driver Pay is distinct from Accounting ──

  describe("rendering and structure", () => {
    it("renders Driver Pay header, not Accounting", async () => {
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        // h1 contains "Driver Pay"
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
          "Driver Pay",
        );
      });
      // Must NOT contain accounting-specific terms
      expect(screen.queryByText("Accounts Receivable")).not.toBeInTheDocument();
      expect(screen.queryByText("Accounts Payable")).not.toBeInTheDocument();
      expect(screen.queryByText("General Ledger")).not.toBeInTheDocument();
      expect(screen.queryByText("IFTA")).not.toBeInTheDocument();
      expect(screen.queryByText("File Vault")).not.toBeInTheDocument();
      expect(screen.queryByText("Rules Engine")).not.toBeInTheDocument();
    });

    it("shows three driver-specific tabs: Overview, Settlements, Completed Loads", async () => {
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Overview")).toBeInTheDocument();
        // "Settlements" appears as tab button text
        const buttons = screen.getAllByRole("button");
        const tabLabels = buttons.map((b) => b.textContent);
        expect(tabLabels.some((t) => t?.includes("Settlements"))).toBe(true);
        expect(tabLabels.some((t) => t?.includes("Completed Loads"))).toBe(
          true,
        );
      });
    });

    it("does not render accounting tabs (AR, AP, GL, Audit Log, etc.)", async () => {
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
          "Driver Pay",
        );
      });
      expect(screen.queryByText("AR / Invoices")).not.toBeInTheDocument();
      expect(screen.queryByText("AP / Bills")).not.toBeInTheDocument();
      expect(screen.queryByText("Audit Log")).not.toBeInTheDocument();
      expect(screen.queryByText("Fuel & IFTA")).not.toBeInTheDocument();
    });
  });

  describe("data loading from real API", () => {
    it("calls getSettlements on mount", async () => {
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        expect(getSettlements).toHaveBeenCalled();
      });
    });

    it("shows loading skeleton while data loads", () => {
      vi.mocked(getSettlements).mockImplementation(
        () => new Promise(() => {}), // never resolves
      );
      render(<DriverPayPortal {...defaultProps} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("shows error state when API call fails", async () => {
      vi.mocked(getSettlements).mockRejectedValue(new Error("Network error"));
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        expect(
          screen.getByText("Failed to load driver pay data. Please try again."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("empty states (honest, no fake data)", () => {
    it("shows 'No Settlements Yet' when API returns empty array", async () => {
      vi.mocked(getSettlements).mockResolvedValue([]);
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("No Settlements Yet")).toBeInTheDocument();
      });
    });

    it("shows 'No Completed Loads' when no delivered loads exist", async () => {
      vi.mocked(getSettlements).mockResolvedValue([]);
      render(
        <DriverPayPortal
          {...defaultProps}
          loads={[mockLoads[1]]} // only in-transit, no delivered
        />,
      );
      await waitFor(() => {
        expect(screen.getByText("No Completed Loads")).toBeInTheDocument();
      });
    });

    it("KPIs show $0 and 0 when no data", async () => {
      vi.mocked(getSettlements).mockResolvedValue([]);
      render(<DriverPayPortal {...defaultProps} loads={[]} />);
      await waitFor(() => {
        expect(screen.getByText("$0")).toBeInTheDocument();
        expect(screen.getByText("0 Settlements")).toBeInTheDocument();
      });
    });
  });

  describe("KPI computation from real data", () => {
    it("computes Total Earnings from settlement netPay values", async () => {
      vi.mocked(getSettlements).mockResolvedValue(mockSettlements);
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        // Total: 2750 + 2500 = 5250
        expect(screen.getByText("$5,250")).toBeInTheDocument();
      });
    });

    it("counts pending settlements (Draft + Calculated)", async () => {
      vi.mocked(getSettlements).mockResolvedValue(mockSettlements);
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        // 1 Draft settlement = 1 pending
        const pendingCard = screen
          .getByText("Pending Settlements")
          .closest("div");
        expect(pendingCard?.parentElement?.textContent).toContain("1");
      });
    });

    it("counts paid settlements (Paid + Approved)", async () => {
      vi.mocked(getSettlements).mockResolvedValue(mockSettlements);
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        // 1 Paid settlement = 1 paid
        const paidCard = screen.getByText("Paid Settlements").closest("div");
        expect(paidCard?.parentElement?.textContent).toContain("1");
      });
    });

    it("counts only delivered/completed loads", async () => {
      vi.mocked(getSettlements).mockResolvedValue([]);
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        // Only load-1 is delivered, load-2 is in transit
        // Find the KPI card label (inside a span, not a button)
        const kpiLabels = screen.getAllByText("Completed Loads");
        const kpiSpan = kpiLabels.find(
          (el) => el.tagName === "SPAN" || el.closest("span"),
        );
        expect(kpiSpan).toBeTruthy();
        // The KPI card's parent should contain "1" as the count
        const card = kpiSpan!.closest("div[class*='rounded']");
        expect(card?.textContent).toContain("1");
      });
    });
  });

  describe("tab switching", () => {
    it("switches to Settlements tab and shows Settlements component", async () => {
      const user = userEvent.setup();
      vi.mocked(getSettlements).mockResolvedValue([]);
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Settlements")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Settlements"));
      await waitFor(
        () => {
          expect(
            screen.getByTestId("settlements-component"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });

    it("switches to Completed Loads tab and shows load table", async () => {
      const user = userEvent.setup();
      vi.mocked(getSettlements).mockResolvedValue([]);
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Overview")).toBeInTheDocument();
      });
      // Find the tab button (not the KPI label)
      const buttons = screen.getAllByRole("button");
      const completedLoadsTab = buttons.find((b) =>
        b.textContent?.includes("Completed Loads"),
      );
      expect(completedLoadsTab).toBeTruthy();
      await user.click(completedLoadsTab!);
      await waitFor(() => {
        expect(screen.getByText("All Completed Loads")).toBeInTheDocument();
      });
    });
  });

  describe("settlement table shows real data", () => {
    it("renders settlement rows with correct financial values", async () => {
      vi.mocked(getSettlements).mockResolvedValue(mockSettlements);
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        // Settlement period dates
        expect(screen.getByText(/2026-01-01/)).toBeInTheDocument();
        // Gross earnings
        expect(screen.getByText("$3,200")).toBeInTheDocument();
        // Deductions
        expect(screen.getByText("$450")).toBeInTheDocument();
        // Net pay
        expect(screen.getByText("$2,750")).toBeInTheDocument();
      });
    });

    it("shows status badges (Paid, Draft)", async () => {
      vi.mocked(getSettlements).mockResolvedValue(mockSettlements);
      render(<DriverPayPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Paid")).toBeInTheDocument();
        expect(screen.getByText("Draft")).toBeInTheDocument();
      });
    });
  });

  describe("no hardcoded fake values", () => {
    it("does not contain hardcoded dollar amounts", async () => {
      vi.mocked(getSettlements).mockResolvedValue([]);
      const { container } = render(
        <DriverPayPortal {...defaultProps} loads={[]} />,
      );
      await waitFor(() => {
        expect(screen.getByText("Driver Pay")).toBeInTheDocument();
      });
      const text = container.textContent || "";
      // Should not contain any hardcoded dollar amounts
      expect(text).not.toMatch(/\$12,450/);
      expect(text).not.toMatch(/\$2,840/);
      expect(text).not.toMatch(/\$50,000/);
      expect(text).not.toMatch(/42\.5 hrs/);
    });
  });
});
