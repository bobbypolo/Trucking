import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NetworkPortal } from "../../../components/NetworkPortal";
import type { NetworkParty } from "../../../types";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock("../../../services/networkService", () => ({
  getParties: vi.fn(),
  saveParty: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-deep"),
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

const vendorParty = buildParty({
  id: "vendor-1",
  name: "VendorCo Services",
  type: "Vendor" as any,
  status: "Approved",
  isCustomer: false,
  isVendor: true,
});

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
  vendorParty,
  buildParty({
    id: "party-3",
    name: "FastFreight Inc",
    type: "Broker",
    status: "In_Review",
  }),
];

const defaultProps = {
  companyId: "company-1",
};

/* ------------------------------------------------------------------ */
/*  Tests targeting uncovered lines 2204-2256 and deeper coverage      */
/* ------------------------------------------------------------------ */

describe("NetworkPortal deep coverage — quick create modals and wizard step 5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getParties).mockResolvedValue(mockParties);
    vi.mocked(saveParty).mockResolvedValue(undefined);
  });

  /* ---- Helper: navigate to wizard step 5 ---- */

  async function navigateToWizardStep5(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Start Onboarding"));

    // Step 1: Select Entity Class
    await waitFor(() => {
      expect(screen.getByText("Select Entity Class")).toBeInTheDocument();
    });

    // Step 1 -> 2
    await user.click(screen.getByText(/Next Step/));

    // Step 2: Entity Info — fill in required company name so wizard validation passes on step 5
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("FULL REGISTERED NAME"),
      ).toBeInTheDocument();
    });
    await user.type(
      screen.getByPlaceholderText("FULL REGISTERED NAME"),
      "Test Company LLC",
    );

    // Step 2 -> 3
    await user.click(screen.getByText(/Next Step/));

    // Step 3 -> 4
    await waitFor(() => {
      expect(screen.getByText(/Next Step/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Next Step/));

    // Step 4 -> 5
    await waitFor(() => {
      expect(screen.getByText(/Next Step/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Next Step/));

    // Now on step 5 — Save to Registry button only appears on step 5
    await waitFor(() => {
      expect(screen.getByText(/Save to Registry/)).toBeInTheDocument();
    });
  }

  /* ---- Helper: navigate to wizard step 4 (Rates & Terms) ---- */

  async function navigateToWizardStep4(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Start Onboarding"));

    await waitFor(() => {
      expect(screen.getByText("Select Entity Class")).toBeInTheDocument();
    });

    // Step 1 -> 2
    await user.click(screen.getByText(/Next Step/));
    await waitFor(() => {
      expect(screen.getByText(/Next Step/)).toBeInTheDocument();
    });
    // Step 2 -> 3
    await user.click(screen.getByText(/Next Step/));
    await waitFor(() => {
      expect(screen.getByText(/Next Step/)).toBeInTheDocument();
    });
    // Step 3 -> 4
    await user.click(screen.getByText(/Next Step/));

    // Step 4: Rates & Terms — check for Add Rate Row which is unique to step 4
    await waitFor(() => {
      expect(screen.getByText(/Add Rate Row/)).toBeInTheDocument();
    });
  }

  /* ---- WIZARD STEP 4: RATES & TERMS ---- */

  it("shows Add Rate Row and New Constraint buttons on wizard step 4", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep4(user);

    await waitFor(() => {
      expect(screen.getByText(/Add Rate Row/)).toBeInTheDocument();
      expect(screen.getByText(/New Constraint/)).toBeInTheDocument();
    });
  });

  /* ---- WIZARD STEP 5: REVIEW & SAVE ---- */

  it("displays entity class in the step 5 summary card", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    // Default selectedEntityClass is "Customer" — multiple elements may contain it
    const customers = screen.getAllByText(/Customer/);
    expect(customers.length).toBeGreaterThanOrEqual(1);
    // The review summary heading is present (appears as both progress label and h2)
    const reviewHeadings = screen.getAllByText("Review & Save");
    expect(reviewHeadings.length).toBeGreaterThanOrEqual(1);
  });

  it("shows A/R ENABLED badge when isCustomer is true on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    // Default formData has isCustomer: true
    expect(screen.getByText("A/R ENABLED")).toBeInTheDocument();
  });

  it("shows status selector on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    expect(screen.getByLabelText("Entity status")).toBeInTheDocument();
  });

  it("allows changing status to Submission / Review on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    const statusSelect = screen.getByLabelText("Entity status");
    await user.selectOptions(statusSelect, "In_Review");

    expect(screen.getByDisplayValue("Submission / Review")).toBeInTheDocument();
  });

  it("shows compliance verification message on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    expect(
      screen.getByText(/Compliance verification queued automatically/),
    ).toBeInTheDocument();
  });

  it("shows Save to Registry button on step 5 instead of Next Step", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    expect(screen.getByText(/Save to Registry/)).toBeInTheDocument();
    expect(screen.queryByText(/Next Step/)).not.toBeInTheDocument();
  });

  it("calls saveParty when Save to Registry is clicked on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    await user.click(screen.getByText(/Save to Registry/));

    await waitFor(() => {
      expect(saveParty).toHaveBeenCalled();
    });
  });

  it("shows Back button on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  it("goes back to step 4 when Back is clicked on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    await user.click(screen.getByText("Back"));

    await waitFor(() => {
      // Step 4 shows Add Rate Row button (unique to step 4)
      expect(screen.getByText(/Add Rate Row/)).toBeInTheDocument();
    });
  });

  /* ---- PROFILE VIEW TABS ---- */

  it("navigates to profile view and shows IDENTITY tab by default", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    // Click on a party card
    await user.click(screen.getByText("ABC Logistics"));

    await waitFor(() => {
      expect(screen.getByText("Identity")).toBeInTheDocument();
      expect(screen.getByText("Entity Name")).toBeInTheDocument();
    });
  });

  it("shows profile tabs: Identity, Contacts, Services, Pricing, Rules, Documents", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));

    await waitFor(() => {
      expect(screen.getByText("Identity")).toBeInTheDocument();
      expect(screen.getByText("Contacts")).toBeInTheDocument();
      expect(screen.getByText("Services")).toBeInTheDocument();
      expect(screen.getByText("Pricing")).toBeInTheDocument();
      expect(screen.getByText("Rules")).toBeInTheDocument();
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
  });

  it("shows Quick Actions section (Safety Log, Financial) in profile view", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));

    await waitFor(() => {
      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
      expect(screen.getByText("Safety Log")).toBeInTheDocument();
      expect(screen.getByText("View History")).toBeInTheDocument();
      expect(screen.getByText("Financial")).toBeInTheDocument();
      expect(screen.getByText("Verify Credit")).toBeInTheDocument();
    });
  });

  it("navigates back to dashboard when back button is clicked in profile", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));

    await waitFor(() => {
      expect(screen.getByText("Identity")).toBeInTheDocument();
    });

    // Find the back button (rotated chevron)
    const buttons = screen.getAllByRole("button");
    const backBtn = buttons.find(
      (btn) =>
        btn.className.includes("rounded-xl") &&
        btn.className.includes("bg-slate-900") &&
        btn.querySelector("svg"),
    );
    expect(backBtn).toBeDefined();
    await user.click(backBtn!);

    await waitFor(() => {
      expect(screen.getByText("Onboarding")).toBeInTheDocument();
    });
  });

  it("shows New Relation and Export buttons in profile header", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));

    await waitFor(() => {
      expect(screen.getByText(/New Relation/)).toBeInTheDocument();
      expect(screen.getByText("Export")).toBeInTheDocument();
    });
  });

  /* ---- WIZARD STEP 1: DISCARD & RETURN ---- */

  it("returns to dashboard when Discard & Return is clicked on step 1", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Start Onboarding"));

    await waitFor(() => {
      expect(screen.getByText("Select Entity Class")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Discard & Return"));

    await waitFor(() => {
      expect(screen.getByText("Onboarding")).toBeInTheDocument();
    });
  });

  /* ---- TOAST ON SAVE FAILURE ---- */

  it("shows error toast when saveParty fails during Save to Registry", async () => {
    vi.mocked(saveParty).mockRejectedValueOnce(new Error("Network error"));
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    await user.click(screen.getByText(/Save to Registry/));

    await waitFor(() => {
      expect(screen.getByTestId("toast-mock")).toBeInTheDocument();
      // Tests R-P1-06: NetworkPortal toast surfaces actual error message
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});
