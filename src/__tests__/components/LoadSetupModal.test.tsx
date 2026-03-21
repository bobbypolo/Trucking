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
      expect(screen.getByText(/Select Broker \/ Customer/)).toBeInTheDocument();
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
      expect(screen.getByText("Select Carrier / Driver")).toBeInTheDocument();
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

    it("shows Select Broker text when no broker is pre-selected", () => {
      render(<LoadSetupModal {...defaultProps} />);
      expect(screen.getByText("Select Broker")).toBeInTheDocument();
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
});
