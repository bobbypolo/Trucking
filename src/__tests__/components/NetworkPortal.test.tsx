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
  v4: vi.fn().mockReturnValue("mock-uuid-net"),
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
      { id: "c-1", name: "John Doe", role: "Manager", phone: "555-0100" },
    ],
    rateTable: [],
    constraints: [],
    customFields: [],
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
    type: "Carrier",
    name: "FastFreight Inc",
    status: "In_Review",
    contacts: [
      { id: "c-2", name: "Jane Smith", role: "Ops Lead", phone: "555-0200" },
    ],
    rateTable: [],
    constraints: [],
    customFields: [],
  },
  {
    id: "party-4",
    tenantId: "company-1",
    type: "Broker",
    name: "BrokerCo Holdings",
    status: "On_Hold",
    contacts: [],
    rateTable: [],
    constraints: [],
    customFields: [],
  },
];

describe("NetworkPortal component", () => {
  const defaultProps = {
    companyId: "company-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getParties).mockResolvedValue(mockParties);
    vi.mocked(saveParty).mockResolvedValue(undefined);
  });

  it("renders the Partner Network Registry heading", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("Partner Network Registry"),
      ).toBeInTheDocument();
    });
  });

  it("calls getParties on mount with companyId", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(getParties).toHaveBeenCalledWith("company-1");
    });
  });

  it("displays party names after loading", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
      expect(screen.getByText("XYZ Repairs")).toBeInTheDocument();
      expect(screen.getByText("FastFreight Inc")).toBeInTheDocument();
      expect(screen.getByText("BrokerCo Holdings")).toBeInTheDocument();
    });
  });

  it("shows party status badges", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Approved")).toBeInTheDocument();
      expect(screen.getByText("Draft")).toBeInTheDocument();
      expect(screen.getByText("In Review")).toBeInTheDocument();
      expect(screen.getByText("On Hold")).toBeInTheDocument();
    });
  });

  it("displays stat counts in the header", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      // Stats: total=4, active(Approved)=1, onHold=1, inReview=1
      // The stat labels are rendered as text
      expect(screen.getByText("total")).toBeInTheDocument();
    });
  });

  it("filters parties by search query", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/SEARCH BY PARTY NAME/i);
    await user.type(searchInput, "FastFreight");
    expect(screen.getByText("FastFreight Inc")).toBeInTheDocument();
    expect(screen.queryByText("ABC Logistics")).not.toBeInTheDocument();
    expect(screen.queryByText("XYZ Repairs")).not.toBeInTheDocument();
  });

  it("filters parties by type when clicking a type filter button", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    // Find the filter buttons area and click Broker
    // Use getAllByRole to find buttons, then filter by text
    const brokerFilterBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent?.trim() === "Broker",
    );
    // The first match is the filter button (it's in the filter bar before the cards)
    await user.click(brokerFilterBtns[0]);
    expect(screen.getByText("BrokerCo Holdings")).toBeInTheDocument();
    expect(screen.queryByText("ABC Logistics")).not.toBeInTheDocument();
    expect(screen.queryByText("FastFreight Inc")).not.toBeInTheDocument();
  });

  it("resets filter when ALL type is selected", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    // Apply Broker filter first
    const brokerFilterBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent?.trim() === "Broker",
    );
    await user.click(brokerFilterBtns[0]);
    expect(screen.queryByText("FastFreight Inc")).not.toBeInTheDocument();

    // Reset by clicking ALL
    await user.click(screen.getByText("ALL"));
    expect(screen.getByText("FastFreight Inc")).toBeInTheDocument();
    expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
  });

  it("opens the onboarding wizard when clicking Start Onboarding", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Start Onboarding"));
    // Wizard view step 1 shows Identity & Strategy heading
    await waitFor(() => {
      expect(screen.getByText("Identity & Strategy")).toBeInTheDocument();
    });
  });

  it("opens a party profile when clicking a party card", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    // Profile view shows Party Identity tab
    await waitFor(() => {
      expect(screen.getByText("Party Identity")).toBeInTheDocument();
    });
  });

  it("renders with empty parties list and shows no cards", async () => {
    vi.mocked(getParties).mockResolvedValue([]);
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("Partner Network Registry"),
      ).toBeInTheDocument();
      expect(screen.queryByText("ABC Logistics")).not.toBeInTheDocument();
    });
  });

  it("passes onNavigateToLoad prop for party-to-load navigation", async () => {
    const onNav = vi.fn();
    render(<NetworkPortal {...defaultProps} onNavigateToLoad={onNav} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });
    // Prop is passed through; component renders normally
    expect(
      screen.getByText("Partner Network Registry"),
    ).toBeInTheDocument();
  });

  it("shows the Start Onboarding button", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
  });

  it("shows the search input with correct placeholder", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/SEARCH BY PARTY NAME/i),
      ).toBeInTheDocument();
    });
  });
});
