import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditLoadForm } from "../../../components/EditLoadForm";
import { LoadData, User, LOAD_STATUS } from "../../../types";

vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([
    { id: "broker-1", name: "Alpha Logistics", mcNumber: "MC-123456" },
    { id: "broker-2", name: "Beta Freight", mcNumber: "MC-789012" },
  ]),
}));

vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn().mockResolvedValue({ id: "company-1", name: "Test Co" }),
  getCompanyUsers: vi.fn().mockResolvedValue([
    {
      id: "driver-1",
      name: "John Driver",
      role: "driver",
      companyId: "company-1",
    },
    {
      id: "driver-2",
      name: "Jane OO",
      role: "owner_operator",
      companyId: "company-1",
    },
    {
      id: "disp-1",
      name: "Bob Dispatch",
      role: "dispatcher",
      companyId: "company-1",
    },
  ]),
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
}));

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockLoadWithLegs: Partial<LoadData> = {
  id: "load-1",
  companyId: "company-1",
  loadNumber: "LN-001",
  status: LOAD_STATUS.Planned,
  carrierRate: 1500,
  driverPay: 900,
  pickupDate: "2025-12-01",
  pickup: { city: "Chicago", state: "IL" },
  dropoff: { city: "Dallas", state: "TX" },
  driverId: "driver-1",
  commodity: "Electronics",
  freightType: "Dry Van",
  truckNumber: "TRK-100",
  trailerNumber: "TRL-200",
  legs: [
    {
      id: "leg-1",
      type: "Pickup" as const,
      location: {
        city: "Chicago",
        state: "IL",
        facilityName: "Warehouse Alpha",
        address: "123 Main St",
        zip: "60601",
      },
      date: "2025-12-01",
      appointmentTime: "08:00",
      completed: false,
      pallets: 10,
      weight: 20000,
      sealNumber: "SEAL-100",
    },
    {
      id: "leg-2",
      type: "Dropoff" as const,
      location: {
        city: "Dallas",
        state: "TX",
        facilityName: "Depot Bravo",
        address: "456 Oak Ave",
        zip: "75001",
      },
      date: "2025-12-03",
      appointmentTime: "16:00",
      completed: false,
      pallets: 10,
      weight: 20000,
      sealNumber: "SEAL-200",
    },
  ],
};

