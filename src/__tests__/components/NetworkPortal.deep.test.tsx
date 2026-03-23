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

  async function navigateToWizardStep5(user: ReturnType<typeof userEvent.setup>) {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Start Onboarding"));

    // Step 1
    await waitFor(() => {
      expect(screen.getByText("Identity & Strategy")).toBeInTheDocument();
    });

    // Fill in required company name so wizard validation passes on step 5
    await user.type(
      screen.getByPlaceholderText("FULL REGISTERED NAME"),
      "Test Company LLC",
    );

    // Step 1 -> 2
    await user.click(screen.getByText("Next Phase"));

    // Step 2 -> 3
    await waitFor(() => {
      expect(screen.getByText("Next Phase")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Next Phase"));

    // Step 3 -> 4
    await waitFor(() => {
      expect(screen.getByText("Next Phase")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Next Phase"));

    // Step 4 -> 5
    await waitFor(() => {
      expect(screen.getByText("Next Phase")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Next Phase"));

    // Now on step 5
    await waitFor(() => {
      expect(
        screen.getByText("Final Validation & Network Commit"),
      ).toBeInTheDocument();
    });
  }

  /* ---- Helper: navigate to wizard step 4 (contains quick vendor/equip buttons) ---- */

  async function navigateToWizardStep4(user: ReturnType<typeof userEvent.setup>) {
    render(<NetworkPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Start Onboarding")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Start Onboarding"));

    await waitFor(() => {
      expect(screen.getByText("Identity & Strategy")).toBeInTheDocument();
    });

    // Step 1 -> 2
    await user.click(screen.getByText("Next Phase"));
    await waitFor(() => {
      expect(screen.getByText("Next Phase")).toBeInTheDocument();
    });
    // Step 2 -> 3
    await user.click(screen.getByText("Next Phase"));
    await waitFor(() => {
      expect(screen.getByText("Next Phase")).toBeInTheDocument();
    });
    // Step 3 -> 4
    await user.click(screen.getByText("Next Phase"));

    // Step 4 has the quick vendor/equip buttons
    await waitFor(() => {
      expect(screen.getByText("+ Quick Vendor")).toBeInTheDocument();
      expect(screen.getByText("+ Quick Equip")).toBeInTheDocument();
    });
  }

  /* ---- QUICK VENDOR MODAL ---- */

  it("opens Quick Vendor modal when clicking + Quick Vendor on wizard step 4", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep4(user);

    await user.click(screen.getByText("+ Quick Vendor"));

    await waitFor(() => {
      expect(screen.getByText("QUICK VENDOR")).toBeInTheDocument();
      expect(
        screen.getByText("Lightweight Injection Matrix"),
      ).toBeInTheDocument();
      expect(screen.getByText("Legal Name")).toBeInTheDocument();
      expect(screen.getByText("Offering")).toBeInTheDocument();
      expect(screen.getByText("Tax ID")).toBeInTheDocument();
      expect(screen.getByText("Confirm Injection")).toBeInTheDocument();
    });
  });

  it("fills quick vendor form and confirms injection to save vendor", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep4(user);

    await user.click(screen.getByText("+ Quick Vendor"));

    await waitFor(() => {
      expect(screen.getByText("Confirm Injection")).toBeInTheDocument();
    });

    // Fill vendor name
    const nameInput = screen.getByPlaceholderText("ENTITY NAME");
    await user.type(nameInput, "New Vendor LLC");

    // Fill tax ID
    const taxInput = screen.getByPlaceholderText("00-0000000");
    await user.type(taxInput, "12-3456789");

    // Change offering select
    const offeringSelect = screen.getByDisplayValue("SERVICE");
    await user.selectOptions(offeringSelect, "PRODUCT");

    // Confirm
    await user.click(screen.getByText("Confirm Injection"));

    await waitFor(() => {
      expect(saveParty).toHaveBeenCalled();
      const savedParty = vi.mocked(saveParty).mock.calls[0][0] as any;
      expect(savedParty.name).toBe("New Vendor LLC");
      expect(savedParty.type).toBe("Vendor");
      expect(savedParty.status).toBe("Approved");
      expect(savedParty.isVendor).toBe(true);
    });
  });

  it("saves vendor with default name UNNAMED VENDOR when name is empty", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep4(user);

    await user.click(screen.getByText("+ Quick Vendor"));

    await waitFor(() => {
      expect(screen.getByText("Confirm Injection")).toBeInTheDocument();
    });

    // Do NOT fill name field, just confirm
    await user.click(screen.getByText("Confirm Injection"));

    await waitFor(() => {
      expect(saveParty).toHaveBeenCalled();
      const savedParty = vi.mocked(saveParty).mock.calls[0][0] as any;
      expect(savedParty.name).toBe("UNNAMED VENDOR");
    });
  });

  it("closes quick vendor modal when X button is clicked", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep4(user);

    await user.click(screen.getByText("+ Quick Vendor"));

    await waitFor(() => {
      expect(screen.getByText("QUICK VENDOR")).toBeInTheDocument();
    });

    // Find and click the X close button in the modal header
    const closeButtons = screen.getAllByRole("button");
    const modalCloseBtn = closeButtons.find(
      (btn) =>
        btn.className.includes("rounded-2xl") &&
        btn.className.includes("text-slate-500") &&
        btn.closest(".fixed"),
    );
    expect(modalCloseBtn).toBeDefined();
    await user.click(modalCloseBtn!);

    await waitFor(() => {
      expect(screen.queryByText("QUICK VENDOR")).not.toBeInTheDocument();
    });
  });

  /* ---- QUICK EQUIP MODAL ---- */

  it("opens Quick Equip modal when clicking + Quick Equip on wizard step 4", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep4(user);

    await user.click(screen.getByText("+ Quick Equip"));

    await waitFor(() => {
      expect(screen.getByText("QUICK EQUIP")).toBeInTheDocument();
      expect(screen.getByText("Legal Name")).toBeInTheDocument();
      expect(screen.getByText("Unit #")).toBeInTheDocument();
      expect(screen.getByText("Plate / VIN")).toBeInTheDocument();
    });
  });

  it("fills quick equip form fields (unit number and VIN) and confirms", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep4(user);

    await user.click(screen.getByText("+ Quick Equip"));

    await waitFor(() => {
      expect(screen.getByText("Confirm Injection")).toBeInTheDocument();
    });

    // Fill unit number
    const unitInput = screen.getByPlaceholderText("TRK-99");
    await user.type(unitInput, "TRK-42");

    // Fill VIN
    const vinInput = screen.getByPlaceholderText("VIN...");
    await user.type(vinInput, "1HGCM82633A123456");

    // Confirm - this creates an equipment asset locally (no saveParty call)
    await user.click(screen.getByText("Confirm Injection"));

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText("QUICK EQUIP")).not.toBeInTheDocument();
    });
  });

  it("creates equipment asset with default UNIT-X when unit number is empty", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep4(user);

    await user.click(screen.getByText("+ Quick Equip"));

    await waitFor(() => {
      expect(screen.getByText("Confirm Injection")).toBeInTheDocument();
    });

    // Confirm without filling - should use defaults
    await user.click(screen.getByText("Confirm Injection"));

    // Modal should close after injection
    await waitFor(() => {
      expect(screen.queryByText("QUICK EQUIP")).not.toBeInTheDocument();
    });
  });

  /* ---- WIZARD STEP 5: FINAL VALIDATION ---- */

  it("displays party type in the step 5 summary card", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    // Default formData type is "Shipper" — multiple elements may contain it
    const shippers = screen.getAllByText(/Shipper/);
    expect(shippers.length).toBeGreaterThanOrEqual(1);
    // The review summary heading is present
    expect(
      screen.getByText("Final Validation & Network Commit"),
    ).toBeInTheDocument();
  });

  it("shows A/R ENABLED badge when isCustomer is true on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    // Default formData has isCustomer: true
    expect(screen.getByText("A/R ENABLED")).toBeInTheDocument();
  });

  it("shows status selector with Live / Approved option on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    expect(screen.getByDisplayValue("Live / Approved")).toBeInTheDocument();
  });

  it("allows changing status to Submission / Review on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    const statusSelect = screen.getByDisplayValue("Live / Approved");
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

  it("shows Commit to Registry button on step 5 instead of Next Phase", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    expect(screen.getByText("Commit to Registry")).toBeInTheDocument();
    expect(screen.queryByText("Next Phase")).not.toBeInTheDocument();
  });

  it("calls saveParty when Commit to Registry is clicked on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    await user.click(screen.getByText("Commit to Registry"));

    await waitFor(() => {
      expect(saveParty).toHaveBeenCalled();
    });
  });

  it("shows Backtrack Step button on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    expect(screen.getByText("Backtrack Step")).toBeInTheDocument();
  });

  it("goes back to step 4 when Backtrack Step is clicked on step 5", async () => {
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    await user.click(screen.getByText("Backtrack Step"));

    await waitFor(() => {
      // Step 4 has the quick vendor/equip buttons
      expect(screen.getByText("+ Quick Vendor")).toBeInTheDocument();
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
      expect(screen.getByText("Party Identity")).toBeInTheDocument();
      expect(screen.getByText("Base Identity Name")).toBeInTheDocument();
    });
  });

  it("shows profile tabs: Identity, Contacts, Services, Pricing, Rules, Compliance Docs", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));

    await waitFor(() => {
      expect(screen.getByText("Party Identity")).toBeInTheDocument();
      expect(screen.getByText("Auth Contacts")).toBeInTheDocument();
      expect(screen.getByText("Services")).toBeInTheDocument();
      expect(screen.getByText("Pricing")).toBeInTheDocument();
      expect(screen.getByText("Rules")).toBeInTheDocument();
      expect(screen.getByText("Compliance Docs")).toBeInTheDocument();
    });
  });

  it("shows Quick Actions section (Safety Log, Financial Check) in profile view", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));

    await waitFor(() => {
      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
      expect(screen.getByText("Safety Log")).toBeInTheDocument();
      expect(screen.getByText("View Violation History")).toBeInTheDocument();
      expect(screen.getByText("Financial Check")).toBeInTheDocument();
      expect(screen.getByText("Verify Credit Matrix")).toBeInTheDocument();
    });
  });

  it("shows Critical Warning section about COI expiries in profile view", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));

    await waitFor(() => {
      expect(screen.getByText("Critical Warning")).toBeInTheDocument();
      expect(
        screen.getByText(/COI expiries within 12 days/),
      ).toBeInTheDocument();
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
      expect(screen.getByText("Party Identity")).toBeInTheDocument();
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
      expect(screen.getByText("Partner Network Registry")).toBeInTheDocument();
    });
  });

  it("shows New Relation and Export SQL buttons in profile header", async () => {
    const user = userEvent.setup();
    render(<NetworkPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("ABC Logistics")).toBeInTheDocument();
    });

    await user.click(screen.getByText("ABC Logistics"));

    await waitFor(() => {
      expect(screen.getByText(/New Relation/)).toBeInTheDocument();
      expect(screen.getByText("Export SQL")).toBeInTheDocument();
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
      expect(screen.getByText("Identity & Strategy")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Discard & Return"));

    await waitFor(() => {
      expect(screen.getByText("Partner Network Registry")).toBeInTheDocument();
    });
  });

  /* ---- TOAST ON SAVE FAILURE ---- */

  it("shows error toast when saveParty fails during Commit to Registry", async () => {
    vi.mocked(saveParty).mockRejectedValueOnce(new Error("Network error"));
    const user = userEvent.setup();
    await navigateToWizardStep5(user);

    await user.click(screen.getByText("Commit to Registry"));

    await waitFor(() => {
      expect(screen.getByTestId("toast-mock")).toBeInTheDocument();
      expect(screen.getByText("Failed to save party")).toBeInTheDocument();
    });
  });
});
