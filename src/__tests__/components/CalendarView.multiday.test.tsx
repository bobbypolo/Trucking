import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { CalendarView } from "../../../components/CalendarView";
import { LoadData, LOAD_STATUS } from "../../../types";

// Tests R-P6-07

// Use fixed dates in the current month to ensure they render on screen
const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();

// Create date strings for a 3-day span (10th through 12th of current month)
const pickupDate = new Date(year, month, 10).toISOString().split("T")[0];
const midDate = new Date(year, month, 11).toISOString().split("T")[0];
const dropoffDate = new Date(year, month, 12).toISOString().split("T")[0];

// Single-day load (no dropoffDate) for comparison
const singleDayPickup = new Date(year, month, 15).toISOString().split("T")[0];

const multiDayLoad: LoadData = {
  id: "multi-1",
  companyId: "company-1",
  driverId: "driver-1",
  loadNumber: "MULTI-001",
  status: LOAD_STATUS.In_Transit,
  carrierRate: 2500,
  driverPay: 1500,
  pickupDate: pickupDate,
  dropoffDate: dropoffDate,
  pickup: { city: "Los Angeles", state: "CA" },
  dropoff: { city: "New York", state: "NY" },
};

const singleDayLoad: LoadData = {
  id: "single-1",
  companyId: "company-1",
  driverId: "driver-1",
  loadNumber: "SINGLE-001",
  status: LOAD_STATUS.Planned,
  carrierRate: 800,
  driverPay: 500,
  pickupDate: singleDayPickup,
  pickup: { city: "Chicago", state: "IL" },
  dropoff: { city: "Milwaukee", state: "WI" },
};

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

describe("CalendarView multi-day load visualization (R-P6-07)", () => {
  const defaultProps = {
    loads: [multiDayLoad, singleDayLoad],
    onEdit: vi.fn(),
  };

  it("renders multi-day load on all days between pickup and delivery", () => {
    render(<CalendarView {...defaultProps} />);

    // The multi-day load (MULTI-001) should appear on all 3 days:
    // pickup day, intermediate day, and delivery day
    const multiLoadElements = screen.getAllByText("#MULTI-001");
    expect(multiLoadElements.length).toBe(3);
  });

  it("renders single-day load only once (no dropoffDate)", () => {
    render(<CalendarView {...defaultProps} />);

    // The single-day load should appear only once (on pickup day)
    const singleLoadElements = screen.getAllByText("#SINGLE-001");
    expect(singleLoadElements.length).toBe(1);
  });

  it("shows spanning indicator on multi-day loads", () => {
    render(<CalendarView {...defaultProps} />);

    // Multi-day loads should have a visual spanning indicator
    const multiLoadElements = screen.getAllByText("#MULTI-001");

    // Each instance should have a span-indicator parent or data attribute
    multiLoadElements.forEach((el) => {
      const card = el.closest("[data-multiday]");
      expect(card).toBeInTheDocument();
      expect(card?.getAttribute("data-multiday")).toBe("true");
    });
  });

  it("marks first day, middle days, and last day of multi-day span", () => {
    render(<CalendarView {...defaultProps} />);

    const multiLoadElements = screen.getAllByText("#MULTI-001");
    // 3 days: pickup (10th), middle (11th), delivery (12th)
    expect(multiLoadElements.length).toBe(3);

    // First day should be marked as span-start
    const firstCard = multiLoadElements[0].closest("[data-span-position]");
    expect(firstCard?.getAttribute("data-span-position")).toBe("start");

    // Middle day should be marked as span-middle
    const middleCard = multiLoadElements[1].closest("[data-span-position]");
    expect(middleCard?.getAttribute("data-span-position")).toBe("middle");

    // Last day should be marked as span-end
    const lastCard = multiLoadElements[2].closest("[data-span-position]");
    expect(lastCard?.getAttribute("data-span-position")).toBe("end");
  });

  it("does not mark single-day loads as multi-day", () => {
    render(<CalendarView {...defaultProps} />);

    const singleLoadEl = screen.getByText("#SINGLE-001");
    const card = singleLoadEl.closest("[data-multiday]");
    // Single-day loads should not have the multiday attribute
    expect(card).toBeNull();
  });

  it("handles load with same pickup and dropoff date as single-day", () => {
    const sameDayLoad: LoadData = {
      id: "same-day-1",
      companyId: "company-1",
      driverId: "driver-1",
      loadNumber: "SAME-001",
      status: LOAD_STATUS.Planned,
      carrierRate: 600,
      driverPay: 400,
      pickupDate: singleDayPickup,
      dropoffDate: singleDayPickup, // Same as pickup
      pickup: { city: "Detroit", state: "MI" },
      dropoff: { city: "Ann Arbor", state: "MI" },
    };

    render(
      <CalendarView
        loads={[sameDayLoad]}
        onEdit={vi.fn()}
      />,
    );

    const elements = screen.getAllByText("#SAME-001");
    expect(elements.length).toBe(1);
  });
});
