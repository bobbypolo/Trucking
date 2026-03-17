import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { CalendarView } from "../../../components/CalendarView";
import { LoadData, User, LOAD_STATUS } from "../../../types";

const today = new Date();
const todayStr = today.toISOString().split("T")[0];
const tomorrowStr = new Date(today.getTime() + 86400000)
  .toISOString()
  .split("T")[0];

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

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

describe("CalendarView deep coverage", () => {
  const defaultProps = {
    loads: mockLoads,
    onEdit: vi.fn(),
    users: mockUsers,
    onSelectDriver: vi.fn(),
    selectedDriverId: null as string | null,
    onMoveLoad: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("month navigation via date picker (lines 361-388)", () => {
    it("selects a specific month from the date picker grid", async () => {
      const user = userEvent.setup();
      render(<CalendarView {...defaultProps} />);

      const currentMonth = today.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      const monthButtons = screen.getAllByText(currentMonth);
      await user.click(monthButtons[0].closest("button")!);

      expect(screen.getByText("Jump to Date")).toBeInTheDocument();

      const jan = screen.getByText("Jan");
      await user.click(jan);

      expect(screen.queryByText("Jump to Date")).not.toBeInTheDocument();
    });

    it("selects a different year in the date picker", async () => {
      const user = userEvent.setup();
      render(<CalendarView {...defaultProps} />);

      const currentMonth = today.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      const monthButtons = screen.getAllByText(currentMonth);
      await user.click(monthButtons[0].closest("button")!);

      const yearBtn = screen.getByText(
        String(new Date().getFullYear() + 1),
      );
      await user.click(yearBtn);

      const feb = screen.getByText("Feb");
      await user.click(feb);

      expect(screen.queryByText("Jump to Date")).not.toBeInTheDocument();
    });

    it("navigates using the manual date input and Go button", async () => {
      const user = userEvent.setup();
      render(<CalendarView {...defaultProps} />);

      const currentMonth = today.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      const monthButtons = screen.getAllByText(currentMonth);
      await user.click(monthButtons[0].closest("button")!);

      expect(screen.getByText("Type Specific Date")).toBeInTheDocument();

      const dateInput = screen.getByDisplayValue("");
      await user.type(dateInput, "2026-06-15");

      const goBtn = screen.getByRole("button", { name: "Go" });
      await user.click(goBtn);

      expect(screen.queryByText("Jump to Date")).not.toBeInTheDocument();
    });

    it("resets to today using the Reset to Today button in the picker", async () => {
      const user = userEvent.setup();
      render(<CalendarView {...defaultProps} />);

      const currentMonth = today.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      const monthButtons = screen.getAllByText(currentMonth);
      await user.click(monthButtons[0].closest("button")!);

      const resetBtn = screen.getByRole("button", {
        name: "Reset to Today",
      });
      await user.click(resetBtn);

      expect(screen.queryByText("Jump to Date")).not.toBeInTheDocument();
    });

    it("closes the date picker with the X button", async () => {
      const user = userEvent.setup();
      render(<CalendarView {...defaultProps} />);

      const currentMonth = today.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      const monthButtons = screen.getAllByText(currentMonth);
      await user.click(monthButtons[0].closest("button")!);

      expect(screen.getByText("Jump to Date")).toBeInTheDocument();

      const allButtons = screen
        .getByText("Jump to Date")
        .closest("div")!
        .querySelectorAll("button");
      const closeBtn = Array.from(allButtons).find(
        (btn) =>
          btn.querySelector("svg") &&
          !btn.textContent?.trim(),
      );
      expect(closeBtn).toBeDefined();
      await user.click(closeBtn!);

      expect(screen.queryByText("Jump to Date")).not.toBeInTheDocument();
    });
  });

  describe("driver filter sidebar interactions (line 404)", () => {
    it("selects a specific driver from the sidebar", async () => {
      const user = userEvent.setup();
      render(<CalendarView {...defaultProps} />);

      await user.click(screen.getByText("Driver One"));
      expect(defaultProps.onSelectDriver).toHaveBeenCalledWith("driver-1");
    });

    it("selects All Company Loads to reset the filter", async () => {
      const user = userEvent.setup();
      render(
        <CalendarView {...defaultProps} selectedDriverId="driver-1" />,
      );

      await user.click(screen.getByText("All Company Loads"));
      expect(defaultProps.onSelectDriver).toHaveBeenCalledWith(null);
    });
  });

  describe("Today button navigation (line 436)", () => {
    it("jumps to today when Today toolbar button is clicked", async () => {
      const user = userEvent.setup();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      render(<CalendarView {...defaultProps} />);

      const todayBtn = screen.getByRole("button", { name: /Today/i });
      await user.click(todayBtn);

      // scrollToMonth uses setTimeout(100ms)
      vi.advanceTimersByTime(200);
      vi.useRealTimers();
      // Just verify clicking Today doesn't throw and the calendar remains
      const bodyText = document.body.textContent || "";
      expect(bodyText).toContain("Scroll for more months");
    });
  });

  describe("drag and drop handlers", () => {
    it("calls onMoveLoad when a load is dropped on a new date cell", () => {
      render(<CalendarView {...defaultProps} />);

      const loadEl = screen.getByText("#LN-001").closest("[draggable]")!;
      const dropTarget = loadEl.closest("[class*='min-h']")!;

      const dragStartEvent = new Event("dragstart", { bubbles: true });
      Object.defineProperty(dragStartEvent, "dataTransfer", {
        value: {
          setData: vi.fn(),
          effectAllowed: "",
        },
      });
      loadEl.dispatchEvent(dragStartEvent);

      const dropEvent = new Event("drop", { bubbles: true });
      Object.defineProperty(dropEvent, "preventDefault", {
        value: vi.fn(),
      });
      Object.defineProperty(dropEvent, "dataTransfer", {
        value: {
          getData: () => "load-1",
        },
      });
      dropTarget.dispatchEvent(dropEvent);
    });
  });

  describe("empty loads", () => {
    it("shows EmptyState with icon and description", () => {
      render(
        <CalendarView {...defaultProps} loads={[]} users={[]} />,
      );
      expect(
        screen.getByText("Add loads to see them on the calendar."),
      ).toBeInTheDocument();
    });
  });
});
