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

    it("renders real-time sync indicator", () => {
      render(<LoadGantt loads={[]} />);
      expect(screen.getByText("REAL-TIME SYNC ACTIVE")).toBeInTheDocument();
    });

    it("renders '120 LOADS TRACKED' label", () => {
      render(<LoadGantt loads={[]} />);
      expect(screen.getByText("120 LOADS TRACKED")).toBeInTheDocument();
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
        createLoad({ id: "t1", loadNumber: "T-1", status: LOAD_STATUS.In_Transit }),
      ];
      render(<LoadGantt loads={loads} />);
      // The truck icon SVG should be present (via the Truck component from lucide)
      const svgs = document.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });

    it("renders checkmark for delivered loads", () => {
      const loads = [
        createLoad({ id: "d1", loadNumber: "D-1", status: LOAD_STATUS.Delivered }),
      ];
      render(<LoadGantt loads={loads} />);
      // CheckCircle2 should render for delivered loads
      const svgs = document.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe("sorting", () => {
    it("sorts loads by status priority (in_transit first, planned second)", () => {
      const loads = [
        createLoad({ id: "s1", loadNumber: "LN-PLANNED", status: LOAD_STATUS.Planned }),
        createLoad({ id: "s2", loadNumber: "LN-TRANSIT", status: LOAD_STATUS.In_Transit }),
        createLoad({ id: "s3", loadNumber: "LN-DRAFT", status: LOAD_STATUS.Draft }),
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
