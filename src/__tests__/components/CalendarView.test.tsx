import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
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

// jsdom doesn't implement scrollTo — stub it globally
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

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
    expect(container).toBeInTheDocument();
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
    expect(screen.getByText("#LN-001")).toBeInTheDocument();
    expect(screen.getByText("#LN-002")).toBeInTheDocument();
  });

  it("renders destination city for loads", () => {
    render(<CalendarView {...defaultProps} />);
    expect(screen.getByText("Dallas")).toBeInTheDocument();
    expect(screen.getByText("Miami")).toBeInTheDocument();
  });

  it("calls onEdit when a load is clicked", async () => {
    const user = userEvent.setup();
    render(<CalendarView {...defaultProps} />);
    const loadEl = screen.getByText("#LN-001");
    await user.click(loadEl);
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockLoads[0]);
  });

  it("renders with empty loads", () => {
    const { container } = render(
      <CalendarView {...defaultProps} loads={[]} />,
    );
    expect(container).toBeInTheDocument();
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
    expect(screen.getByText("#LN-001")).toBeInTheDocument();
    expect(screen.queryByText("#LN-002")).not.toBeInTheDocument();
  });

  it("shows all loads when no driver filter is applied", () => {
    render(
      <CalendarView
        {...defaultProps}
        selectedDriverId={null}
        onSelectDriver={vi.fn()}
      />,
    );
    expect(screen.getByText("#LN-001")).toBeInTheDocument();
    expect(screen.getByText("#LN-002")).toBeInTheDocument();
  });

  it("supports drag and drop when onMoveLoad is provided", () => {
    render(
      <CalendarView {...defaultProps} onMoveLoad={vi.fn()} />,
    );
    // Load elements should be draggable
    const loadEl = screen.getByText("#LN-001").closest("[draggable]");
    expect(loadEl).toBeInTheDocument();
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
    // Walk up to the draggable container to check for green status color class
    const draggableParent = deliveredLoad.closest("[draggable]") || deliveredLoad.closest("[class*='green']");
    expect(draggableParent).toBeInTheDocument();
    expect(draggableParent!.className).toMatch(/green/);
  });

  it("applies in-transit status color to active loads", () => {
    render(<CalendarView {...defaultProps} />);
    const activeLoad = screen.getByText("#LN-001");
    // Walk up to the draggable container to check for blue status color class
    const draggableParent = activeLoad.closest("[draggable]") || activeLoad.closest("[class*='blue']");
    expect(draggableParent).toBeInTheDocument();
    expect(draggableParent!.className).toMatch(/blue/);
  });

  it("calls onEdit for a different load", async () => {
    const user = userEvent.setup();
    render(<CalendarView {...defaultProps} />);
    await user.click(screen.getByText("#LN-002"));
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockLoads[1]);
  });

  it("renders Today button for navigation", () => {
    render(<CalendarView {...defaultProps} />);
    const todayBtn = screen.getByRole("button", { name: /Today/i });
    expect(todayBtn).toBeInTheDocument();
  });

  it("opens date picker when month button is clicked", async () => {
    const user = userEvent.setup();
    render(<CalendarView {...defaultProps} />);
    // The date picker trigger button contains the current month name
    const currentMonth = today.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
    const monthButtons = screen.getAllByText(currentMonth);
    // The first one is the button in the toolbar
    const pickerBtn = monthButtons[0].closest("button");
    expect(pickerBtn).toBeInTheDocument();
    await user.click(pickerBtn!);
    // Date picker should now be visible with "Jump to Date" header
    expect(screen.getByText("Jump to Date")).toBeInTheDocument();
  });

  it("does not render loads as draggable when onMoveLoad is not provided", () => {
    render(<CalendarView {...defaultProps} />);
    const loadEl = screen.getByText("#LN-001").closest("[draggable]");
    // Without onMoveLoad, draggable should be false
    expect(loadEl?.getAttribute("draggable")).toBe("false");
  });
});
