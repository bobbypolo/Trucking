import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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

function buildParty(overrides: Partial<NetworkParty> = {}): NetworkParty {
  return {
    id: "party-1",
    companyId: "company-1",
    tenantId: "company-1",
    name: "ABC Logistics",
    type: "Shipper",
    status: "Approved",
    isCustomer: true,
    isVendor: false,
    contacts: [],
    documents: [],
    rates: [],
    constraintSets: [],
    catalogLinks: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const mockParties: NetworkParty[] = [
  buildParty({
    id: "party-1",
    name: "ABC Logistics",
    type: "Shipper",
    status: "Approved",
    isCustomer: true,
    isVendor: false,
    rating: 95,
    contacts: [
      {
        id: "c-1",
        partyId: "party-1",
        name: "John Doe",
        role: "Operations",
        email: "john@abc.com",
        phone: "555-0100",
        isPrimary: true,
      },
    ],
    billingProfile: { paymentTerms: "NET 30", creditLimit: 50000 },
  }),
  buildParty({
    id: "party-2",
    name: "XYZ Repairs",
    type: "Vendor_Service",
    status: "Draft",
    isCustomer: false,
    isVendor: true,
    contacts: [],
  }),
  buildParty({
    id: "party-3",
    name: "FastFreight Inc",
    type: "Carrier" as any,
    status: "In_Review",
    isCustomer: false,
    isVendor: false,
    contacts: [
      {
        id: "c-2",
        partyId: "party-3",
        name: "Jane Smith",
        role: "Operations",
        email: "jane@fast.com",
        phone: "555-0200",
        isPrimary: true,
      },
    ],
  }),
  buildParty({
    id: "party-4",
    name: "BrokerCo Holdings",
    type: "Broker",
    status: "On_Hold",
    isCustomer: true,
    isVendor: false,
    contacts: [],
  }),
];

describe("NetworkPortal component", () => {
  const defaultProps = { companyId: "company-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getParties).mockResolvedValue(mockParties);
    vi.mocked(saveParty).mockResolvedValue(undefined);
  });

  // ─── Heading & initial render ───
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

  // ─── Party list rendering ───
  it("displays all party names after loading", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });
    expect(screen.getByText("XYZ Repairs")).toBeInTheDocument();
    expect(screen.getByText("FastFreight Inc")).toBeInTheDocument();
    expect(screen.getByText("BrokerCo Holdings")).toBeInTheDocument();
  });

  it("shows party status badges on each card", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Approved")).toBeInTheDocument();
    });
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("In Review")).toBeInTheDocument();
    expect(screen.getByText("On Hold")).toBeInTheDocument();
  });

  it("renders party type labels on cards", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });
    // Vendor_Service is rendered as "Vendor Service" - appears in filter bar AND card
    const vendorServiceEls = screen.getAllByText("Vendor Service");
    expect(vendorServiceEls.length).toBeGreaterThanOrEqual(2); // filter + card label
    // "Broker" also appears in both filter bar and card label
    const brokerEls = screen.getAllByText("Broker");
    expect(brokerEls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows compliance rating on party cards", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("95 Score")).toBeInTheDocument();
    });
    // Parties without rating show N/A
    const naScores = screen.getAllByText("N/A Score");
    expect(naScores.length).toBeGreaterThanOrEqual(1);
  });

  it("shows billing status on party cards", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("NET 30")).toBeInTheDocument();
    });
    const pendingTerms = screen.getAllByText("Terms Pending");
    expect(pendingTerms.length).toBeGreaterThanOrEqual(1);
  });

  it("renders contact avatars on party cards with initials", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });
    // ABC Logistics has contact John Doe => initial "J"
    expect(screen.getByTitle("John Doe")).toBeInTheDocument();
    expect(screen.getByTitle("Jane Smith")).toBeInTheDocument();
  });

  // ─── Stat counts ───
  it("displays stat counts in the header", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("total")).toBeInTheDocument();
    });
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("on Hold")).toBeInTheDocument();
    expect(screen.getByText("in Review")).toBeInTheDocument();
  });

  // ─── Search ───
  it("shows search input with correct placeholder", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/SEARCH BY PARTY NAME/i),
      ).toBeInTheDocument();
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

  it("filters by MC number when searching", async () => {
    vi.mocked(getParties).mockResolvedValue([
      buildParty({
        id: "p-mc",
        name: "MC Party",
        mcNumber: "MC-123456",
      }),
      buildParty({
        id: "p-no-mc",
        name: "No MC Party",
      }),
    ]);
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("MC Party")).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText(/SEARCH BY PARTY NAME/i),
      "MC-123456",
    );
    expect(screen.getByText("MC Party")).toBeInTheDocument();
    expect(screen.queryByText("No MC Party")).not.toBeInTheDocument();
  });

  // ─── Type filter ───
  it("filters parties by type when clicking a type filter button", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    const brokerFilterBtns = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent?.trim() === "Broker");
    await user.click(brokerFilterBtns[0]);
    expect(screen.getByText("BrokerCo Holdings")).toBeInTheDocument();
    expect(screen.queryByText("ABC Logistics")).not.toBeInTheDocument();
    expect(screen.queryByText("FastFreight Inc")).not.toBeInTheDocument();
  });

  it("filters by Shipper type", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    const shipperBtns = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent?.trim() === "Shipper");
    await user.click(shipperBtns[0]);
    expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    expect(screen.queryByText("BrokerCo Holdings")).not.toBeInTheDocument();
  });

  it("filters by Vendor Service type", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("XYZ Repairs")).toBeInTheDocument();
    });

    const vendorBtns = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent?.trim() === "Vendor Service");
    await user.click(vendorBtns[0]);
    expect(screen.getByText("XYZ Repairs")).toBeInTheDocument();
    expect(screen.queryByText("ABC Logistics")).not.toBeInTheDocument();
  });

  it("resets filter when ALL type is selected", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    const brokerFilterBtns = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent?.trim() === "Broker");
    await user.click(brokerFilterBtns[0]);
    expect(screen.queryByText("FastFreight Inc")).not.toBeInTheDocument();

    await user.click(screen.getByText("ALL"));
    expect(screen.getByText("FastFreight Inc")).toBeInTheDocument();
    expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
  });

  // ─── Onboarding wizard ───
  it("opens the onboarding wizard when clicking Start Onboarding", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(screen.getByText("Identity & Strategy")).toBeInTheDocument();
    });
  });

  it("shows wizard step 1 with entity type selector and form fields", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    await waitFor(() => {
      expect(screen.getByText("Identity & Strategy")).toBeInTheDocument();
    });
    expect(screen.getByText("Universal Entity Type")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("FULL REGISTERED NAME")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("IDENTIFIER")).toBeInTheDocument();
    expect(screen.getByText("Customer (A/R)")).toBeInTheDocument();
    expect(screen.getByText("Vendor (A/P)")).toBeInTheDocument();
  });

  it("toggles Customer and Vendor financial roles in wizard step 1", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(screen.getByText("Customer (A/R)")).toBeInTheDocument();
    });

    // Toggle vendor on
    await user.click(screen.getByText("Vendor (A/P)"));
    // Toggle customer off
    await user.click(screen.getByText("Customer (A/R)"));
    // Both buttons should still be present (toggles are buttons)
    expect(screen.getByText("Customer (A/R)")).toBeInTheDocument();
    expect(screen.getByText("Vendor (A/P)")).toBeInTheDocument();
  });

  it("selects entity type in wizard step 1", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(screen.getByText("Identity & Strategy")).toBeInTheDocument();
    });

    // Click on Broker entity type
    const entityTypeButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent?.trim() === "Broker");
    // The last one should be in the wizard entity type selector
    await user.click(entityTypeButtons[entityTypeButtons.length - 1]);
    // MC Number label should appear for non-shipper types
    expect(screen.getByText("MC Number")).toBeInTheDocument();
  });

  it("fills in entity name in wizard step 1", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("FULL REGISTERED NAME"),
      ).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText("FULL REGISTERED NAME"),
      "Test Company LLC",
    );
    expect(screen.getByPlaceholderText("FULL REGISTERED NAME")).toHaveValue(
      "Test Company LLC",
    );
  });

  it("navigates to wizard step 2 (Financial Infrastructure)", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(screen.getByText("Identity & Strategy")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Next Phase"));
    await waitFor(() => {
      expect(
        screen.getByText("Financial Infrastructure"),
      ).toBeInTheDocument();
    });
    // Customer A/R section visible by default (isCustomer=true)
    expect(
      screen.getByText("Accounts Receivable (A/R)"),
    ).toBeInTheDocument();
  });

  it("shows vendor A/P section when isVendor is toggled on", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(screen.getByText("Identity & Strategy")).toBeInTheDocument();
    });

    // Toggle vendor on
    await user.click(screen.getByText("Vendor (A/P)"));
    await user.click(screen.getByText("Next Phase"));

    await waitFor(() => {
      expect(
        screen.getByText("Financial Infrastructure"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("Accounts Payable (A/P)"),
    ).toBeInTheDocument();
  });

  it("shows warning when neither customer nor vendor selected in step 2", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(screen.getByText("Customer (A/R)")).toBeInTheDocument();
    });

    // Toggle customer off (it starts on by default)
    await user.click(screen.getByText("Customer (A/R)"));
    await user.click(screen.getByText("Next Phase"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Select at least one financial role in Identity Phase",
        ),
      ).toBeInTheDocument();
    });
  });

  it("navigates to wizard step 3 (Registry Tables & Engines)", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(screen.getByText("Next Phase")).toBeInTheDocument();
    });

    // Step 1 -> 2
    await user.click(screen.getByText("Next Phase"));
    await waitFor(() => {
      expect(
        screen.getByText("Financial Infrastructure"),
      ).toBeInTheDocument();
    });
    // Step 2 -> 3
    await user.click(screen.getByText("Next Phase"));
    await waitFor(() => {
      expect(
        screen.getByText("Registry Tables & Engines"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Unit Pricing Engine")).toBeInTheDocument();
    expect(screen.getByText("Operational Constraints")).toBeInTheDocument();
  });

  it("adds a rate row in wizard step 3", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(screen.getByText("Next Phase")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Next Phase"));
    await waitFor(() => {
      expect(screen.getByText("Next Phase")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Next Phase"));
    await waitFor(() => {
      expect(screen.getByText("Add Rate Row")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Add Rate Row"));
    // Rate table should now have at least one row with an item identifier input
    expect(screen.getByDisplayValue("SERVICE_GENERAL")).toBeInTheDocument();
  });

  it("adds a constraint set in wizard step 3", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(screen.getByText("Next Phase")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Next Phase"));
    await waitFor(() => {
      expect(screen.getByText("Next Phase")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Next Phase"));
    await waitFor(() => {
      expect(screen.getByText("New Constraint Set")).toBeInTheDocument();
    });

    await user.click(screen.getByText("New Constraint Set"));
    expect(screen.getByText("SET #1")).toBeInTheDocument();
  });

  it("navigates to wizard step 4 (Broker Network)", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    // Navigate through steps 1-4
    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        expect(screen.getByText("Next Phase")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next Phase"));
    }

    await waitFor(() => {
      expect(screen.getByText("Broker Network")).toBeInTheDocument();
    });
    expect(screen.getByText("Command Contacts")).toBeInTheDocument();
    expect(screen.getByText("Preferred Network Nodes")).toBeInTheDocument();
  });

  it("adds a contact in wizard step 4", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        expect(screen.getByText("Next Phase")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next Phase"));
    }

    await waitFor(() => {
      expect(screen.getByText("+ Inject Contact")).toBeInTheDocument();
    });

    await user.click(screen.getByText("+ Inject Contact"));
    expect(screen.getByDisplayValue("NEW CONTACT")).toBeInTheDocument();
  });

  it("opens Quick Vendor modal from wizard step 4", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        expect(screen.getByText("Next Phase")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next Phase"));
    }

    await waitFor(() => {
      expect(screen.getByText("+ Quick Vendor")).toBeInTheDocument();
    });
    await user.click(screen.getByText("+ Quick Vendor"));
    await waitFor(() => {
      expect(screen.getByText("QUICK VENDOR")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("ENTITY NAME")).toBeInTheDocument();
  });

  it("opens Quick Equip modal from wizard step 4", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        expect(screen.getByText("Next Phase")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next Phase"));
    }

    await waitFor(() => {
      expect(screen.getByText("+ Quick Equip")).toBeInTheDocument();
    });
    await user.click(screen.getByText("+ Quick Equip"));
    await waitFor(() => {
      expect(screen.getByText("QUICK EQUIP")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("TRK-99")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("VIN...")).toBeInTheDocument();
  });

  it("closes Quick modal when clicking the close button", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        expect(screen.getByText("Next Phase")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next Phase"));
    }

    await waitFor(() => {
      expect(screen.getByText("+ Quick Vendor")).toBeInTheDocument();
    });
    await user.click(screen.getByText("+ Quick Vendor"));
    await waitFor(() => {
      expect(screen.getByText("QUICK VENDOR")).toBeInTheDocument();
    });

    // Close via the X button on the modal
    const modalHeader = screen.getByText("QUICK VENDOR").closest("div")!;
    const closeBtn = within(modalHeader.parentElement!).getAllByRole("button")[
      within(modalHeader.parentElement!).getAllByRole("button").length - 1
    ];
    await user.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByText("QUICK VENDOR")).not.toBeInTheDocument();
    });
  });

  it("navigates to wizard step 5 (Final Validation)", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    for (let i = 0; i < 4; i++) {
      await waitFor(() => {
        expect(screen.getByText("Next Phase")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next Phase"));
    }

    await waitFor(() => {
      expect(
        screen.getByText("Final Validation & Network Commit"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Commit to Registry")).toBeInTheDocument();
  });

  it("saves party on wizard step 5 commit", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    // Fill in required company name on step 1 so wizard validation passes
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("FULL REGISTERED NAME"),
      ).toBeInTheDocument();
    });
    await user.type(
      screen.getByPlaceholderText("FULL REGISTERED NAME"),
      "Test Company LLC",
    );

    for (let i = 0; i < 4; i++) {
      await waitFor(() => {
        expect(screen.getByText("Next Phase")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next Phase"));
    }

    await waitFor(() => {
      expect(screen.getByText("Commit to Registry")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Commit to Registry"));
    await waitFor(() => {
      expect(saveParty).toHaveBeenCalledTimes(1);
    });
    expect(saveParty).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: "company-1" }),
    );
  });

  it("returns to dashboard after successful save", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    // Fill in required company name on step 1 so wizard validation passes
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("FULL REGISTERED NAME"),
      ).toBeInTheDocument();
    });
    await user.type(
      screen.getByPlaceholderText("FULL REGISTERED NAME"),
      "Test Company LLC",
    );

    for (let i = 0; i < 4; i++) {
      await waitFor(() => {
        expect(screen.getByText("Next Phase")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next Phase"));
    }

    await waitFor(() => {
      expect(screen.getByText("Commit to Registry")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Commit to Registry"));
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });
  });

  it("shows error toast when save fails", async () => {
    vi.mocked(saveParty).mockRejectedValueOnce(new Error("Save failed"));
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    // Fill in required company name on step 1 so wizard validation passes
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("FULL REGISTERED NAME"),
      ).toBeInTheDocument();
    });
    await user.type(
      screen.getByPlaceholderText("FULL REGISTERED NAME"),
      "Test Company LLC",
    );

    for (let i = 0; i < 4; i++) {
      await waitFor(() => {
        expect(screen.getByText("Next Phase")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next Phase"));
    }

    await waitFor(() => {
      expect(screen.getByText("Commit to Registry")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Commit to Registry"));
    await waitFor(() => {
      expect(screen.getByText("Failed to save party")).toBeInTheDocument();
    });
  });

  it("navigates backwards through wizard using Backtrack Step", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(screen.getByText("Next Phase")).toBeInTheDocument();
    });

    // Go to step 2
    await user.click(screen.getByText("Next Phase"));
    await waitFor(() => {
      expect(
        screen.getByText("Financial Infrastructure"),
      ).toBeInTheDocument();
    });

    // Go back to step 1
    await user.click(screen.getByText("Backtrack Step"));
    await waitFor(() => {
      expect(screen.getByText("Identity & Strategy")).toBeInTheDocument();
    });
  });

  it("returns to dashboard when clicking Discard & Return on step 1", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));
    await waitFor(() => {
      expect(screen.getByText("Discard & Return")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Discard & Return"));
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });
  });

  // ─── Party profile view ───
  it("opens party profile when clicking a party card", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Party Identity")).toBeInTheDocument();
    });
    expect(screen.getByText("Core Attributes")).toBeInTheDocument();
    expect(screen.getByText("Base Identity Name")).toBeInTheDocument();
  });

  it("shows profile tab navigation with all tabs", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Party Identity")).toBeInTheDocument();
    });
    expect(screen.getByText("Auth Contacts")).toBeInTheDocument();
    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("Rules")).toBeInTheDocument();
    expect(screen.getByText("Compliance Docs")).toBeInTheDocument();
  });

  it("switches to Contacts tab in profile view", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Auth Contacts")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Auth Contacts"));
    await waitFor(() => {
      expect(screen.getByText("Authorized Contacts")).toBeInTheDocument();
    });
    // Contact should be visible
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("555-0100")).toBeInTheDocument();
    expect(screen.getByText("john@abc.com")).toBeInTheDocument();
  });

  it("switches to Pricing tab and shows empty rate table", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Pricing")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Pricing"));
    await waitFor(() => {
      expect(screen.getByText("Unified Rate Table")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "No unified rates currently mapped for this node.",
      ),
    ).toBeInTheDocument();
  });

  it("switches to Services (Catalog) tab and shows empty state", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Services")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Services"));
    await waitFor(() => {
      expect(
        screen.getByText("Authorized Service Catalog"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("No catalog items mapped to this node"),
    ).toBeInTheDocument();
  });

  it("adds a catalog item in Services tab via + Add Item button", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Services")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Services"));
    await waitFor(() => {
      expect(screen.getByText("+ Add Item")).toBeInTheDocument();
    });
    await user.click(screen.getByText("+ Add Item"));
    expect(screen.getByText("NEW CATALOG ITEM")).toBeInTheDocument();
    expect(screen.getByText("CODE: NEW_CODE")).toBeInTheDocument();
  });

  it("switches to Rules (Constraints) tab with empty state", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Rules")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(
        screen.getByText("Operational Logic Constraints"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("No rules set. Full flexibility."),
    ).toBeInTheDocument();
  });

  it("switches to Compliance Docs tab with empty state", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Compliance Docs")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Compliance Docs"));
    await waitFor(() => {
      expect(
        screen.getByText("Compliance & Legal Artifacts"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("No documents uploaded yet."),
    ).toBeInTheDocument();
  });

  it("returns to dashboard from profile view via back button", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Party Identity")).toBeInTheDocument();
    });

    // Back button is the first button with a rotated chevron
    const backBtns = screen
      .getAllByRole("button")
      .filter(
        (btn) =>
          btn.querySelector("svg") !== null &&
          btn.className.includes("rounded-xl") &&
          btn.className.includes("bg-slate-900"),
      );
    await user.click(backBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
  });

  it("shows A/R Customer Flag on profile identity tab", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("A/R Customer Flag")).toBeInTheDocument();
    });
  });

  it("shows vendor signals panel for vendor parties in profile", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("XYZ Repairs")).toBeInTheDocument();
    });

    await user.click(screen.getByText("XYZ Repairs"));
    await waitFor(() => {
      expect(screen.getByText("AP Workflow Active")).toBeInTheDocument();
    });
  });

  // ─── Empty states ───
  it("renders with empty parties list and shows heading only", async () => {
    vi.mocked(getParties).mockResolvedValue([]);
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("Partner Network Registry"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("ABC Logistics")).not.toBeInTheDocument();
  });

  // ─── Props ───
  it("passes onNavigateToLoad prop without breaking render", async () => {
    const onNav = vi.fn();
    render(<NetworkPortal {...defaultProps} onNavigateToLoad={onNav} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Partner Network Registry"),
    ).toBeInTheDocument();
  });

  it("displays the Start Onboarding button", async () => {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
  });

  // ─── Profile with rates ───
  it("renders rate table rows in profile Pricing tab", async () => {
    const partyWithRates = buildParty({
      id: "party-rates",
      name: "Rated Party",
      rates: [
        {
          id: "r1",
          tenantId: "t1",
          partyId: "party-rates",
          catalogItemId: "LINEHAUL",
          direction: "AR",
          currency: "USD",
          priceType: "Per_Unit",
          unitType: "Mile",
          unitAmount: 2.5,
          effectiveStart: "2026-01-01",
          taxableFlag: false,
          roundingRule: "Nearest Cent",
          approvalRequired: false,
        },
      ],
    });
    vi.mocked(getParties).mockResolvedValue([partyWithRates]);
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Rated Party")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Rated Party"));
    await waitFor(() => {
      expect(screen.getByText("Pricing")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Pricing"));
    await waitFor(() => {
      expect(screen.getByText("LINEHAUL")).toBeInTheDocument();
    });
    expect(screen.getByText("AR")).toBeInTheDocument();
    expect(screen.getByText("Per_Unit")).toBeInTheDocument();
  });

  // ─── Profile with documents ───
  it("renders documents in profile Compliance Docs tab", async () => {
    const partyWithDocs = buildParty({
      id: "party-docs",
      name: "Documented Party",
      documents: [
        {
          id: "d1",
          partyId: "party-docs",
          type: "Insurance",
          name: "General Liability Policy",
          status: "Verified",
          url: "https://example.com/doc.pdf",
          expiryDate: "2027-06-15T00:00:00Z",
        },
      ],
    });
    vi.mocked(getParties).mockResolvedValue([partyWithDocs]);
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Documented Party")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Documented Party"));
    await waitFor(() => {
      expect(screen.getByText("Compliance Docs")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Compliance Docs"));
    await waitFor(() => {
      expect(
        screen.getByText("General Liability Policy"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Insurance")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  // ─── Profile with constraint sets ───
  it("renders constraint sets in profile Rules tab", async () => {
    const partyWithConstraints = buildParty({
      id: "party-c",
      name: "Constrained Party",
      constraintSets: [
        {
          id: "cs1",
          tenantId: "t1",
          partyId: "party-c",
          appliesTo: "Party",
          priority: 0,
          status: "Active",
          effectiveStart: "2026-01-01",
          rules: [
            {
              id: "cr1",
              constraintSetId: "cs1",
              type: "Geo",
              field: "STATE",
              operator: "=",
              value: "TX",
              enforcement: "Block",
              action: "Allow",
            },
          ],
        },
      ],
    });
    vi.mocked(getParties).mockResolvedValue([partyWithConstraints]);
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Constrained Party")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Constrained Party"));
    await waitFor(() => {
      expect(screen.getByText("Rules")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(screen.getByText("SET 1")).toBeInTheDocument();
    });
    expect(screen.getByText("Applies to: Party")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Geo = TX")).toBeInTheDocument();
  });

  // ─── Contacts with no contacts empty state ───
  it("shows empty state in Contacts tab when party has no contacts", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("XYZ Repairs")).toBeInTheDocument();
    });

    await user.click(screen.getByText("XYZ Repairs"));
    await waitFor(() => {
      expect(screen.getByText("Auth Contacts")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Auth Contacts"));
    await waitFor(() => {
      expect(screen.getByText("No contacts added yet.")).toBeInTheDocument();
    });
  });

  // ─── Shipper-specific wizard behavior ───
  it("shows Client Classification dropdown for Shipper type in wizard", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    await waitFor(() => {
      // Default type is Shipper, so Client Classification should be visible
      expect(screen.getByText("Client Classification")).toBeInTheDocument();
    });
  });

  // ─── Quick Vendor submit ───
  it("saves quick vendor via Confirm Injection button", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Start Onboarding"));

    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        expect(screen.getByText("Next Phase")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next Phase"));
    }

    await waitFor(() => {
      expect(screen.getByText("+ Quick Vendor")).toBeInTheDocument();
    });
    await user.click(screen.getByText("+ Quick Vendor"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("ENTITY NAME")).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText("ENTITY NAME"),
      "New Vendor Co",
    );
    await user.click(screen.getByText("Confirm Injection"));
    await waitFor(() => {
      expect(saveParty).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Profile side panel signals ───
  it("shows Commercial Signals panel in profile view", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Commercial Signals")).toBeInTheDocument();
    });
    expect(screen.getByText("Identity Verified")).toBeInTheDocument();
  });

  it("shows Critical Warning panel in profile view", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Critical Warning")).toBeInTheDocument();
    });
  });

  it("shows Quick Actions panel in profile view", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));
    await waitFor(() => {
      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    });
    expect(screen.getByText("Safety Log")).toBeInTheDocument();
    expect(screen.getByText("Financial Check")).toBeInTheDocument();
  });
});
