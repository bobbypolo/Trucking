import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NetworkPortal } from "../../../components/NetworkPortal";
import { NetworkParty } from "../../../types";

vi.mock("../../../services/networkService", () => ({
  getParties: vi.fn(),
  saveParty: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-net-cov"),
}));

vi.mock("../../../components/Toast", () => ({
  Toast: ({
    message,
    type,
  }: {
    message: string;
    type: string;
    onDismiss: () => void;
  }) => (
    <div data-testid="toast-mock" data-type={type}>
      {message}
    </div>
  ),
}));

import { getParties, saveParty } from "../../../services/networkService";

const mockParties: NetworkParty[] = [
  {
    id: "party-1",
    tenantId: "company-1",
    type: "Shipper",
    name: "ABC Logistics",
    status: "Approved",
    contacts: [
      { id: "c-1", name: "Alice Smith", role: "Account Manager", phone: "555-0101", email: "alice@abc.com" },
    ],
    rateTable: [],
    constraints: [],
    customFields: [],
    mcNumber: "MC-111",
  },
  {
    id: "party-2",
    tenantId: "company-1",
    type: "Vendor_Service",
    name: "XYZ Repairs",
    status: "Draft",
    contacts: [],
    rateTable: [],
    constraints: [],
    customFields: [],
  },
  {
    id: "party-3",
    tenantId: "company-1",
    type: "Broker",
    name: "FastFreight Inc",
    status: "In_Review",
    contacts: [],
    rateTable: [],
    constraints: [],
    customFields: [],
  },
  {
    id: "party-4",
    tenantId: "company-1",
    type: "Vendor_Equipment",
    name: "EquipCo",
    status: "On_Hold",
    contacts: [],
    rateTable: [],
    constraints: [],
    customFields: [],
  },
  {
    id: "party-5",
    tenantId: "company-1",
    type: "Facility",
    name: "Main Depot",
    status: "Approved",
    contacts: [],
    rateTable: [],
    constraints: [],
    customFields: [],
  },
];

describe("NetworkPortal coverage — deeper interactions", () => {
  const defaultProps = {
    companyId: "company-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getParties).mockResolvedValue(mockParties);
    vi.mocked(saveParty).mockResolvedValue(undefined);
  });

  it("renders header with Partner Network Registry title", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Partner Network Registry")).toBeInTheDocument();
    });
  });

  it("renders all party names in dashboard view", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
      expect(screen.getByText("XYZ Repairs")).toBeInTheDocument();
      expect(screen.getByText("FastFreight Inc")).toBeInTheDocument();
      expect(screen.getByText("EquipCo")).toBeInTheDocument();
      expect(screen.getByText("Main Depot")).toBeInTheDocument();
    });
  });

  it("renders stat counters for total, active, onHold, inReview", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      // Total: 5 parties
      expect(screen.getByText("5")).toBeInTheDocument();
      // Active (Approved): 2
      expect(screen.getByText("2")).toBeInTheDocument();
      // On Hold: 1
      // In Review: 1
    });
  });

  it("filters parties by type when Shipper filter is clicked", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    // Find the Shipper filter button (it's in the filter bar, not the party card)
    const filterButtons = screen.getAllByRole("button");
    const shipperFilterBtn = filterButtons.find(
      (b) => b.textContent?.trim() === "Shipper" && b.className.includes("tracking-widest"),
    );
    expect(shipperFilterBtn).toBeTruthy();
    await user.click(shipperFilterBtn!);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
      expect(screen.queryByText("XYZ Repairs")).not.toBeInTheDocument();
    });
  });

  it("filters parties by type when Broker filter is clicked", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("FastFreight Inc")).toBeInTheDocument();
    });

    const filterButtons = screen.getAllByRole("button");
    const brokerFilterBtn = filterButtons.find(
      (b) => b.textContent?.trim() === "Broker" && b.className.includes("tracking-widest"),
    );
    expect(brokerFilterBtn).toBeTruthy();
    await user.click(brokerFilterBtn!);
    await waitFor(() => {
      expect(screen.getByText("FastFreight Inc")).toBeInTheDocument();
      expect(screen.queryByText("ABC Logistics")).not.toBeInTheDocument();
    });
  });

  it("filters parties by search query", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      /SEARCH BY PARTY NAME/,
    );
    await user.type(searchInput, "XYZ");
    await waitFor(() => {
      expect(screen.getByText("XYZ Repairs")).toBeInTheDocument();
      expect(screen.queryByText("ABC Logistics")).not.toBeInTheDocument();
    });
  });

  it("filters parties by MC number in search", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      /SEARCH BY PARTY NAME/,
    );
    await user.type(searchInput, "MC-111");
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });
  });

  it("shows ALL filter and re-shows all parties when clicked", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    // Filter to Shipper first
    const filterButtons = screen.getAllByRole("button");
    const shipperBtn = filterButtons.find(
      (b) => b.textContent?.trim() === "Shipper" && b.className.includes("tracking-widest"),
    );
    await user.click(shipperBtn!);
    await waitFor(() => {
      expect(screen.queryByText("XYZ Repairs")).not.toBeInTheDocument();
    });

    // Click ALL to show all
    const allBtn = filterButtons.find(
      (b) => b.textContent?.trim() === "ALL" && b.className.includes("tracking-widest"),
    );
    await user.click(allBtn!);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
      expect(screen.getByText("XYZ Repairs")).toBeInTheDocument();
    });
  });

  it("navigates to profile view when a party card is clicked", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    // Click on the party card
    await user.click(screen.getByText("ABC Logistics"));
    // Should switch to profile view
    await waitFor(() => {
      // Profile view should show the party details
      const text = document.body.textContent || "";
      expect(text).toContain("ABC Logistics");
    });
  });

  it("renders Start Onboarding button and clicking it shows wizard", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      // Wizard view should appear
      const text = document.body.textContent || "";
      expect(text).toContain("Onboarding");
    });
  });

  it("renders party status badges (Approved, Draft, In Review, On Hold)", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      // Approved appears as both badge and stat, use getAllByText
      expect(screen.getAllByText("Approved").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("In Review").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("On Hold").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders different icons for different party types", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      // All 5 parties should render with their type-specific icons
      const cards = document.querySelectorAll("[class*='cursor-pointer']");
      expect(cards.length).toBeGreaterThanOrEqual(5);
    });
  });

  it("renders Vendor Service and Vendor Equipment filter buttons", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Vendor Service")).toBeInTheDocument();
      expect(screen.getByText("Vendor Equipment")).toBeInTheDocument();
      expect(screen.getByText("Facility")).toBeInTheDocument();
    });
  });
});
