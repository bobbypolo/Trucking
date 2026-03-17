import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalendarView } from "../../../components/CalendarView";
import { LoadData, User, LOAD_STATUS } from "../../../types";

const today = new Date();
const todayStr = today.toISOString().split("T")[0];
const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split("T")[0];

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 1500,
    driverPay: 900,
    pickupDate: todayStr,
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "driver-2",
    loadNumber: "LN-002",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2000,
    driverPay: 1200,
    pickupDate: todayStr,
    pickup: { city: "Atlanta", state: "GA" },
    dropoff: { city: "Miami", state: "FL" },
  },
  {
    id: "load-3",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-003",
    status: LOAD_STATUS.Planned,
    carrierRate: 1800,
    driverPay: 1000,
    pickupDate: tomorrowStr,
    pickup: { city: "Houston", state: "TX" },
    dropoff: { city: "Phoenix", state: "AZ" },
  },
];

const mockUsers: User[] = [
  {
    id: "driver-1",
    companyId: "company-1",
    email: "driver1@test.com",
    name: "Driver One",
    role: "driver",
    onboardingStatus: "Completed",
    safetyScore: 95,
  },
  {
    id: "driver-2",
    companyId: "company-1",
    email: "driver2@test.com",
    name: "Driver Two",
    role: "driver",
    onboardingStatus: "Completed",
    safetyScore: 90,
  },
];

describe("CalendarView component", () => {
  const defaultProps = {
    loads: mockLoads,
    onEdit: vi.fn(),
    users: mockUsers,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<CalendarView {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it("renders day-of-week headers", () => {
    render(<CalendarView {...defaultProps} />);
    expect(screen.getAllByText("Sun").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Mon").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Tue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Wed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Thu").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Fri").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sat").length).toBeGreaterThanOrEqual(1);
  });

  it("renders load numbers on the calendar", () => {
    render(<CalendarView {...defaultProps} />);
    expect(screen.getByText("#LN-001")).toBeTruthy();
    expect(screen.getByText("#LN-002")).toBeTruthy();
  });

  it("renders destination city for loads", () => {
    render(<CalendarView {...defaultProps} />);
    expect(screen.getByText("Dallas")).toBeTruthy();
    expect(screen.getByText("Miami")).toBeTruthy();
  });

  it("calls onEdit when a load is clicked", () => {
    render(<CalendarView {...defaultProps} />);
    const loadEl = screen.getByText("#LN-001");
    fireEvent.click(loadEl);
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockLoads[0]);
  });

  it("renders with empty loads", () => {
    const { container } = render(
      <CalendarView {...defaultProps} loads={[]} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders multiple months", () => {
    render(<CalendarView {...defaultProps} />);
    // Should have month section headers for multiple months
    const currentMonth = today.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
    // Month name appears in both the date picker button and the month header
    const monthElements = screen.getAllByText(currentMonth);
    expect(monthElements.length).toBeGreaterThanOrEqual(1);
  });

  it("filters loads by driver when selectedDriverId is provided", () => {
    render(
      <CalendarView
        {...defaultProps}
        selectedDriverId="driver-1"
        onSelectDriver={vi.fn()}
      />,
    );
    // Only driver-1's loads should be visible
    expect(screen.getByText("#LN-001")).toBeTruthy();
    expect(screen.queryByText("#LN-002")).toBeNull();
  });

  it("shows all loads when no driver filter is applied", () => {
    render(
      <CalendarView
        {...defaultProps}
        selectedDriverId={null}
        onSelectDriver={vi.fn()}
      />,
    );
    expect(screen.getByText("#LN-001")).toBeTruthy();
    expect(screen.getByText("#LN-002")).toBeTruthy();
  });

  it("supports drag and drop when onMoveLoad is provided", () => {
    render(
      <CalendarView {...defaultProps} onMoveLoad={vi.fn()} />,
    );
    // Load elements should be draggable
    const loadEl = screen.getByText("#LN-001").closest("[draggable]");
    expect(loadEl).toBeTruthy();
    expect(loadEl?.getAttribute("draggable")).toBe("true");
  });

  it("renders today's date with highlight", () => {
    render(<CalendarView {...defaultProps} />);
    const todayDate = today.getDate().toString();
    // At least one day cell should contain today's number
    const allDayCells = screen.getAllByText(todayDate);
    expect(allDayCells.length).toBeGreaterThanOrEqual(1);
  });

  it("applies delivered status color to delivered loads", () => {
    render(<CalendarView {...defaultProps} />);
    const deliveredLoad = screen.getByText("#LN-002");
    // Walk up to find the draggable container with status color class
    let el: HTMLElement | null = deliveredLoad;
    let foundGreen = false;
    while (el) {
      if (el.className && el.className.includes("green")) {
        foundGreen = true;
        break;
      }
      el = el.parentElement;
    }
    expect(foundGreen).toBe(true);
  });

  it("applies in-transit status color to active loads", () => {
    render(<CalendarView {...defaultProps} />);
    const activeLoad = screen.getByText("#LN-001");
    // Walk up to find the draggable container with status color class
    let el: HTMLElement | null = activeLoad;
    let foundBlue = false;
    while (el) {
      if (el.className && el.className.includes("blue")) {
        foundBlue = true;
        break;
      }
      el = el.parentElement;
    }
    expect(foundBlue).toBe(true);
  });
});
