import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
    contacts: [],
    rateTable: [],
    constraints: [],
    customFields: [],
  },
  {
    id: "party-2",
    tenantId: "company-1",
    type: "Vendor",
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
    status: "Active",
    contacts: [
      { id: "c-1", name: "John Doe", role: "Manager", phone: "555-0100" },
    ],
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

  it("renders without crashing", async () => {
    const { container } = render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("calls getParties on mount", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(getParties).toHaveBeenCalled();
    });
  });

  it("displays party names after loading", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeTruthy();
    });
  });

  it("renders with empty parties list", async () => {
    vi.mocked(getParties).mockResolvedValue([]);
    const { container } = render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders with optional onNavigateToLoad prop", async () => {
    const onNav = vi.fn();
    const { container } = render(
      <NetworkPortal {...defaultProps} onNavigateToLoad={onNav} />,
    );
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders with different company IDs", async () => {
    const { container } = render(
      <NetworkPortal companyId="different-company" />,
    );
    await waitFor(() => expect(container).toBeTruthy());
  });
});
