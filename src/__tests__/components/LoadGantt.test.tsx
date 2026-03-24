import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LoadGantt } from "../../../components/LoadGantt";
import { LoadData, LOAD_STATUS } from "../../../types";

const createLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: `load-${Math.random().toString(36).slice(2)}`,
  companyId: "c1",
  driverId: "driver-1",
  loadNumber: "LN-100",
  status: LOAD_STATUS.Planned,
  carrierRate: 2000,
  driverPay: 1200,
  pickupDate: "2025-12-01",
  pickup: { city: "Chicago", state: "IL" },
  dropoff: { city: "Dallas", state: "TX" },
  ...overrides,
});

describe("LoadGantt component", () => {
  describe("rendering", () => {
    it("renders without crashing", () => {
      render(<LoadGantt loads={[]} />);
      expect(screen.getByText("Operational Sequence")).toBeInTheDocument();
    });

    it("renders the header title", () => {
      render(<LoadGantt loads={[]} />);
      expect(screen.getByText("Operational Sequence")).toBeInTheDocument();
    });

    it("renders legend items", () => {
      render(<LoadGantt loads={[]} />);
      expect(screen.getByText("Planned")).toBeInTheDocument();
      expect(screen.getByText("Execution")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });

    it("renders footer text", () => {
      render(<LoadGantt loads={[]} />);
      expect(
        screen.getByText(/SCROLL TO VIEW ALL ACTIVE MANIFESTS/),
      ).toBeInTheDocument();
    });

    it("renders sync indicator based on load count", () => {
      // With no loads, the indicator shows "NO ACTIVE LOADS"
      render(<LoadGantt loads={[]} />);
      expect(screen.getByText("NO ACTIVE LOADS")).toBeInTheDocument();
    });

    it("renders 'REAL-TIME SYNC ACTIVE' when loads are present", () => {
      const { unmount } = render(<LoadGantt loads={[createLoad()]} />);
      expect(screen.getByText("REAL-TIME SYNC ACTIVE")).toBeInTheDocument();
      unmount();
    });

    it("renders load count label from loads.length", () => {
      // With no loads, footer shows "0 LOADS TRACKED"
      render(<LoadGantt loads={[]} />);
      expect(screen.getByText("0 LOADS TRACKED")).toBeInTheDocument();
    });
  });

  describe("with loads data", () => {
    const loads = [
      createLoad({
        id: "l1",
        loadNumber: "LN-001",
        status: LOAD_STATUS.In_Transit,
        commodity: "Electronics",
      }),
      createLoad({
        id: "l2",
        loadNumber: "LN-002",
        status: LOAD_STATUS.Planned,
        commodity: "Furniture",
      }),
      createLoad({
        id: "l3",
        loadNumber: "LN-003",
        status: LOAD_STATUS.Delivered,
        commodity: "Food",
      }),
      createLoad({
        id: "l4",
        loadNumber: "LN-004",
        status: LOAD_STATUS.Draft,
      }),
    ];

    it("renders load numbers", () => {
      render(<LoadGantt loads={loads} />);
      expect(screen.getByText("#LN-001")).toBeInTheDocument();
      expect(screen.getByText("#LN-002")).toBeInTheDocument();
      expect(screen.getByText("#LN-003")).toBeInTheDocument();
    });

    it("shows commodity descriptions", () => {
      render(<LoadGantt loads={loads} />);
      expect(screen.getByText("Electronics")).toBeInTheDocument();
      expect(screen.getByText("Furniture")).toBeInTheDocument();
      expect(screen.getByText("Food")).toBeInTheDocument();
    });

    it("shows 'General Freight' for loads without commodity", () => {
      render(<LoadGantt loads={loads} />);
      expect(screen.getByText("General Freight")).toBeInTheDocument();
    });

    it("displays active load count badge", () => {
      render(<LoadGantt loads={loads} />);
      // Active = in_transit loads count
      expect(screen.getByText(/Active: 1/)).toBeInTheDocument();
    });

    it("displays total load count badge", () => {
      render(<LoadGantt loads={loads} />);
      expect(screen.getByText(/Total: 4/)).toBeInTheDocument();
    });

    it("renders timeline labels for each load", () => {
      render(<LoadGantt loads={loads} />);
      // Each row has PICKUP, TRANSIT, DELIVERY labels
      const pickupLabels = screen.getAllByText("PICKUP");
      expect(pickupLabels.length).toBe(loads.length);
      const transitLabels = screen.getAllByText("TRANSIT");
      expect(transitLabels.length).toBe(loads.length);
      const deliveryLabels = screen.getAllByText("DELIVERY");
      expect(deliveryLabels.length).toBe(loads.length);
    });

    it("renders milestone times from load data", () => {
      render(<LoadGantt loads={loads} />);
      // After S-4.4: times are dynamically computed from load.pickupDate and load.dropoffDate
      // pickupDate "2025-12-01" renders as locale time, dropoffDate undefined renders as "--:--"
      // Clock SVG splits text nodes, so use container query
      const container = document.body;
      expect(container.textContent).toMatch(/ETA:/);
      expect(container.textContent).toMatch(/--:--/);
      // Verify no hardcoded "04:00 AM" or "06:30 PM"
      expect(container.textContent).not.toContain("04:00 AM");
      expect(container.textContent).not.toContain("06:30 PM");
    });
  });

  describe("status-based visualization", () => {
    it("renders truck icon for in_transit loads", () => {
      const loads = [
        createLoad({
          id: "t1",
          loadNumber: "T-1",
          status: LOAD_STATUS.In_Transit,
        }),
      ];
      render(<LoadGantt loads={loads} />);
      // The truck icon SVG should be present (via the Truck component from lucide)
      const svgs = document.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });

    it("renders checkmark for delivered loads", () => {
      const loads = [
        createLoad({
          id: "d1",
          loadNumber: "D-1",
          status: LOAD_STATUS.Delivered,
        }),
      ];
      render(<LoadGantt loads={loads} />);
      // CheckCircle2 should render for delivered loads
      const svgs = document.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe("data-driven progress bars", () => {
    it("uses inline width styles instead of fixed CSS classes for progress segments", () => {
      const loads = [
        createLoad({
          id: "dd1",
          loadNumber: "DD-1",
          status: LOAD_STATUS.In_Transit,
          pickupDate: "2025-12-01",
          dropoffDate: "2025-12-05",
        }),
      ];
      render(<LoadGantt loads={loads} />);
      // Progress bar segments should use inline style widths, not fixed Tailwind classes
      const barSegments = document.querySelectorAll<HTMLElement>(".h-1\\.5");
      expect(barSegments.length).toBe(3); // pickup, transit, delivery
      barSegments.forEach((segment) => {
        expect(segment.style.width).toMatch(/^\d+%$/);
      });
    });

    it("does not use fixed width fraction classes on progress bars", () => {
      const loads = [
        createLoad({
          id: "dd2",
          loadNumber: "DD-2",
          status: LOAD_STATUS.Active,
          pickupDate: "2025-12-01",
          dropoffDate: "2025-12-05",
        }),
      ];
      render(<LoadGantt loads={loads} />);
      const barSegments = document.querySelectorAll<HTMLElement>(".h-1\\.5");
      barSegments.forEach((segment) => {
        expect(segment.className).not.toMatch(/w-1\/3|w-1\/2|w-1\/12/);
      });
    });

    it("falls back to equal-third widths when dropoffDate is missing", () => {
      const loads = [
        createLoad({
          id: "dd3",
          loadNumber: "DD-3",
          status: LOAD_STATUS.Planned,
          pickupDate: "2025-12-01",
          // No dropoffDate — triggers fallback
        }),
      ];
      render(<LoadGantt loads={loads} />);
      const barSegments = document.querySelectorAll<HTMLElement>(".h-1\\.5");
      expect(barSegments.length).toBe(3);
      // Fallback: 33%, 34%, 33%
      expect(barSegments[0].style.width).toBe("33%");
      expect(barSegments[1].style.width).toBe("34%");
      expect(barSegments[2].style.width).toBe("33%");
    });

    it("computes 10/80/10 split for delivered loads with valid dates", () => {
      const loads = [
        createLoad({
          id: "dd4",
          loadNumber: "DD-4",
          status: LOAD_STATUS.Delivered,
          pickupDate: "2025-12-01",
          dropoffDate: "2025-12-05",
        }),
      ];
      render(<LoadGantt loads={loads} />);
      const barSegments = document.querySelectorAll<HTMLElement>(".h-1\\.5");
      expect(barSegments.length).toBe(3);
      expect(barSegments[0].style.width).toBe("10%");
      expect(barSegments[1].style.width).toBe("80%");
      expect(barSegments[2].style.width).toBe("10%");
    });

    it("preserves status-based coloring on progress segments", () => {
      const loads = [
        createLoad({
          id: "dd5",
          loadNumber: "DD-5",
          status: LOAD_STATUS.Delivered,
          pickupDate: "2025-12-01",
          dropoffDate: "2025-12-05",
        }),
      ];
      render(<LoadGantt loads={loads} />);
      const barSegments = document.querySelectorAll<HTMLElement>(".h-1\\.5");
      // Pickup segment should be blue for delivered
      expect(barSegments[0].className).toContain("bg-blue-600");
      // Transit segment should be blue-400 for delivered
      expect(barSegments[1].className).toContain("bg-blue-400");
      // Delivery segment should be green for delivered
      expect(barSegments[2].className).toContain("bg-green-600");
    });
  });

  describe("sorting", () => {
    it("sorts loads by status priority (in_transit first, planned second)", () => {
      const loads = [
        createLoad({
          id: "s1",
          loadNumber: "LN-PLANNED",
          status: LOAD_STATUS.Planned,
        }),
        createLoad({
          id: "s2",
          loadNumber: "LN-TRANSIT",
          status: LOAD_STATUS.In_Transit,
        }),
        createLoad({
          id: "s3",
          loadNumber: "LN-DRAFT",
          status: LOAD_STATUS.Draft,
        }),
      ];
      render(<LoadGantt loads={loads} />);
      const labels = screen.getAllByText(/#LN-/);
      const texts = labels.map((el) => el.textContent);
      // in_transit should come before planned, planned before draft
      expect(texts.indexOf("#LN-TRANSIT")).toBeLessThan(
        texts.indexOf("#LN-PLANNED"),
      );
      expect(texts.indexOf("#LN-PLANNED")).toBeLessThan(
        texts.indexOf("#LN-DRAFT"),
      );
    });
  });

  describe("empty state", () => {
    it("renders an empty gantt with 0 active and 0 total", () => {
      render(<LoadGantt loads={[]} />);
      expect(screen.getByText(/Active: 0/)).toBeInTheDocument();
      expect(screen.getByText(/Total: 0/)).toBeInTheDocument();
    });
  });
});
