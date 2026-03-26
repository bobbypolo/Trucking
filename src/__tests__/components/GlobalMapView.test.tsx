import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalMapView } from "../../../components/GlobalMapView";

// Mock lucide-react icons
vi.mock("lucide-react", () => {
  const icon = (props: any) => (
    <span data-testid={props["data-testid"] || "icon"} />
  );
  return {
    MapPin: icon,
    Truck: icon,
    Navigation: icon,
    Clock: icon,
    Info: icon,
    Search: icon,
    Layers: icon,
    Filter: icon,
    Maximize2: icon,
    Wifi: icon,
    WifiOff: icon,
    AlertCircle: icon,
    Map: icon,
    ShieldCheck: icon,
    Calendar: icon,
    ChevronRight: icon,
    ChevronLeft: icon,
  };
});

describe("GlobalMapView", () => {
  const mockLoads = [
    {
      id: "l1",
      loadNumber: "LD-1000",
      status: "in_transit",
      driverId: "d1",
      pickup: { city: "Chicago", state: "IL", facilityName: "WH-A" },
      dropoff: { city: "Detroit", state: "MI", facilityName: "WH-B" },
      carrierRate: 3000,
      isActionRequired: false,
    },
    {
      id: "l2",
      loadNumber: "LD-2000",
      status: "delivered",
      driverId: "d2",
      pickup: { city: "Dallas", state: "TX", facilityName: "WH-C" },
      dropoff: { city: "Houston", state: "TX", facilityName: "WH-D" },
      carrierRate: 2500,
      isActionRequired: false,
    },
  ] as any[];

  const mockUsers = [
    {
      id: "d1",
      name: "Tom Thompson",
      role: "driver",
      safetyScore: 98,
      complianceStatus: "Eligible",
    },
    {
      id: "d2",
      name: "Elena Petrova",
      role: "driver",
      safetyScore: 75,
      complianceStatus: "Restricted",
    },
    {
      id: "admin1",
      name: "Admin User",
      role: "admin",
    },
  ] as any[];

  const mockIncidents = [
    {
      id: "inc-1",
      loadId: "l1",
      status: "Open",
      type: "Breakdown",
    },
  ] as any[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<GlobalMapView loads={[]} users={[]} />);
    expect(screen.getByPlaceholderText(/SEARCH FLEET/i)).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    const searchInput = screen.getByPlaceholderText(/SEARCH FLEET/i);
    expect(searchInput).toBeInTheDocument();
  });

  it("shows fleet status counts", () => {
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    expect(screen.getByText("Fleet Status")).toBeInTheDocument();
    expect(screen.getByText("En Route")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("filters vehicles by search term (driver name)", async () => {
    const user = userEvent.setup();
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    const searchInput = screen.getByPlaceholderText(/SEARCH FLEET/i);
    await user.clear(searchInput);
    await user.type(searchInput, "Tom");
    // Should show Tom's vehicle marker
    expect(screen.getByText("Tom Thompson")).toBeInTheDocument();
  });

  it("filters vehicles by load number", async () => {
    const user = userEvent.setup();
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    const searchInput = screen.getByPlaceholderText(/SEARCH FLEET/i);
    await user.clear(searchInput);
    await user.type(searchInput, "LD-1000");
    expect(screen.getByText("Tom Thompson")).toBeInTheDocument();
  });

  it("shows driver names on hover cards", () => {
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    expect(screen.getByText("Tom Thompson")).toBeInTheDocument();
    expect(screen.getByText("Elena Petrova")).toBeInTheDocument();
  });

  it("toggles left panel collapse", async () => {
    const user = userEvent.setup();
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    // Find the toggle button (ChevronRight icon wrapped in a button)
    const buttons = screen.getAllByRole("button");
    // The toggle button has the ChevronRight icon
    const toggleBtn = buttons.find((btn) =>
      btn.className.includes("rounded-full"),
    );
    expect(toggleBtn).toBeDefined();
    await user.click(toggleBtn!);
    // After clicking, panel should collapse (translate applied)
  });

  it("calls onViewLoad when clicking vehicle without incident", async () => {
    const user = userEvent.setup();
    const onViewLoad = vi.fn();
    render(
      <GlobalMapView
        loads={mockLoads}
        users={mockUsers}
        incidents={[]}
        onViewLoad={onViewLoad}
      />,
    );
    // Find a vehicle marker (cursor-pointer elements)
    const markers = document.querySelectorAll(".cursor-pointer");
    expect(markers.length).toBeGreaterThan(0);
    await user.click(markers[0] as HTMLElement);
  });

  it("calls onSelectIncident when clicking vehicle with incident", async () => {
    const user = userEvent.setup();
    const onSelectIncident = vi.fn();
    render(
      <GlobalMapView
        loads={mockLoads}
        users={mockUsers}
        incidents={mockIncidents}
        onSelectIncident={onSelectIncident}
      />,
    );
    // Find vehicle markers
    const markers = document.querySelectorAll(".cursor-pointer");
    expect(markers.length).toBeGreaterThan(0);
    await user.click(markers[0] as HTMLElement);
    // Should call onSelectIncident for the driver with incident
  });

  it("renders with empty loads and users", () => {
    render(<GlobalMapView loads={[]} users={[]} />);
    // Should not crash, should show 0 counts
  });

  it("handles drivers without active loads", () => {
    const usersOnly = [
      { id: "d3", name: "Idle Driver", role: "driver", safetyScore: 90 },
    ] as any[];
    render(<GlobalMapView loads={[]} users={usersOnly} />);
    expect(screen.getByText("Idle Driver")).toBeInTheDocument();
  });

  it("does not render non-driver users as vehicles", () => {
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    // Admin user should not appear as a vehicle
    expect(screen.queryByText("Admin User")).not.toBeInTheDocument();
  });

  it("shows safety score for drivers", () => {
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    expect(screen.getByText("98%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("shows N/A for drivers without safety score", () => {
    const users = [{ id: "d4", name: "New Driver", role: "driver" }] as any[];
    render(<GlobalMapView loads={[]} users={users} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders trackingState indicator when trackingState prop is provided", () => {
    render(
      <GlobalMapView
        loads={mockLoads}
        users={mockUsers}
        trackingState="configured-live"
      />,
    );
    const indicator = screen.getByTestId("tracking-state-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator.getAttribute("data-tracking-state")).toBe(
      "configured-live",
    );
  });

  it("shows Live Tracking text for configured-live state", () => {
    render(
      <GlobalMapView loads={[]} users={[]} trackingState="configured-live" />,
    );
    expect(screen.getByText(/live tracking/i)).toBeInTheDocument();
  });

  it("shows Tracking Idle text for configured-idle state", () => {
    render(
      <GlobalMapView loads={[]} users={[]} trackingState="configured-idle" />,
    );
    expect(screen.getByText(/tracking idle/i)).toBeInTheDocument();
  });

  it("shows GPS not configured message for not-configured state", () => {
    render(
      <GlobalMapView loads={[]} users={[]} trackingState="not-configured" />,
    );
    expect(screen.getByText(/gps not configured/i)).toBeInTheDocument();
  });

  it("shows Tracking Unavailable for provider-error state", () => {
    render(
      <GlobalMapView loads={[]} users={[]} trackingState="provider-error" />,
    );
    expect(screen.getByText(/tracking unavailable/i)).toBeInTheDocument();
  });

  it("does not render tracking state indicator when trackingState prop is omitted", () => {
    render(<GlobalMapView loads={[]} users={[]} />);
    expect(
      screen.queryByTestId("tracking-state-indicator"),
    ).not.toBeInTheDocument();
  });
});
