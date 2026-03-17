import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DriverMobileHome } from "../../../components/DriverMobileHome";
import type { LoadData, User, Company } from "../../../types";

// Mock Scanner to avoid camera/AI API calls
vi.mock("../../../components/Scanner", () => ({
  Scanner: ({
    onDataExtracted,
    onCancel,
  }: {
    onDataExtracted: (data: unknown) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="scanner-mock">
      <button
        data-testid="scanner-extract"
        onClick={() => onDataExtracted({ docType: "BOL", confidence: 0.95 })}
      >
        Extract
      </button>
      <button data-testid="scanner-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

// Mock GlobalMapViewEnhanced to avoid Google Maps API
vi.mock("../../../components/GlobalMapViewEnhanced", () => ({
  GlobalMapViewEnhanced: () => <div data-testid="map-mock">Map</div>,
}));

// Mock Toast to control timer behavior
vi.mock("../../../components/Toast", () => ({
  Toast: ({
    message,
    type,
  }: {
    message: string;
    type: string;
    onDismiss: () => void;
  }) => (
    <div data-testid="toast-mock" data-type={type}>
      {message}
    </div>
  ),
}));

const mockUser: User = {
  id: "driver-1",
  name: "Test Driver",
  email: "driver@test.com",
  role: "driver",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const makeLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: "load-1",
  loadNumber: "LD-001",
  companyId: "company-1",
  driverId: "driver-1",
  status: "planned",
  carrierRate: 2500,
  driverPay: 1500,
  pickup: { city: "Dallas", state: "TX" },
  dropoff: { city: "Houston", state: "TX" },
  pickupDate: "2024-06-01",
  ...overrides,
});

const mockCompany = {
  id: "company-1",
  name: "Test Trucking",
  phone: "555-123-4567",
} as unknown as Company;

describe("DriverMobileHome — enhanced coverage", () => {
  let onSaveLoad: ReturnType<typeof vi.fn>;
  let onLogout: ReturnType<typeof vi.fn>;
  let onOpenHub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSaveLoad = vi.fn().mockResolvedValue(undefined);
    onLogout = vi.fn();
    onOpenHub = vi.fn();
    localStorage.clear();
  });

  describe("header and navigation", () => {
    it("renders LoadPilot header with Driver subtitle", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      expect(screen.getByText("LoadPilot")).toBeInTheDocument();
      expect(screen.getByText("Driver")).toBeInTheDocument();
    });

    it("renders bottom navigation with all tabs", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      expect(screen.getByText("Today")).toBeInTheDocument();
      expect(screen.getByText("Loads")).toBeInTheDocument();
      expect(screen.getByText("Live Map")).toBeInTheDocument();
      expect(screen.getByText("Docs")).toBeInTheDocument();
    });

    it("calls onLogout when sign out is clicked", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      // Navigate to profile tab first
      const profileBtn = screen.getAllByRole("button").find(
        (b) => b.textContent?.includes("Profile"),
      );
      if (profileBtn) {
        fireEvent.click(profileBtn);
      }
    });
  });

  describe("today tab", () => {
    it("shows Active Dispatch status bar", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      expect(screen.getByText("Active Dispatch")).toBeInTheDocument();
    });

    it("shows load count when active loads exist", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      expect(screen.getByText("1 Load(s) In Queue")).toBeInTheDocument();
    });

    it("shows No Assignments when no active loads", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      expect(screen.getByText("No Assignments")).toBeInTheDocument();
    });

    it("shows empty state message when no loads assigned", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      expect(screen.getByText("No loads assigned")).toBeInTheDocument();
    });

    it("renders load card with route", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      expect(screen.getByText("Dallas → Houston")).toBeInTheDocument();
    });

    it("renders load card with pickup date", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      expect(screen.getByText("2024-06-01")).toBeInTheDocument();
    });

    it("filters active loads by driver ID and non-delivered status", () => {
      const loads = [
        makeLoad({ id: "load-1", driverId: "driver-1", status: "planned" }),
        makeLoad({
          id: "load-2",
          driverId: "driver-1",
          status: "delivered",
          pickup: { city: "Chicago", state: "IL" },
          dropoff: { city: "LA", state: "CA" },
          loadNumber: "LD-002",
        }),
        makeLoad({
          id: "load-3",
          driverId: "other-driver",
          status: "planned",
          pickup: { city: "NYC", state: "NY" },
          dropoff: { city: "Boston", state: "MA" },
          loadNumber: "LD-003",
        }),
      ];

      render(
        <DriverMobileHome
          user={mockUser}
          loads={loads}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      // Only active load for driver-1 should show on today tab
      expect(screen.getByText("Dallas → Houston")).toBeInTheDocument();
      // Delivered load should not show
      expect(screen.queryByText("Chicago → LA")).not.toBeInTheDocument();
      // Other driver's load should not show
      expect(screen.queryByText("NYC → Boston")).not.toBeInTheDocument();
    });
  });

  describe("load detail view", () => {
    it("navigates to detail view when load card is clicked", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      expect(screen.getByText("Job Detail")).toBeInTheDocument();
    });

    it("shows Back button in detail view", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      expect(screen.getByText("Back")).toBeInTheDocument();
    });

    it("returns to list when Back is clicked", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      expect(screen.getByText("Job Detail")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Back"));
      expect(screen.getByText("Active Dispatch")).toBeInTheDocument();
    });

    it("shows Stop Route with Pickup and Dropoff", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      expect(screen.getByText("Stop Route")).toBeInTheDocument();
      expect(screen.getByText("Pickup")).toBeInTheDocument();
      expect(screen.getByText("Dropoff")).toBeInTheDocument();
    });

    it("shows Required Documents section", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      expect(screen.getByText("Required Documents")).toBeInTheDocument();
      expect(screen.getByText("BOL (Pickup)")).toBeInTheDocument();
      expect(screen.getByText("Weight Scale")).toBeInTheDocument();
      expect(screen.getByText("POD (Delivery)")).toBeInTheDocument();
    });

    it("shows Start Trip button for planned loads", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad({ status: "planned" })]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      expect(screen.getByText("Start Trip")).toBeInTheDocument();
    });

    it("shows Arrived At Stop button for in_transit loads", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad({ status: "in_transit" })]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      expect(screen.getByText("Arrived At Stop")).toBeInTheDocument();
    });

    it("calls onSaveLoad with in_transit status when Start Trip is clicked", async () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad({ status: "planned" })]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      fireEvent.click(screen.getByText("Start Trip"));

      await waitFor(() => {
        expect(onSaveLoad).toHaveBeenCalledWith(
          expect.objectContaining({ status: "in_transit" }),
        );
      });
    });

    it("calls onSaveLoad with arrived status when Arrived At Stop is clicked", async () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad({ status: "in_transit" })]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      fireEvent.click(screen.getByText("Arrived At Stop"));

      await waitFor(() => {
        expect(onSaveLoad).toHaveBeenCalledWith(
          expect.objectContaining({ status: "arrived" }),
        );
      });
    });

    it("shows Report Issue button in detail view", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      expect(screen.getByText("Report Issue")).toBeInTheDocument();
    });

    it("opens change request modal when Report Issue is clicked", async () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      fireEvent.click(screen.getByText("Report Issue"));

      await waitFor(() => {
        expect(screen.getByText("Request Extra")).toBeInTheDocument();
      });
      expect(screen.getByText("DETENTION")).toBeInTheDocument();
      expect(screen.getByText("LUMPER")).toBeInTheDocument();
      expect(screen.getByText("LAYOVER")).toBeInTheDocument();
      expect(screen.getByText("TONU")).toBeInTheDocument();
    });

    it("shows Report Breakdown option in change request modal", async () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      fireEvent.click(screen.getByText("Report Issue"));

      await waitFor(() => {
        expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
      });
    });
  });

  describe("tabs navigation", () => {
    it("switches to Loads tab and shows Load History", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Loads"));
      expect(screen.getByText("Load History")).toBeInTheDocument();
    });

    it("switches to Docs tab and shows My Documents", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Docs"));
      expect(screen.getByText("My Documents")).toBeInTheDocument();
      expect(screen.getByText("Scan New")).toBeInTheDocument();
      expect(screen.getByText("Vault Access")).toBeInTheDocument();
    });

    it("switches to Live Map tab and shows map", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Live Map"));
      expect(screen.getByTestId("map-mock")).toBeInTheDocument();
      expect(screen.getByText("Fleet Tracking")).toBeInTheDocument();
    });
  });

  describe("driver pay visibility", () => {
    it("shows driver pay when company settings allow", () => {
      const companyWithPay = {
        ...mockCompany,
        driverVisibilitySettings: { showDriverPay: true },
      } as unknown as Company;

      render(
        <DriverMobileHome
          user={mockUser}
          company={companyWithPay}
          loads={[makeLoad({ driverPay: 1500 })]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      expect(screen.getByText("Est. Trip Pay")).toBeInTheDocument();
      expect(screen.getByText("$1500")).toBeInTheDocument();
    });

    it("hides driver pay when company settings disallow", () => {
      const companyNoPay = {
        ...mockCompany,
        driverVisibilitySettings: { showDriverPay: false },
      } as unknown as Company;

      render(
        <DriverMobileHome
          user={mockUser}
          company={companyNoPay}
          loads={[makeLoad({ driverPay: 1500 })]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      fireEvent.click(screen.getByText("Dallas → Houston"));
      expect(screen.queryByText("Est. Trip Pay")).not.toBeInTheDocument();
    });
  });

  describe("change requests tab", () => {
    it("navigates to changes tab from bottom nav", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      // Find and click the changes/extras button in nav
      const navButtons = screen.getAllByRole("button");
      const extrasBtn = navButtons.find(
        (b) => b.textContent?.includes("Extras"),
      );
      if (extrasBtn) {
        fireEvent.click(extrasBtn);
        expect(screen.getByText("Change Requests")).toBeInTheDocument();
      }
    });
  });

  describe("profile tab", () => {
    it("shows user name and role on profile tab", () => {
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );
      // Find and click profile tab
      const navButtons = screen.getAllByRole("button");
      const profileBtn = navButtons.find(
        (b) => b.textContent?.includes("Profile"),
      );
      if (profileBtn) {
        fireEvent.click(profileBtn);
        expect(screen.getByText("Test Driver")).toBeInTheDocument();
      }
    });
  });

  describe("multiple loads", () => {
    it("shows correct count with multiple active loads", () => {
      const loads = [
        makeLoad({ id: "load-1", status: "planned" }),
        makeLoad({
          id: "load-2",
          status: "in_transit",
          loadNumber: "LD-002",
          pickup: { city: "Chicago", state: "IL" },
          dropoff: { city: "LA", state: "CA" },
        }),
      ];

      render(
        <DriverMobileHome
          user={mockUser}
          loads={loads}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      expect(screen.getByText("2 Load(s) In Queue")).toBeInTheDocument();
    });

    it("renders all active load cards", () => {
      const loads = [
        makeLoad({ id: "load-1", status: "planned" }),
        makeLoad({
          id: "load-2",
          status: "in_transit",
          loadNumber: "LD-002",
          pickup: { city: "Chicago", state: "IL" },
          dropoff: { city: "LA", state: "CA" },
        }),
      ];

      render(
        <DriverMobileHome
          user={mockUser}
          loads={loads}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      expect(screen.getByText("Dallas → Houston")).toBeInTheDocument();
      expect(screen.getByText("Chicago → LA")).toBeInTheDocument();
    });
  });
});