describe("EditLoadForm deep coverage — lines 553-664, 691-726", () => {
  const defaultProps = {
    initialData: mockLoadWithLegs,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    currentUser: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("stop matrix — leg type badges (lines 610-616)", () => {
    it("renders P badge for Pickup leg type", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("P")).toBeInTheDocument();
    });

    it("renders D badge for Dropoff leg type", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("D")).toBeInTheDocument();
    });
  });

  describe("stop matrix — facility name editing (lines 617-631)", () => {
    it("renders facility name inputs for both legs", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByDisplayValue("Warehouse Alpha")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Depot Bravo")).toBeInTheDocument();
    });

    it("updates facility name via handleUpdateLeg", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      const facilityInput = screen.getByDisplayValue("Warehouse Alpha");
      await user.clear(facilityInput);
      await user.type(facilityInput, "Terminal Charlie");
      expect(facilityInput).toHaveValue("Terminal Charlie");
    });

    it("renders address inputs for both legs", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByDisplayValue("123 Main St")).toBeInTheDocument();
      expect(screen.getByDisplayValue("456 Oak Ave")).toBeInTheDocument();
    });

    it("updates address via handleUpdateLeg", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      const addressInput = screen.getByDisplayValue("123 Main St");
      await user.clear(addressInput);
      await user.type(addressInput, "789 Elm Blvd");
      expect(addressInput).toHaveValue("789 Elm Blvd");
    });
  });

  describe("stop matrix — city and state editing (lines 647-672)", () => {
    it("renders city inputs for both legs", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByDisplayValue("Chicago")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Dallas")).toBeInTheDocument();
    });

    it("updates city via handleUpdateLeg", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      const cityInput = screen.getByDisplayValue("Chicago");
      await user.clear(cityInput);
      await user.type(cityInput, "Milwaukee");
      expect(cityInput).toHaveValue("Milwaukee");
    });

    it("renders state inputs for both legs", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByDisplayValue("IL")).toBeInTheDocument();
      expect(screen.getByDisplayValue("TX")).toBeInTheDocument();
    });

    it("converts state input to uppercase via handleUpdateLeg", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      const stateInput = screen.getByDisplayValue("IL");
      await user.clear(stateInput);
      await user.type(stateInput, "wi");
      // The component converts to uppercase via .toUpperCase()
      expect(stateInput).toHaveValue("WI");
    });
  });

  describe("stop matrix — seal number editing (lines 674-683)", () => {
    it("renders seal number inputs for both legs", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByDisplayValue("SEAL-100")).toBeInTheDocument();
      expect(screen.getByDisplayValue("SEAL-200")).toBeInTheDocument();
    });

    it("updates seal number via handleUpdateLeg", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      const sealInput = screen.getByDisplayValue("SEAL-100");
      await user.clear(sealInput);
      await user.type(sealInput, "SEAL-999");
      expect(sealInput).toHaveValue("SEAL-999");
    });
  });

  describe("stop matrix — pallets editing (lines 685-696)", () => {
    it("renders pallets inputs with correct values", () => {
      render(<EditLoadForm {...defaultProps} />);
      const palletsInputs = screen.getAllByDisplayValue("10");
      expect(palletsInputs.length).toBeGreaterThanOrEqual(2);
    });

    it("updates pallets via handleUpdateLeg with parseInt", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} onSave={onSave} />);
      const palletsInputs = screen.getAllByDisplayValue("10");
      // Update the first pallets input
      await user.clear(palletsInputs[0]);
      await user.type(palletsInputs[0], "24");
      expect(palletsInputs[0]).toHaveValue(24);

      // Save and verify pallets was updated
      await user.click(screen.getByText("Save Changes"));
      const savedData = onSave.mock.calls[0][0];
      expect(savedData.legs[0].pallets).toBe(24);
    });
  });

  describe("stop matrix — weight editing (lines 698-709)", () => {
    it("renders weight inputs with correct values", () => {
      render(<EditLoadForm {...defaultProps} />);
      const weightInputs = screen.getAllByDisplayValue("20000");
      expect(weightInputs.length).toBeGreaterThanOrEqual(2);
    });

    it("updates weight via handleUpdateLeg with parseInt", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} onSave={onSave} />);
      const weightInputs = screen.getAllByDisplayValue("20000");
      await user.clear(weightInputs[0]);
      await user.type(weightInputs[0], "35000");
      expect(weightInputs[0]).toHaveValue(35000);

      await user.click(screen.getByText("Save Changes"));
      const savedData = onSave.mock.calls[0][0];
      expect(savedData.legs[0].weight).toBe(35000);
    });
  });

  describe("stop matrix — date and time editing (lines 711-731)", () => {
    it("renders date inputs for legs", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByDisplayValue("2025-12-01")).toBeInTheDocument();
      expect(screen.getByDisplayValue("2025-12-03")).toBeInTheDocument();
    });

    it("renders appointment time inputs for legs", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByDisplayValue("08:00")).toBeInTheDocument();
      expect(screen.getByDisplayValue("16:00")).toBeInTheDocument();
    });

    it("updates date via handleUpdateLeg", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} onSave={onSave} />);
      const dateInput = screen.getByDisplayValue("2025-12-01");
      // Keep the pickup date valid relative to the dropoff leg so the form can save.
      await user.clear(dateInput);
      await user.type(dateInput, "2025-11-30");

      await user.click(screen.getByText("Save Changes"));
      const savedData = onSave.mock.calls[0][0];
      expect(savedData.legs[0].date).toBe("2025-11-30");
    });

    it("updates appointment time via handleUpdateLeg", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} onSave={onSave} />);
      const timeInput = screen.getByDisplayValue("08:00");
      await user.clear(timeInput);
      await user.type(timeInput, "10:30");

      await user.click(screen.getByText("Save Changes"));
      const savedData = onSave.mock.calls[0][0];
      expect(savedData.legs[0].appointmentTime).toBe("10:30");
    });
  });

  describe("stop matrix — remove leg button (lines 733-742)", () => {
    it("shows remove button for each leg when unlocked", () => {
      render(<EditLoadForm {...defaultProps} />);
      // Each leg row should have a remove button (trash icon button in td)
      const trashButtons = document.querySelectorAll("td button");
      expect(trashButtons.length).toBeGreaterThanOrEqual(2);
    });

    it("removes a leg when trash button is clicked", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} onSave={onSave} />);

      // Verify both legs exist
      expect(screen.getByDisplayValue("Warehouse Alpha")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Depot Bravo")).toBeInTheDocument();

      // Find the trash button in the first leg's row
      const trashButtons = document.querySelectorAll("td button");
      await user.click(trashButtons[0]);

      // First leg should be removed, second remains
      expect(screen.queryByDisplayValue("Warehouse Alpha")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("Depot Bravo")).toBeInTheDocument();

      await user.click(screen.getByText("Save Changes"));
      const savedData = onSave.mock.calls[0][0];
      expect(savedData.legs).toHaveLength(1);
      expect(savedData.legs[0].location.facilityName).toBe("Depot Bravo");
    });

    it("hides remove button when form is locked", () => {
      render(
        <EditLoadForm
          {...defaultProps}
          initialData={{ ...mockLoadWithLegs, isLocked: true }}
        />,
      );
      // All inputs in td should be disabled, no trash buttons
      const trashButtons = document.querySelectorAll("td button");
      expect(trashButtons.length).toBe(0);
    });
  });

  describe("stop matrix — disabled state when locked (lines 630, 644, etc.)", () => {
    it("disables all leg inputs when form is locked", () => {
      render(
        <EditLoadForm
          {...defaultProps}
          initialData={{ ...mockLoadWithLegs, isLocked: true }}
        />,
      );
      const facilityInput = screen.getByDisplayValue("Warehouse Alpha");
      expect(facilityInput).toBeDisabled();

      const addressInput = screen.getByDisplayValue("123 Main St");
      expect(addressInput).toBeDisabled();

      const cityInput = screen.getByDisplayValue("Chicago");
      expect(cityInput).toBeDisabled();

      const stateInput = screen.getByDisplayValue("IL");
      expect(stateInput).toBeDisabled();

      const sealInput = screen.getByDisplayValue("SEAL-100");
      expect(sealInput).toBeDisabled();
    });
  });

  describe("add new legs and save (lines 553-573)", () => {
    it("adds a Pickup leg via Add Pickup button and verifies table row", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} onSave={onSave} />);

      await user.click(screen.getByText("+ Add Pickup"));

      // Should now have 3 rows (2 existing + 1 new Pickup)
      const pBadges = screen.getAllByText("P");
      expect(pBadges.length).toBe(2); // original + new

      await user.click(screen.getByText("Save Changes"));
      const savedData = onSave.mock.calls[0][0];
      expect(savedData.legs).toHaveLength(3);
      expect(savedData.legs[2].type).toBe("Pickup");
    });

    it("adds a Dropoff leg via Add Drop button and verifies table row", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} onSave={onSave} />);

      await user.click(screen.getByText("+ Add Drop"));

      const dBadges = screen.getAllByText("D");
      expect(dBadges.length).toBe(2); // original + new

      await user.click(screen.getByText("Save Changes"));
      const savedData = onSave.mock.calls[0][0];
      expect(savedData.legs).toHaveLength(3);
      expect(savedData.legs[2].type).toBe("Dropoff");
    });
  });

  describe("integrated leg editing workflow", () => {
    it("edits multiple leg fields and saves complete form data", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} onSave={onSave} />);

      // Edit facility name on leg 1
      const facilityInput = screen.getByDisplayValue("Warehouse Alpha");
      await user.clear(facilityInput);
      await user.type(facilityInput, "Hub Central");

      // Edit seal number on leg 2
      const sealInput = screen.getByDisplayValue("SEAL-200");
      await user.clear(sealInput);
      await user.type(sealInput, "SEAL-777");

      await user.click(screen.getByText("Save Changes"));

      const savedData = onSave.mock.calls[0][0];
      expect(savedData.legs[0].location.facilityName).toBe("Hub Central");
      expect(savedData.legs[1].sealNumber).toBe("SEAL-777");
      expect(savedData.loadNumber).toBe("LN-001");
      expect(savedData.carrierRate).toBe(1500);
    });
  });
});
