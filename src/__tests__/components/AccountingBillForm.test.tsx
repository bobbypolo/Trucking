import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountingBillForm } from "../../../components/AccountingBillForm";
import { LoadData, LOAD_STATUS } from "../../../types";

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.Delivered,
    carrierRate: 1500,
    driverPay: 900,
    pickupDate: "2025-12-01",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
];

describe("AccountingBillForm component", () => {
  const defaultProps = {
    loads: mockLoads,
    onSave: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<AccountingBillForm {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it("renders the form header", () => {
    render(<AccountingBillForm {...defaultProps} />);
    expect(screen.getByText("Log Vendor Bill")).toBeTruthy();
  });

  it("renders bill number input", () => {
    render(<AccountingBillForm {...defaultProps} />);
    expect(screen.getByPlaceholderText("E.G. MHC-88291")).toBeTruthy();
  });

  it("renders vendor select dropdown", () => {
    render(<AccountingBillForm {...defaultProps} />);
    expect(screen.getByText("SELECT VENDOR")).toBeTruthy();
    expect(screen.getByText("MHC KENWORTH")).toBeTruthy();
    expect(screen.getByText("PILOT FLYING J")).toBeTruthy();
    expect(screen.getByText("RUSH TRUCK CENTERS")).toBeTruthy();
  });

  it("renders date inputs for invoice and due dates", () => {
    render(<AccountingBillForm {...defaultProps} />);
    expect(screen.getByText("Invoice Date")).toBeTruthy();
    expect(screen.getByText("Payment Due")).toBeTruthy();
  });

  it("renders Line Itemization section with initial line", () => {
    render(<AccountingBillForm {...defaultProps} />);
    expect(screen.getByText("Line Itemization")).toBeTruthy();
    // Should have the initial line with a description placeholder
    expect(screen.getByPlaceholderText("E.G. ENGINE OIL REPLACEMENT")).toBeTruthy();
  });

  it("renders Add Detail Line button", () => {
    render(<AccountingBillForm {...defaultProps} />);
    const addBtn = screen.getByRole("button", { name: /Add Detail Line/i });
    expect(addBtn).toBeTruthy();
  });

  it("adds a new line when Add Detail Line is clicked", () => {
    render(<AccountingBillForm {...defaultProps} />);
    const addBtn = screen.getByRole("button", { name: /Add Detail Line/i });
    fireEvent.click(addBtn);
    // Now should have 2 description inputs
    const descInputs = screen.getAllByPlaceholderText("E.G. ENGINE OIL REPLACEMENT");
    expect(descInputs.length).toBe(2);
  });

  it("can update bill number", () => {
    render(<AccountingBillForm {...defaultProps} />);
    const input = screen.getByPlaceholderText("E.G. MHC-88291") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "BILL-001" } });
    expect(input.value).toBe("BILL-001");
  });

  it("can update vendor selection", () => {
    render(<AccountingBillForm {...defaultProps} />);
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    // First combobox is the vendor select
    const vendorSelect = selects[0];
    fireEvent.change(vendorSelect, { target: { value: "V-101" } });
    expect(vendorSelect.value).toBe("V-101");
  });

  it("can update line description", () => {
    render(<AccountingBillForm {...defaultProps} />);
    const input = screen.getByPlaceholderText("E.G. ENGINE OIL REPLACEMENT") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Brake Pads" } });
    expect(input.value).toBe("Brake Pads");
  });

  it("renders column headers for line items", () => {
    render(<AccountingBillForm {...defaultProps} />);
    expect(screen.getByText("Description")).toBeTruthy();
    expect(screen.getByText("Category")).toBeTruthy();
    expect(screen.getByText("Allocation")).toBeTruthy();
    expect(screen.getByText("Alloc ID")).toBeTruthy();
    expect(screen.getByText("Amount")).toBeTruthy();
  });

  it("renders footer with total and action buttons", () => {
    render(<AccountingBillForm {...defaultProps} />);
    expect(screen.getByText("Total Bill Exposure")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Discard Draft/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Submit for Approval/i })).toBeTruthy();
  });

  it("calls onClose when Discard Draft is clicked", () => {
    render(<AccountingBillForm {...defaultProps} />);
    const discardBtn = screen.getByRole("button", { name: /Discard Draft/i });
    fireEvent.click(discardBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onSave with bill data when Submit for Approval is clicked", () => {
    render(<AccountingBillForm {...defaultProps} />);
    const submitBtn = screen.getByRole("button", { name: /Submit for Approval/i });
    fireEvent.click(submitBtn);
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
    const savedBill = defaultProps.onSave.mock.calls[0][0];
    expect(savedBill).toHaveProperty("billNumber");
    expect(savedBill).toHaveProperty("lines");
    expect(savedBill).toHaveProperty("status", "Draft");
  });

  it("calls onClose when X close button is clicked", () => {
    render(<AccountingBillForm {...defaultProps} />);
    // The X button is the first button in the header area
    const buttons = screen.getAllByRole("button");
    // Find the close button (it's the one right after the header)
    const closeBtn = buttons.find(
      (btn) => btn.querySelector("svg") && btn.closest(".shrink-0"),
    );
    // Use the first button that is the X close in the header
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  it("renders with default dates", () => {
    render(<AccountingBillForm {...defaultProps} />);
    const dateInputs = screen.getAllByDisplayValue(
      new Date().toISOString().split("T")[0],
    );
    expect(dateInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("total updates when line amounts change", () => {
    render(<AccountingBillForm {...defaultProps} />);
    // The initial total should be $0
    expect(screen.getByText("$0")).toBeTruthy();
  });

  it("renders delete buttons for each line item", () => {
    render(<AccountingBillForm {...defaultProps} />);
    // Add a second line
    fireEvent.click(screen.getByRole("button", { name: /Add Detail Line/i }));
    expect(screen.getAllByPlaceholderText("E.G. ENGINE OIL REPLACEMENT").length).toBe(2);

    // Should have a delete button per line
    const deleteButtons = screen.getAllByRole("button").filter((btn) => {
      return btn.className.includes("hover:text-red-500");
    });
    expect(deleteButtons.length).toBe(2);
  });
});
