import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DispatcherTimeline } from "../../../components/DispatcherTimeline";
import { DispatchEvent, TimeLog, LoadData, LOAD_STATUS } from "../../../types";

const createLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: "load-1",
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

const mockLoads: LoadData[] = [
  createLoad({ id: "load-1", loadNumber: "LN-100" }),
  createLoad({ id: "load-2", loadNumber: "LN-200" }),
];

const mockEvents: DispatchEvent[] = [
  {
    id: "evt-1",
    loadId: "load-1",
    dispatcherId: "disp-1",
    eventType: "StatusChange",
    message: "Load status changed to in_transit",
    createdAt: "2025-12-01T10:30:00Z",
  },
  {
    id: "evt-2",
    loadId: "load-2",
    dispatcherId: "disp-1",
    eventType: "DriverCall",
    message: "Driver confirmed ETA at 3 PM",
    createdAt: "2025-12-01T11:00:00Z",
  },
  {
    id: "evt-3",
    loadId: "load-1",
    dispatcherId: "disp-1",
    eventType: "SystemAlert",
    message: "Detention risk detected",
    createdAt: "2025-12-01T09:00:00Z",
  },
];

const mockTimeLogs: TimeLog[] = [
  {
    id: "tl-1",
    userId: "driver-1",
    loadId: "load-1",
    clockIn: "2025-12-01T08:00:00Z",
    activityType: "Driving",
    location: { lat: 41.88, lng: -87.63 },
  },
  {
    id: "tl-2",
    userId: "driver-1",
    clockIn: "2025-12-01T07:00:00Z",
    activityType: "Pre-Trip Inspection",
  },
];

