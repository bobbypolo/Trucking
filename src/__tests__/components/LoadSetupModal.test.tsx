import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadSetupModal } from "../../../components/LoadSetupModal";
import { User } from "../../../types";

// Mock services at network boundary
vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([
    { id: "broker-1", name: "Alpha Logistics", mcNumber: "MC-123" },
    { id: "broker-2", name: "Beta Freight", mcNumber: "MC-456" },
  ]),
  saveBroker: vi.fn().mockResolvedValue(undefined),
  getContracts: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/authService", () => ({
  getCompanyUsers: vi.fn().mockResolvedValue([
    {
      id: "driver-1",
      name: "John Driver",
      role: "driver",
      companyId: "c1",
    },
    {
      id: "oo-1",
      name: "Jane OO",
      role: "owner_operator",
      companyId: "c1",
    },
    {
      id: "disp-1",
      name: "Bob Dispatch",
      role: "dispatcher",
      companyId: "c1",
    },
  ]),
  getCompany: vi.fn().mockResolvedValue({
    id: "company-1",
    name: "Test Co",
    loadNumberingConfig: { prefix: "LP", nextNumber: 100 },
  }),
  updateUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/storageService", () => ({
  generateNextLoadNumber: vi.fn().mockReturnValue("LP-100"),
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

