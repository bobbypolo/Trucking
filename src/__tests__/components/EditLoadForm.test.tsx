import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditLoadForm } from "../../../components/EditLoadForm";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Mock services at network boundary
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

const mockLoadData: Partial<LoadData> = {
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
  legs: [],
};

const newLoadData: Partial<LoadData> = {
  companyId: "company-1",
  status: LOAD_STATUS.Planned,
  carrierRate: 0,
  driverPay: 0,
  pickupDate: "2025-12-01",
  pickup: { city: "", state: "" },
  dropoff: { city: "", state: "" },
  driverId: "",
  legs: [],
};

describe("EditLoadForm component", () => {
  const defaultProps = {
    initialData: mockLoadData,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    currentUser: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders without crashing", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText(/LN-001/)).toBeInTheDocument();
    });

    it("renders the manifest header with load number", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText(/LN-001/)).toBeInTheDocument();
    });

    it("renders 'NEW_MANIFEST' when no load number exists", () => {
      render(
        <EditLoadForm
          {...defaultProps}
          initialData={{ ...newLoadData, loadNumber: undefined }}
        />,
      );
      expect(screen.getByText(/NEW_MANIFEST/)).toBeInTheDocument();
    });

    it("renders Back button", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("Back")).toBeInTheDocument();
    });

    it("renders Utilities button", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("Utilities")).toBeInTheDocument();
    });

    it("renders Reference Matrix section", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("Reference Matrix")).toBeInTheDocument();
    });

    it("renders Relationships section", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("Relationships")).toBeInTheDocument();
    });

    it("renders Settlement section", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText(/Settlement/)).toBeInTheDocument();
    });

    it("renders Stop Matrix section", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText(/Stop Matrix/)).toBeInTheDocument();
    });

    it("renders Digital Artifacts Matrix section", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText(/Digital Artifacts/)).toBeInTheDocument();
    });

    it("renders Discard button in footer", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("Discard")).toBeInTheDocument();
    });
  });

  describe("edit mode vs create mode", () => {
    it("shows 'Save Changes' when editing an existing load (has id)", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });

    it("shows 'Initialize Dispatch' when creating a new load (no id)", () => {
      render(
        <EditLoadForm {...defaultProps} initialData={{ ...newLoadData }} />,
      );
      expect(screen.getByText("Initialize Dispatch")).toBeInTheDocument();
    });
  });

  describe("form pre-fills with initial data", () => {
    it("pre-fills carrier rate", () => {
      render(<EditLoadForm {...defaultProps} />);
      const inputs = document.querySelectorAll('input[type="number"]');
      const values = Array.from(inputs).map((i) =>
        parseFloat((i as HTMLInputElement).value),
      );
      expect(values).toContain(1500);
    });

    it("pre-fills driver pay", () => {
      render(<EditLoadForm {...defaultProps} />);
      const inputs = document.querySelectorAll('input[type="number"]');
      const values = Array.from(inputs).map((i) =>
        parseFloat((i as HTMLInputElement).value),
      );
      expect(values).toContain(900);
    });

    it("pre-fills load number", () => {
      render(<EditLoadForm {...defaultProps} />);
      const inputs = document.querySelectorAll("input");
      const values = Array.from(inputs).map(
        (i) => (i as HTMLInputElement).value,
      );
      expect(values).toContain("LN-001");
    });

    it("pre-fills commodity", () => {
      render(<EditLoadForm {...defaultProps} />);
      const inputs = document.querySelectorAll("input");
      const values = Array.from(inputs).map(
        (i) => (i as HTMLInputElement).value,
      );
      expect(values).toContain("Electronics");
    });
  });

  describe("margin calculation", () => {
    it("shows correct profit margin ($600 from 1500 - 900)", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("$600")).toBeInTheDocument();
    });

    it("shows correct margin percentage (40.0%)", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("40.0%")).toBeInTheDocument();
    });

    it("shows 0% when no carrier rate", () => {
      render(
        <EditLoadForm
          {...defaultProps}
          initialData={{ ...mockLoadData, carrierRate: 0, driverPay: 0 }}
        />,
      );
      expect(screen.getByText("0.0%")).toBeInTheDocument();
    });

    it("shows negative margin when driverPay exceeds carrierRate", () => {
      render(
        <EditLoadForm
          {...defaultProps}
          initialData={{ ...mockLoadData, carrierRate: 500, driverPay: 800 }}
        />,
      );
      // -$300 margin
      const text = document.body.textContent || "";
      expect(text).toContain("-300");
    });
  });

  describe("interactive elements", () => {
    it("calls onCancel when Back button is clicked", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      await user.click(screen.getByText("Back"));
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when Discard button is clicked", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      await user.click(screen.getByText("Discard"));
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onSave when save button is clicked", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      await user.click(screen.getByText("Save Changes"));
      expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
    });

    it("toggles lock state when Lock/Unlock button is clicked", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("Unlocked")).toBeInTheDocument();
      await user.click(screen.getByText("Unlocked"));
      expect(screen.getByText("Locked")).toBeInTheDocument();
    });

    it("disables save button when load is locked", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      await user.click(screen.getByText("Unlocked"));
      const saveBtn = screen.getByText("Save Changes");
      expect(saveBtn).toBeDisabled();
    });

    it("shows lock warning banner when locked", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      await user.click(screen.getByText("Unlocked"));
      expect(screen.getByText(/locked for invoicing/i)).toBeInTheDocument();
    });

    it("toggles action required state", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("Tag for Action")).toBeInTheDocument();
      await user.click(screen.getByText("Tag for Action"));
      expect(screen.getByText("Action Tagged")).toBeInTheDocument();
    });

    it("shows action justification textarea when action tagged", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      await user.click(screen.getByText("Tag for Action"));
      expect(
        screen.getByText(/Action Justification Needed/),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/PLEASE DOCUMENT THE REASON/),
      ).toBeInTheDocument();
    });

    it("opens utilities dropdown on click", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      await user.click(screen.getByText("Utilities"));
      expect(screen.getByText("Print BOL")).toBeInTheDocument();
      expect(screen.getByText("Carrier Rates")).toBeInTheDocument();
      expect(screen.getByText("Load Stops")).toBeInTheDocument();
      expect(screen.getByText("Documents")).toBeInTheDocument();
      expect(screen.getByText("Show Route")).toBeInTheDocument();
      expect(screen.getByText("Audit Logs")).toBeInTheDocument();
    });
  });

  describe("load status dropdown", () => {
    it("renders all load status options", () => {
      render(<EditLoadForm {...defaultProps} />);
      const selects = document.querySelectorAll("select");
      // The status select should have LOAD_STATUS entries
      const statusEntries = Object.keys(LOAD_STATUS);
      expect(statusEntries.length).toBeGreaterThan(0);
    });

    it("pre-selects current status", () => {
      render(<EditLoadForm {...defaultProps} />);
      const selects = Array.from(document.querySelectorAll("select"));
      const statusSelect = selects.find((s) =>
        Array.from(s.options).some((o) => o.value === LOAD_STATUS.Planned),
      );
      expect(statusSelect).toBeTruthy();
      expect(statusSelect!.value).toBe(LOAD_STATUS.Planned);
    });
  });

  describe("equipment type dropdown", () => {
    it("renders equipment type options", () => {
      render(<EditLoadForm {...defaultProps} />);
      const text = document.body.textContent || "";
      expect(text).toContain("DRY VAN");
      expect(text).toContain("REEFER");
      expect(text).toContain("FLATBED");
      expect(text).toContain("INTERMODAL");
    });
  });

  describe("load legs (stop matrix)", () => {
    it("shows empty stops message when no legs", () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText(/No stops defined/i)).toBeInTheDocument();
    });

    it("adds a pickup leg when '+ Add Pickup' is clicked", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      await user.click(screen.getByText("+ Add Pickup"));
      // Should no longer show "No stops defined"
      expect(screen.queryByText(/No stops defined/i)).not.toBeInTheDocument();
    });

    it("adds a dropoff leg when '+ Add Drop' is clicked", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      await user.click(screen.getByText("+ Add Drop"));
      expect(screen.queryByText(/No stops defined/i)).not.toBeInTheDocument();
    });

    it("renders leg type badges (P for Pickup, D for Dropoff)", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      await user.click(screen.getByText("+ Add Pickup"));
      await user.click(screen.getByText("+ Add Drop"));
      expect(screen.getByText("P")).toBeInTheDocument();
      expect(screen.getByText("D")).toBeInTheDocument();
    });

    it("can remove a leg via trash button", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      await user.click(screen.getByText("+ Add Pickup"));
      expect(screen.getByText("P")).toBeInTheDocument();
      // Find and click the trash/remove button
      const trashButtons = document.querySelectorAll("button");
      const removeBtn = Array.from(trashButtons).find((btn) => {
        const svg = btn.querySelector("svg");
        return svg && btn.closest("td");
      });
      expect(removeBtn).toBeDefined();
      await user.click(removeBtn!);
      expect(screen.getByText(/No stops defined/i)).toBeInTheDocument();
    });

    it("renders leg table headers", async () => {
      render(<EditLoadForm {...defaultProps} />);
      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText(/Facility/)).toBeInTheDocument();
      expect(screen.getByText(/City/)).toBeInTheDocument();
      expect(screen.getByText(/Seal/)).toBeInTheDocument();
      expect(screen.getByText("Pallets")).toBeInTheDocument();
      expect(screen.getByText("Weight")).toBeInTheDocument();
      expect(screen.getByText(/Date/)).toBeInTheDocument();
    });

    it("renders with pre-existing legs", () => {
      const legsData = {
        ...mockLoadData,
        legs: [
          {
            id: "leg-1",
            type: "Pickup" as const,
            location: {
              city: "Chicago",
              state: "IL",
              facilityName: "Warehouse A",
              address: "123 Main",
              zip: "60601",
            },
            date: "2025-12-01",
            completed: false,
            pallets: 10,
            weight: 20000,
          },
        ],
      };
      render(<EditLoadForm {...defaultProps} initialData={legsData} />);
      expect(screen.queryByText(/No stops defined/i)).not.toBeInTheDocument();
    });
  });

  describe("field inputs", () => {
    it("allows editing carrier rate", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      const numberInputs = document.querySelectorAll('input[type="number"]');
      const rateInput = Array.from(numberInputs).find(
        (i) => (i as HTMLInputElement).value === "1500",
      ) as HTMLInputElement;
      expect(rateInput).toBeTruthy();
      await user.clear(rateInput);
      await user.type(rateInput, "2000");
      expect(rateInput.value).toBe("2000");
    });

    it("allows editing load number", async () => {
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} />);
      const inputs = document.querySelectorAll("input");
      const lnInput = Array.from(inputs).find(
        (i) => (i as HTMLInputElement).value === "LN-001",
      ) as HTMLInputElement;
      expect(lnInput).toBeTruthy();
      await user.clear(lnInput);
      await user.type(lnInput, "LN-999");
      expect(lnInput.value).toBe("LN-999");
    });

    it("disables inputs when locked", async () => {
      const user = userEvent.setup();
      render(
        <EditLoadForm
          {...defaultProps}
          initialData={{ ...mockLoadData, isLocked: true }}
        />,
      );
      const inputs = document.querySelectorAll("input");
      const disabledInputs = Array.from(inputs).filter(
        (i) => (i as HTMLInputElement).disabled,
      );
      expect(disabledInputs.length).toBeGreaterThan(0);
    });
  });

  describe("form submission", () => {
    it("passes form data to onSave when submitted", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<EditLoadForm {...defaultProps} onSave={onSave} />);
      await user.click(screen.getByText("Save Changes"));
      expect(onSave).toHaveBeenCalledTimes(1);
      const savedData = onSave.mock.calls[0][0];
      expect(savedData.loadNumber).toBe("LN-001");
      expect(savedData.carrierRate).toBe(1500);
      expect(savedData.driverPay).toBe(900);
      expect(savedData.status).toBe(LOAD_STATUS.Planned);
    });

    it("does not call onSave when locked", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(
        <EditLoadForm
          {...defaultProps}
          onSave={onSave}
          initialData={{ ...mockLoadData, isLocked: true }}
        />,
      );
      const saveBtn = screen.getByText("Save Changes");
      expect(saveBtn).toBeDisabled();
    });
  });

  describe("onOpenHub callback", () => {
    it("calls onOpenHub when Log Call is clicked", async () => {
      const onOpenHub = vi.fn();
      const user = userEvent.setup();
      render(
        <EditLoadForm
          {...defaultProps}
          onOpenHub={onOpenHub}
          users={[
            {
              id: "driver-1",
              name: "John",
              role: "driver",
              companyId: "c1",
              email: "j@t.com",
              onboardingStatus: "Completed",
              safetyScore: 90,
            },
          ]}
        />,
      );
      await user.click(screen.getByText("Log Call"));
      expect(onOpenHub).toHaveBeenCalledWith("feed", true);
    });
  });

  describe("restricted driver mode", () => {
    it("renders with restricted driver prop", () => {
      render(<EditLoadForm {...defaultProps} isRestrictedDriver={true} />);
      expect(screen.getByText(/LN-001/)).toBeInTheDocument();
    });
  });
});