describe("DispatcherTimeline component", () => {
  describe("empty state", () => {
    it("renders empty state message when no events or time logs", () => {
      render(
        <DispatcherTimeline events={[]} timeLogs={[]} loads={[]} />,
      );
      expect(
        screen.getByText(/No activity sequences recorded/),
      ).toBeInTheDocument();
    });

    it("renders without crashing with empty arrays", () => {
      render(
        <DispatcherTimeline events={[]} timeLogs={[]} loads={[]} />,
      );
      expect(
        screen.getByText(/No activity sequences recorded/),
      ).toBeInTheDocument();
    });
  });

  describe("rendering events", () => {
    it("renders without crashing with data", () => {
      render(
        <DispatcherTimeline
          events={mockEvents}
          timeLogs={mockTimeLogs}
          loads={mockLoads}
        />,
      );
      expect(
        screen.getByText("Load status changed to in_transit"),
      ).toBeInTheDocument();
    });

    it("displays event messages", () => {
      render(
        <DispatcherTimeline
          events={mockEvents}
          timeLogs={mockTimeLogs}
          loads={mockLoads}
        />,
      );
      expect(
        screen.getByText("Load status changed to in_transit"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Driver confirmed ETA at 3 PM"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Detention risk detected"),
      ).toBeInTheDocument();
    });

    it("displays time log activities", () => {
      render(
        <DispatcherTimeline
          events={mockEvents}
          timeLogs={mockTimeLogs}
          loads={mockLoads}
        />,
      );
      expect(
        screen.getByText(/Driver Activity: Driving/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Driver Activity: Pre-Trip Inspection/),
      ).toBeInTheDocument();
    });

    it("displays load number badges for linked events", () => {
      render(
        <DispatcherTimeline
          events={mockEvents}
          timeLogs={mockTimeLogs}
          loads={mockLoads}
        />,
      );
      expect(screen.getAllByText(/#LN-100/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/#LN-200/).length).toBeGreaterThanOrEqual(1);
    });

    it("displays timestamps", () => {
      render(
        <DispatcherTimeline
          events={mockEvents}
          timeLogs={mockTimeLogs}
          loads={mockLoads}
        />,
      );
      // Each entry should show a time and date
      const timeElements = document.querySelectorAll("span");
      const hasTimeFormat = Array.from(timeElements).some(
        (el) => el.textContent?.includes("AM") || el.textContent?.includes("PM"),
      );
      expect(hasTimeFormat).toBe(true);
    });
  });

  describe("sorting", () => {
    it("sorts items by timestamp in descending order (newest first)", () => {
      render(
        <DispatcherTimeline
          events={mockEvents}
          timeLogs={[]}
          loads={mockLoads}
        />,
      );
      const messages = screen.getAllByText(
        /Load status changed|Driver confirmed|Detention risk/,
      );
      // The most recent event (11:00) should appear first
      expect(messages[0].textContent).toContain("Driver confirmed");
      expect(messages[1].textContent).toContain("Load status changed");
      expect(messages[2].textContent).toContain("Detention risk");
    });
  });

  describe("merged timeline", () => {
    it("merges events and time logs into a single timeline", () => {
      render(
        <DispatcherTimeline
          events={mockEvents}
          timeLogs={mockTimeLogs}
          loads={mockLoads}
        />,
      );
      // Total items = 3 events + 2 time logs = 5
      const allMessages = document.querySelectorAll("p");
      const messageTexts = Array.from(allMessages)
        .map((p) => p.textContent)
        .filter((t) => t && t.length > 0);
      expect(messageTexts.length).toBe(5);
    });
  });

  describe("event type icons", () => {
    it("renders appropriate icon containers for each event", () => {
      render(
        <DispatcherTimeline
          events={mockEvents}
          timeLogs={[]}
          loads={mockLoads}
        />,
      );
      // Each event should have a node icon container
      const nodeIcons = document.querySelectorAll('[class*="rounded-full"]');
      expect(nodeIcons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("location display", () => {
    it("shows coordinates in readable format for time logs with location data (R-P6-14)", () => {
      render(
        <DispatcherTimeline
          events={[]}
          timeLogs={mockTimeLogs}
          loads={mockLoads}
        />,
      );
      // R-P6-14: Location text shows coordinates in readable format
      expect(
        screen.getByText(/Location:\s*41\.8800,\s*-87\.6300/),
      ).toBeInTheDocument();
    });

    it("does not contain any reference to Geocoded Terminal Entry (R-P6-15)", () => {
      render(
        <DispatcherTimeline
          events={[]}
          timeLogs={mockTimeLogs}
          loads={mockLoads}
        />,
      );
      // R-P6-15: No reference to 'Geocoded Terminal Entry' remains in component
      expect(
        screen.queryByText(/Geocoded Terminal/i),
      ).not.toBeInTheDocument();
    });

    it("does not show location for time logs without location", () => {
      const logsWithoutLocation: TimeLog[] = [
        {
          id: "tl-x",
          userId: "driver-1",
          clockIn: "2025-12-01T07:00:00Z",
          activityType: "Break",
        },
      ];
      render(
        <DispatcherTimeline
          events={[]}
          timeLogs={logsWithoutLocation}
          loads={[]}
        />,
      );
      expect(
        screen.queryByText(/Location:/),
      ).not.toBeInTheDocument();
    });

    it("formats coordinates with 4 decimal places (R-P6-14)", () => {
      const precisionLogs: TimeLog[] = [
        {
          id: "tl-prec",
          userId: "driver-1",
          clockIn: "2025-12-01T08:00:00Z",
          activityType: "Driving",
          location: { lat: 33.4484, lng: -112.074 },
        },
      ];
      render(
        <DispatcherTimeline
          events={[]}
          timeLogs={precisionLogs}
          loads={[]}
        />,
      );
      // Should show 4 decimal places
      expect(
        screen.getByText(/Location:\s*33\.4484,\s*-112\.0740/),
      ).toBeInTheDocument();
    });
  });

  describe("status change visualization", () => {
    it("renders a progress bar for StatusChange events", () => {
      const statusEvents: DispatchEvent[] = [
        {
          id: "sc-1",
          loadId: "load-1",
          dispatcherId: "disp-1",
          eventType: "StatusChange",
          message: "Status changed",
          createdAt: "2025-12-01T10:00:00Z",
        },
      ];
      render(
        <DispatcherTimeline
          events={statusEvents}
          timeLogs={[]}
          loads={mockLoads}
        />,
      );
      // StatusChange events render a progress bar with CheckCircle2
      const svgs = document.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe("vertical timeline connector", () => {
    it("renders vertical lines between items (except the last)", () => {
      render(
        <DispatcherTimeline
          events={mockEvents}
          timeLogs={[]}
          loads={mockLoads}
        />,
      );
      // Vertical lines exist between entries (w-0.5 class)
      const verticalLines = document.querySelectorAll('[class*="w-0.5"]');
      // Should be (n-1) vertical lines for n items
      expect(verticalLines.length).toBe(mockEvents.length - 1);
    });
  });
});
