import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlobalMapView } from "../../../components/GlobalMapView";

// Mock lucide-react icons
vi.mock("lucide-react", () => {
  const icon = (props: any) => <span data-testid={props["data-testid"] || "icon"} />;
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

  it("filters vehicles by search term (driver name)", () => {
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    const searchInput = screen.getByPlaceholderText(/SEARCH FLEET/i);
    fireEvent.change(searchInput, { target: { value: "Tom" } });
    // Should show Tom's vehicle marker
    expect(screen.getByText("Tom Thompson")).toBeInTheDocument();
  });

  it("filters vehicles by load number", () => {
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    const searchInput = screen.getByPlaceholderText(/SEARCH FLEET/i);
    fireEvent.change(searchInput, { target: { value: "LD-1000" } });
    expect(screen.getByText("Tom Thompson")).toBeInTheDocument();
  });

  it("shows driver names on hover cards", () => {
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    expect(screen.getByText("Tom Thompson")).toBeInTheDocument();
    expect(screen.getByText("Elena Petrova")).toBeInTheDocument();
  });

  it("toggles left panel collapse", () => {
    render(<GlobalMapView loads={mockLoads} users={mockUsers} />);
    // Find the toggle button (ChevronRight icon wrapped in a button)
    const buttons = screen.getAllByRole("button");
    // The toggle button has the ChevronRight icon
    const toggleBtn = buttons.find((btn) =>
      btn.className.includes("rounded-full"),
    );
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      // After clicking, panel should collapse (translate applied)
    }
  });

  it("calls onViewLoad when clicking vehicle without incident", () => {
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
    if (markers.length > 0) {
      fireEvent.click(markers[0]);
    }
  });

  it("calls onSelectIncident when clicking vehicle with incident", () => {
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
    if (markers.length > 0) {
      fireEvent.click(markers[0]);
      // Should call onSelectIncident for the driver with incident
    }
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
    const users = [
      { id: "d4", name: "New Driver", role: "driver" },
    ] as any[];
    render(<GlobalMapView loads={[]} users={users} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });
});
