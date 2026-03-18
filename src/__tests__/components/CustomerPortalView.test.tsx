// Tests R-P3-06, R-P3-07, R-P3-08
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CustomerPortalView } from "../../../components/CustomerPortalView";
import { LoadData, User, LOAD_STATUS } from "../../../types";

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "customer@test.com",
  name: "Test Customer",
  role: "customer",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const deliveredLoad: LoadData = {
  id: "load-delivered",
  companyId: "company-1",
  driverId: "driver-1",
  customerUserId: "user-1",
  loadNumber: "LN-REAL-001",
  status: "delivered" as any,
  carrierRate: 3500,
  driverPay: 2100,
  pickupDate: "2025-12-01",
  dropoffDate: "2025-12-02",
  pickup: { city: "Chicago", state: "IL" },
  dropoff: { city: "Dallas", state: "TX" },
};

describe("CustomerPortalView: no hardcoded mock data (R-P3-06)", () => {
  it("does not contain INV-8409, $4,250.00, TRK-491, Syracuse NY, 142 Miles, 78% Complete, 4h 32m", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CustomerPortalView user={mockUser} loads={[deliveredLoad]} />,
    );

    // Navigate to invoices
    const invoiceBtn = screen.getByText(/invoice center/i);
    await user.click(invoiceBtn);

    const html = container.innerHTML;
    expect(html).not.toContain("INV-8409");
    expect(html).not.toContain("$4,250.00");
    expect(html).not.toContain("TRK-491");
    expect(html).not.toContain("Syracuse, NY");
    expect(html).not.toContain("142 Miles");
    expect(html).not.toContain("78% Complete");
    expect(html).not.toContain("4h 32m");
  });
});

describe("CustomerPortalView: EmptyState for zero delivered loads (R-P3-07)", () => {
  it("renders No invoices message when given zero delivered loads", async () => {
    const user = userEvent.setup();
    render(<CustomerPortalView user={mockUser} loads={[]} />);

    // Navigate to invoices tab
    const invoiceBtn = screen.getByText(/invoice center/i);
    await user.click(invoiceBtn);

    // Should show "No invoices" message
    const text = document.body.textContent || "";
    expect(text.toLowerCase()).toContain("no invoices");
  });
});

describe("CustomerPortalView: quote form submit (R-P3-08)", () => {
  it("calls onSubmitQuote callback with form data when submit is clicked", async () => {
    const user = userEvent.setup();
    const onSubmitQuote = vi.fn();
    render(
      <CustomerPortalView
        user={mockUser}
        loads={[]}
        onSubmitQuote={onSubmitQuote}
      />,
    );

    // Navigate to quotes tab
    const quotesBtn = screen.getByText(/request quote/i);
    await user.click(quotesBtn);

    // Submit the form
    const submitBtn = screen.getByRole("button", {
      name: /submit priority request/i,
    });
    await user.click(submitBtn);

    // Callback should have been called
    expect(onSubmitQuote).toHaveBeenCalledTimes(1);
    expect(onSubmitQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: expect.any(String),
        destination: expect.any(String),
        equipment: expect.any(String),
      }),
    );
  });

  it("shows Contact dispatch message after submit when no onSubmitQuote provided", async () => {
    const user = userEvent.setup();
    render(<CustomerPortalView user={mockUser} loads={[]} />);

    // Navigate to quotes tab
    const quotesBtn = screen.getByText(/request quote/i);
    await user.click(quotesBtn);

    // Submit the form
    const submitBtn = screen.getByRole("button", {
      name: /submit priority request/i,
    });
    await user.click(submitBtn);

    // Should show Contact text
    const text = document.body.textContent || "";
    expect(text.toLowerCase()).toContain("contact dispatch");
  });
});