describe("LoadSetupModal component", () => {
  const defaultProps = {
    currentUser: mockUser,
    onContinue: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders without crashing", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(screen.getByText("Setup New Load")).toBeInTheDocument();
    });

    it("renders the modal title", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(screen.getByText("Setup New Load")).toBeInTheDocument();
    });

    it("renders broker selection label", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(
        screen.getByLabelText(/Select Broker \/ Customer/),
      ).toBeInTheDocument();
    });

    it("renders driver selection label", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(screen.getByText(/Assign Driver/)).toBeInTheDocument();
    });

    it("renders Scan Doc button", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(screen.getByText(/Scan Doc/)).toBeInTheDocument();
    });

    it("renders Phone Order button", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(screen.getByText("Phone Order")).toBeInTheDocument();
    });

    it("renders explanatory text about phone order", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(
        screen.getByText(/Phone Order.*auto-generate/i),
      ).toBeInTheDocument();
    });

    it("renders close button", () => {
      render(<LoadSetupModal {...defaultProps} />);
      // X button to close
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(3); // Close, Scan Doc, Phone Order
    });
  });

  describe("cancel/close", () => {
    it("calls onCancel when close button is clicked", async () => {
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      // The X close button is the first button in the header (empty text)
      const closeButtons = screen.getAllByRole("button");
      const closeBtn = closeButtons.find(
        (btn) => !btn.textContent?.trim() || btn.textContent?.trim() === "",
      );
      expect(closeBtn).toBeDefined();
      await user.click(closeBtn!);
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("driver selection dropdown", () => {
    it("renders driver select with placeholder", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(screen.getByText("Assign Later")).toBeInTheDocument();
    });

    it("populates drivers from API after mount", async () => {
      render(<LoadSetupModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("John Driver")).toBeInTheDocument();
        expect(screen.getByText("Jane OO")).toBeInTheDocument();
      });
    });

    it("only shows drivers and owner operators, not dispatchers", async () => {
      render(<LoadSetupModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("John Driver")).toBeInTheDocument();
      });
      // Dispatchers should not be in the driver dropdown
      const selects = document.querySelectorAll("select");
      const driverSelect = Array.from(selects).find((s) =>
        Array.from(s.options).some((o) => o.textContent === "John Driver"),
      );
      expect(driverSelect).toBeTruthy();
      const options = Array.from(driverSelect!.options).map(
        (o) => o.textContent,
      );
      expect(options).not.toContain("Bob Dispatch");
    });

    it("allows selecting a driver", async () => {
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("John Driver")).toBeInTheDocument();
      });
      const selects = document.querySelectorAll("select");
      const driverSelect = Array.from(selects).find((s) =>
        Array.from(s.options).some((o) => o.textContent === "John Driver"),
      ) as HTMLSelectElement;
      await user.selectOptions(driverSelect, "driver-1");
      expect(driverSelect.value).toBe("driver-1");
    });
  });

  describe("validation", () => {
    it("disables Scan Doc button when broker and driver are not selected", () => {
      render(<LoadSetupModal {...defaultProps} />);
      const scanBtn = screen.getByText(/Scan Doc/).closest("button");
      expect(scanBtn).toBeDisabled();
    });
  });

  describe("phone order flow", () => {
    it("shows call notes field when Phone Order is clicked", async () => {
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByText("Phone Order"));
      expect(screen.getByText("Initial Call Notes")).toBeInTheDocument();
    });

    it("changes button text to Create Order in phone order mode", async () => {
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByText("Phone Order"));
      expect(screen.getByText("Create Order")).toBeInTheDocument();
    });

    it("allows typing call notes", async () => {
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByText("Phone Order"));
      const textarea = screen.getByPlaceholderText(/Appointment required/i);
      await user.type(textarea, "Delivery at back dock only");
      expect(textarea).toHaveValue("Delivery at back dock only");
    });
  });

  describe("pre-selected broker", () => {
    it("shows locked indicator when preSelectedBrokerId is provided", async () => {
      render(
        <LoadSetupModal {...defaultProps} preSelectedBrokerId="broker-1" />,
      );
      await waitFor(() => {
        const text = document.body.textContent || "";
        expect(text).toContain("(Locked)");
      });
    });

    it("shows the pre-selected broker name", async () => {
      render(
        <LoadSetupModal {...defaultProps} preSelectedBrokerId="broker-1" />,
      );
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });
    });
  });

  describe("wizard steps and notes field (lines 72-93, 109)", () => {
    it("shows call notes textarea and allows typing when in phone order mode", async () => {
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByText("Phone Order"));
      const textarea = screen.getByPlaceholderText(/Appointment required/i);
      expect(textarea).toBeInTheDocument();
      await user.type(textarea, "Special instructions for dock 5");
      expect(textarea).toHaveValue("Special instructions for dock 5");
    });

    it("shows Create Order button text after entering phone order mode", async () => {
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByText("Phone Order"));
      expect(screen.getByText("Create Order")).toBeInTheDocument();
      expect(screen.queryByText("Phone Order")).not.toBeInTheDocument();
    });

    it("shows broker dropdown with placeholder when no broker is pre-selected", () => {
      render(<LoadSetupModal {...defaultProps} />);
      const brokerSelect = screen.getByRole("combobox", {
        name: /Select Broker \/ Customer/,
      }) as HTMLSelectElement;
      expect(brokerSelect).toBeInTheDocument();
      // First option is the placeholder
      expect(brokerSelect.options[0].textContent).toBe(
        "Select Broker / Customer",
      );
    });

    it("shows explanatory help text about phone order auto-numbering", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(
        screen.getByText(/auto-generate the next Load #/),
      ).toBeInTheDocument();
    });

    it("renders both Scan Doc and Phone Order action buttons", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(screen.getByText(/Scan Doc/)).toBeInTheDocument();
      expect(screen.getByText("Phone Order")).toBeInTheDocument();
    });

    it("disables Scan Doc button when no broker or driver is selected", () => {
      render(<LoadSetupModal {...defaultProps} />);
      const scanBtn = screen.getByText(/Scan Doc/).closest("button");
      expect(scanBtn).toBeDisabled();
    });
  });

  describe("interactive broker selection (generic Create Load path)", () => {
    it("renders broker dropdown with Direct / No Broker option", async () => {
      render(<LoadSetupModal {...defaultProps} />);
      await waitFor(() => {
        const brokerSelect = screen.getByRole("combobox", {
          name: /Select Broker \/ Customer/,
        }) as HTMLSelectElement;
        const options = Array.from(brokerSelect.options).map(
          (o) => o.textContent,
        );
        expect(options).toContain("Direct / No Broker");
      });
    });

    it("populates broker dropdown with brokers from API", async () => {
      render(<LoadSetupModal {...defaultProps} />);
      await waitFor(() => {
        const brokerSelect = screen.getByRole("combobox", {
          name: /Select Broker \/ Customer/,
        }) as HTMLSelectElement;
        const options = Array.from(brokerSelect.options).map(
          (o) => o.textContent,
        );
        expect(options).toContain("Alpha Logistics (MC-123)");
        expect(options).toContain("Beta Freight (MC-456)");
      });
    });

    it("allows selecting a broker from the dropdown", async () => {
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await waitFor(() => {
        expect(
          screen.getByRole("combobox", {
            name: /Select Broker \/ Customer/,
          }),
        ).toBeInTheDocument();
      });
      const brokerSelect = screen.getByRole("combobox", {
        name: /Select Broker \/ Customer/,
      }) as HTMLSelectElement;
      await user.selectOptions(brokerSelect, "broker-1");
      expect(brokerSelect.value).toBe("broker-1");
    });

    it("enables Scan Doc when a broker is selected without assigning a driver", async () => {
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("John Driver")).toBeInTheDocument();
      });
      // Select broker
      const brokerSelect = screen.getByRole("combobox", {
        name: /Select Broker \/ Customer/,
      }) as HTMLSelectElement;
      await user.selectOptions(brokerSelect, "broker-1");
      // Scan Doc should now be enabled
      const scanBtn = screen.getByText(/Scan Doc/).closest("button");
      expect(scanBtn).not.toBeDisabled();
    });

    it("enables Scan Doc with Direct / No Broker and no driver selected", async () => {
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("John Driver")).toBeInTheDocument();
      });
      // Select "Direct / No Broker"
      const brokerSelect = screen.getByRole("combobox", {
        name: /Select Broker \/ Customer/,
      }) as HTMLSelectElement;
      await user.selectOptions(brokerSelect, "__direct__");
      // Scan Doc should be enabled
      const scanBtn = screen.getByText(/Scan Doc/).closest("button");
      expect(scanBtn).not.toBeDisabled();
    });

    it("calls onContinue with empty brokerId and empty driverId when Direct / No Broker is selected without assignment", async () => {
      const user = userEvent.setup();
      const onContinue = vi.fn();
      render(<LoadSetupModal {...defaultProps} onContinue={onContinue} />);
      await waitFor(() => {
        expect(screen.getByText("John Driver")).toBeInTheDocument();
      });
      // Select "Direct / No Broker"
      const brokerSelect = screen.getByRole("combobox", {
        name: /Select Broker \/ Customer/,
      }) as HTMLSelectElement;
      await user.selectOptions(brokerSelect, "__direct__");
      // Click Scan Doc
      const scanBtn = screen.getByText(/Scan Doc/).closest("button")!;
      await user.click(scanBtn);
      // STORY-004 R-P4-19: Scan Doc now passes autoTrigger='upload' at index 6
      const call = onContinue.mock.calls[0];
      expect(call[0]).toBe("");
      expect(call[1]).toBe("");
      expect(call[6]).toBe("upload");
    });

    it("calls onContinue with actual brokerId and empty driverId when a real broker is selected without assignment", async () => {
      const user = userEvent.setup();
      const onContinue = vi.fn();
      render(<LoadSetupModal {...defaultProps} onContinue={onContinue} />);
      await waitFor(() => {
        expect(screen.getByText("John Driver")).toBeInTheDocument();
      });
      // Select real broker
      const brokerSelect = screen.getByRole("combobox", {
        name: /Select Broker \/ Customer/,
      }) as HTMLSelectElement;
      await user.selectOptions(brokerSelect, "broker-1");
      // Click Scan Doc
      const scanBtn = screen.getByText(/Scan Doc/).closest("button")!;
      await user.click(scanBtn);
      // STORY-004 R-P4-19: Scan Doc now passes autoTrigger='upload' at index 6
      const call = onContinue.mock.calls[0];
      expect(call[0]).toBe("broker-1");
      expect(call[1]).toBe("");
      expect(call[6]).toBe("upload");
    });

    it("still passes a driverId when one is explicitly assigned before continuing", async () => {
      const user = userEvent.setup();
      const onContinue = vi.fn();
      render(<LoadSetupModal {...defaultProps} onContinue={onContinue} />);
      await waitFor(() => {
        expect(screen.getByText("John Driver")).toBeInTheDocument();
      });
      const brokerSelect = screen.getByRole("combobox", {
        name: /Select Broker \/ Customer/,
      }) as HTMLSelectElement;
      await user.selectOptions(brokerSelect, "broker-1");
      const driverSelect = document.querySelectorAll("select");
      const dSelect = Array.from(driverSelect).find((s) =>
        Array.from(s.options).some((o) => o.textContent === "John Driver"),
      ) as HTMLSelectElement;
      await user.selectOptions(dSelect, "driver-1");
      const scanBtn = screen.getByText(/Scan Doc/).closest("button")!;
      await user.click(scanBtn);
      // STORY-004 R-P4-19: Scan Doc now passes autoTrigger='upload' at index 6
      const call = onContinue.mock.calls[0];
      expect(call[0]).toBe("broker-1");
      expect(call[1]).toBe("driver-1");
      expect(call[6]).toBe("upload");
    });

    it("does not show locked indicator when no preSelectedBrokerId", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(screen.queryByText("(Locked)")).not.toBeInTheDocument();
    });
  });

  describe("Quick Add Broker inline form", () => {
    it("renders Add New button next to broker label when not pre-selected", () => {
      // Tests R-P1-01: Quick Add button present for broker selector
      render(<LoadSetupModal {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /Add new broker/i }),
      ).toBeInTheDocument();
    });

    it("does not render Add New broker button when broker is pre-selected", () => {
      // Tests R-P1-02: Locked broker path has no Add New button
      render(
        <LoadSetupModal {...defaultProps} preSelectedBrokerId="broker-1" />,
      );
      expect(
        screen.queryByRole("button", { name: /Add new broker/i }),
      ).not.toBeInTheDocument();
    });

    it("shows quick add broker form when Add New is clicked", async () => {
      // Tests R-P1-03: Clicking Add New reveals the inline broker form
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByRole("button", { name: /Add new broker/i }));
      expect(screen.getByText("New Broker / Customer")).toBeInTheDocument();
      expect(screen.getByLabelText("Name *")).toBeInTheDocument();
    });

    it("hides quick add broker form when Cancel is clicked", async () => {
      // Tests R-P1-04: Cancel dismisses the inline form
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByRole("button", { name: /Add new broker/i }));
      expect(screen.getByText("New Broker / Customer")).toBeInTheDocument();
      // Cancel via the header toggle button (now shows "Cancel")
      await user.click(
        screen.getByRole("button", { name: /Cancel add broker/i }),
      );
      expect(
        screen.queryByText("New Broker / Customer"),
      ).not.toBeInTheDocument();
    });

    it("shows validation error when Save Broker clicked with empty name", async () => {
      // Tests R-P1-05: Name is required for broker creation
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByRole("button", { name: /Add new broker/i }));
      await user.click(screen.getByRole("button", { name: /Save Broker/i }));
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });

    it("calls saveBroker and refreshes list on valid submission", async () => {
      // Tests R-P1-06: saveBroker API is called with new broker data
      const { saveBroker } = await import("../../../services/brokerService");
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByRole("button", { name: /Add new broker/i }));
      await user.type(screen.getByLabelText("Name *"), "New Test Broker");
      await user.click(screen.getByRole("button", { name: /Save Broker/i }));
      await waitFor(() => {
        expect(saveBroker).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "New Test Broker",
            clientType: "Broker",
          }),
        );
      });
    });

    it("shows empty state hint when broker list is empty", async () => {
      // Tests R-P1-07: Empty state message guides user to create a broker
      const { getBrokers } = await import("../../../services/brokerService");
      vi.mocked(getBrokers).mockResolvedValueOnce([]);
      render(<LoadSetupModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/No brokers found/)).toBeInTheDocument();
      });
    });
  });

  describe("Quick Add Driver inline form", () => {
    it("renders Add New button next to driver label", () => {
      // Tests R-P1-08: Quick Add button present for driver selector
      render(<LoadSetupModal {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /Add new driver/i }),
      ).toBeInTheDocument();
    });

    it("shows quick add driver form when Add New is clicked", async () => {
      // Tests R-P1-09: Clicking Add New reveals the inline driver form
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByRole("button", { name: /Add new driver/i }));
      expect(screen.getByText("New Driver")).toBeInTheDocument();
      expect(screen.getByLabelText("Name *")).toBeInTheDocument();
    });

    it("hides quick add driver form when Cancel is clicked", async () => {
      // Tests R-P1-10: Cancel dismisses the inline driver form
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByRole("button", { name: /Add new driver/i }));
      expect(screen.getByText("New Driver")).toBeInTheDocument();
      await user.click(
        screen.getByRole("button", { name: /Cancel add driver/i }),
      );
      expect(screen.queryByText("New Driver")).not.toBeInTheDocument();
    });

    it("shows validation error when Save Driver clicked with empty name", async () => {
      // Tests R-P1-11: Name is required for driver creation
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByRole("button", { name: /Add new driver/i }));
      await user.click(screen.getByRole("button", { name: /Save Driver/i }));
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });

    it("calls updateUser and refreshes driver list on valid submission", async () => {
      // Tests R-P1-12: updateUser API is called with new driver data
      const { updateUser } = await import("../../../services/authService");
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByRole("button", { name: /Add new driver/i }));
      await user.type(screen.getByLabelText("Name *"), "New Test Driver");
      await user.click(screen.getByRole("button", { name: /Save Driver/i }));
      await waitFor(() => {
        expect(updateUser).toHaveBeenCalledWith(
          expect.objectContaining({ name: "New Test Driver", role: "driver" }),
        );
      });
    });

    it("shows empty state hint when driver list is empty", async () => {
      // Tests R-P1-13: Empty state message guides user to create a driver
      const { getCompanyUsers } = await import("../../../services/authService");
      vi.mocked(getCompanyUsers).mockResolvedValueOnce([]);
      render(<LoadSetupModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/No drivers found/)).toBeInTheDocument();
      });
    });

    it("opening driver form closes broker form", async () => {
      // Tests R-P1-14: Only one quick add form is visible at a time
      const user = userEvent.setup();
      render(<LoadSetupModal {...defaultProps} />);
      await user.click(screen.getByRole("button", { name: /Add new broker/i }));
      expect(screen.getByText("New Broker / Customer")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Add new driver/i }));
      expect(
        screen.queryByText("New Broker / Customer"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("New Driver")).toBeInTheDocument();
    });
  });
});
