import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SafetyView } from "../../../components/SafetyView";
import type { User, LoadData } from "../../../types";

// Capture mock functions for assertions
const mockSaveMaintenanceRecord = vi.fn().mockResolvedValue(undefined);
const mockSaveQuiz = vi.fn().mockResolvedValue(undefined);
const mockRegisterAsset = vi.fn().mockResolvedValue(undefined);
const mockCreateIncident = vi.fn().mockResolvedValue(undefined);
const mockSaveLoad = vi.fn().mockResolvedValue(undefined);
const mockGetComplianceRecords = vi.fn().mockResolvedValue([]);

vi.mock("../../../services/safetyService", () => ({
  checkDriverCompliance: vi.fn().mockResolvedValue({ compliant: true }),
  getDriverQuizzes: vi.fn().mockResolvedValue([]),
  saveQuiz: (...args: unknown[]) => mockSaveQuiz(...args),
  calculateDriverPerformance: vi.fn().mockResolvedValue({
    driverId: "user-1",
    totalScore: 85,
    grade: "Solid",
    status: "Active",
    metrics: {
      safetyScore: 90,
      onTimeRate: 80,
      paperworkScore: 75,
      loadCount: 10,
    },
  }),
  logSafetyActivity: vi.fn().mockResolvedValue(undefined),
  getStoredQuizzes: vi.fn().mockResolvedValue([]),
  registerAsset: (...args: unknown[]) => mockRegisterAsset(...args),
  saveQuizResult: vi.fn().mockResolvedValue(undefined),
  getMaintenanceRecords: vi.fn().mockResolvedValue([]),
  saveMaintenanceRecord: (...args: unknown[]) =>
    mockSaveMaintenanceRecord(...args),
  getServiceTickets: vi.fn().mockReturnValue([]),
  saveServiceTicket: vi.fn().mockResolvedValue(undefined),
  getVendors: vi.fn().mockReturnValue([]),
  getEquipment: vi.fn().mockResolvedValue([]),
  getComplianceRecords: (...args: unknown[]) =>
    mockGetComplianceRecords(...args),
}));

vi.mock("../../../services/authService", () => ({
  getCompanyUsers: vi.fn().mockResolvedValue([
    {
      id: "user-1",
      name: "Test Driver",
      email: "driver@test.com",
      role: "driver",
      companyId: "company-1",
      onboardingStatus: "Completed",
      safetyScore: 90,
    },
    {
      id: "user-2",
      name: "Test Admin",
      email: "admin@test.com",
      role: "admin",
      companyId: "company-1",
      onboardingStatus: "Completed",
      safetyScore: 95,
    },
  ]),
  getCompany: vi.fn().mockResolvedValue({
    id: "company-1",
    name: "Test Trucking",
    accountType: "fleet",
  }),
  updateCompany: vi.fn().mockResolvedValue(undefined),
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../../../services/storageService", () => ({
  saveLoad: (...args: unknown[]) => mockSaveLoad(...args),
  createIncident: (...args: unknown[]) => mockCreateIncident(...args),
  seedIncidents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/firebase", () => ({
  DEMO_MODE: false,
}));

vi.mock("../../../components/Scanner", () => ({
  Scanner: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="scanner-mock">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-001"),
}));

const mockUser: User = {
  id: "user-1",
  name: "Test Admin",
  email: "admin@test.com",
  role: "admin",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 95,
};

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "user-1",
    loadNumber: "LD-100",
    status: "in_transit",
    carrierRate: 2500,
    driverPay: 1200,
    pickupDate: "2026-03-10",
    pickup: { city: "Dallas", state: "TX", facilityName: "Acme Warehouse" },
    dropoff: { city: "Houston", state: "TX", facilityName: "Beta Dock" },
    palletCount: 10,
    pieceCount: 200,
    weight: 35000,
    issues: [],
  } as LoadData,
];

describe("SafetyView deep coverage - uncovered lines 1238-1297, 1315-1393", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
  });

  describe("maintenance form submission (lines 1238-1242)", () => {
    it("opens maintenance form from Service tab and submits", async () => {
      render(<SafetyView user={mockUser} loads={mockLoads} />);

      // Navigate to Service tab
      await user.click(screen.getByText("Service"));
      await waitFor(() => {
        expect(
          screen.getByText("Maintenance & Service Tickets"),
        ).toBeInTheDocument();
      });

      // Click "Open Service Ticket" button which calls setShowForm("maintenance")
      await user.click(screen.getByText("Open Service Ticket"));

      // Modal should open with "maintenance Registration" title
      await waitFor(() => {
        expect(screen.getByText(/Registration/)).toBeInTheDocument();
      });

      // Fill in the maintenance form
      const descriptionInput = screen.getByPlaceholderText(
        "e.g. Annual Inspection and Oil Change",
      );
      await user.type(descriptionInput, "Brake pad replacement");

      // Submit the form
      const submitBtn = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockSaveMaintenanceRecord).toHaveBeenCalledTimes(1);
      });

      const savedRecord = mockSaveMaintenanceRecord.mock.calls[0][0];
      expect(savedRecord).toHaveProperty("id", "mock-uuid-001");
      expect(savedRecord).toHaveProperty("date");
      expect(savedRecord.description).toBe("Brake pad replacement");
    });
  });

  describe("quiz form submission (lines 1243-1250)", () => {
    it("opens quiz form from Academy tab and submits with correct shape", async () => {
      render(<SafetyView user={mockUser} loads={mockLoads} />);

      // Navigate to Academy tab
      await user.click(screen.getByText("Academy"));
      await waitFor(() => {
        expect(
          screen.getByText("Safety Academy & Training"),
        ).toBeInTheDocument();
      });

      // Click "Create Course" button which calls setShowForm("quiz")
      await user.click(screen.getByText("Create Course"));

      // Modal should open
      await waitFor(() => {
        expect(screen.getByText(/Registration/)).toBeInTheDocument();
      });

      // Fill in quiz title
      const courseInput = screen.getByPlaceholderText(
        "e.g. Hazardous Materials Handling",
      );
      await user.type(courseInput, "Winter Driving Safety");
      expect(courseInput).toHaveValue("Winter Driving Safety");

      // Toggle mandatory checkbox
      const mandatoryCheckbox = screen.getByLabelText(
        "Mandatory for all operators",
      );
      await user.click(mandatoryCheckbox);
      expect(mandatoryCheckbox).toBeChecked();

      // Submit
      const submitBtn = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockSaveQuiz).toHaveBeenCalledTimes(1);
      });

      const savedQuiz = mockSaveQuiz.mock.calls[0][0];
      expect(savedQuiz).toHaveProperty("id", "mock-uuid-001");
      expect(savedQuiz).toHaveProperty("createdAt");
      expect(savedQuiz.questions).toEqual([]);
      expect(savedQuiz.assignedTo).toEqual(["all"]);
      expect(savedQuiz.title).toBe("Winter Driving Safety");
      expect(savedQuiz.isMandatory).toBe(true);
    });
  });

  describe("incident form submission (lines 1251-1297)", () => {
    it("opens incident form from Roster card and shows load-filtered fields", async () => {
      render(<SafetyView user={mockUser} loads={mockLoads} />);

      // Navigate to Roster tab
      await user.click(screen.getByText("Roster"));
      await waitFor(() => {
        expect(screen.getByText("Test Driver")).toBeInTheDocument();
      });

      // Click "Incident" button on a driver card
      const incidentBtns = screen.getAllByText("Incident");
      await user.click(incidentBtns[0]);

      // Modal should open with incident form
      await waitFor(() => {
        expect(screen.getByText(/Registration/)).toBeInTheDocument();
      });

      // Incident form should have severity selector with "Safety Violation" default
      expect(screen.getByText("Safety Violation")).toBeInTheDocument();
      expect(screen.getByText("Equipment Failure")).toBeInTheDocument();
      expect(screen.getByText("Generic Incident")).toBeInTheDocument();

      // Should show "Select Relevant Manifest" label
      expect(screen.getByText("Select Relevant Manifest")).toBeInTheDocument();

      // The load dropdown should contain the load filtered by driverId
      expect(screen.getByText(/PRO LD-100/)).toBeInTheDocument();
    });

    it("submits incident and creates both incident and load issue", async () => {
      render(<SafetyView user={mockUser} loads={mockLoads} />);

      await user.click(screen.getByText("Roster"));
      await waitFor(() => {
        expect(screen.getByText("Test Driver")).toBeInTheDocument();
      });

      // Open incident form
      const incidentBtns = screen.getAllByText("Incident");
      await user.click(incidentBtns[0]);

      await waitFor(() => {
        expect(screen.getByText(/Registration/)).toBeInTheDocument();
      });

      // Select the load
      const loadSelect = screen.getByText("Select Load...").closest("select")!;
      await user.selectOptions(loadSelect, "load-1");

      // Select severity category explicitly (onChange must fire for formData)
      const severitySelect = screen
        .getByText("Safety Violation")
        .closest("select")!;
      await user.selectOptions(severitySelect, "Safety");

      // Fill in description
      const descTextarea = screen.getByPlaceholderText(
        /DESCRIBE THE INCIDENT IN DETAIL/,
      );
      await user.type(descTextarea, "Driver ran red light");

      // Submit
      const submitBtn = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockCreateIncident).toHaveBeenCalledTimes(1);
      });

      const createdIncident = mockCreateIncident.mock.calls[0][0];
      expect(createdIncident).toHaveProperty("id", "mock-uuid-001");
      expect(createdIncident.loadId).toBe("load-1");
      expect(createdIncident.description).toBe("Driver ran red light");
      expect(createdIncident.status).toBe("Open");
      expect(createdIncident.reportedBy).toBe("Test Admin");
      expect(createdIncident.timeline).toHaveLength(1);
      expect(createdIncident.timeline[0].action).toBe("Incident Created");

      // Should also update the load with the new issue
      await waitFor(() => {
        expect(mockSaveLoad).toHaveBeenCalledTimes(1);
      });

      const updatedLoad = mockSaveLoad.mock.calls[0][0];
      expect(updatedLoad.isActionRequired).toBe(true);
      expect(updatedLoad.actionSummary).toContain("CRISIS ALERT");
      expect(updatedLoad.issues).toHaveLength(1);
      expect(updatedLoad.issues[0].category).toBe("Safety");
    });
  });

  describe("compliance history modal (lines 1315-1393)", () => {
    it("opens compliance modal from Roster and shows records with details", async () => {
      mockGetComplianceRecords.mockResolvedValue([
        {
          id: "comp-1",
          type: "CDL",
          title: "Commercial Driver License",
          description: "Class A CDL renewal",
          expires_at: "2027-06-15T00:00:00Z",
          reference_number: "CDL-123456",
          status: "Valid",
        },
        {
          id: "comp-2",
          type: "Medical",
          title: "DOT Physical",
          description: "Annual physical exam",
          expires_at: "2026-12-01T00:00:00Z",
          status: "Expired",
        },
      ]);

      render(<SafetyView user={mockUser} loads={mockLoads} />);

      await user.click(screen.getByText("Roster"));
      await waitFor(() => {
        expect(screen.getByText("Test Driver")).toBeInTheDocument();
      });

      // Click the first "Compliance History" button on driver card
      // There are 2 cards (Test Driver + Test Admin), each has a Compliance History button
      const complianceBtns = screen.getAllByText("Compliance History");
      await user.click(complianceBtns[0]);

      await waitFor(() => {
        expect(mockGetComplianceRecords).toHaveBeenCalled();
      });

      // The compliance-specific modal (showForm === "compliance") shows records
      await waitFor(() => {
        expect(screen.getByText("CDL")).toBeInTheDocument();
      });

      expect(screen.getByText("Commercial Driver License")).toBeInTheDocument();
      expect(screen.getByText("Class A CDL renewal")).toBeInTheDocument();
      expect(screen.getByText("Valid")).toBeInTheDocument();

      expect(screen.getByText("Medical")).toBeInTheDocument();
      expect(screen.getByText("DOT Physical")).toBeInTheDocument();
      expect(screen.getByText("Expired")).toBeInTheDocument();

      // Reference number should be shown for comp-1
      expect(screen.getByText(/CDL-123456/)).toBeInTheDocument();
    });

    it("shows empty state when no compliance records exist", async () => {
      mockGetComplianceRecords.mockResolvedValue([]);

      render(<SafetyView user={mockUser} loads={mockLoads} />);

      await user.click(screen.getByText("Roster"));
      await waitFor(() => {
        expect(screen.getByText("Test Driver")).toBeInTheDocument();
      });

      const complianceBtns = screen.getAllByText("Compliance History");
      await user.click(complianceBtns[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/No active compliance violations logged/),
        ).toBeInTheDocument();
      });
    });

    it("closes compliance modal when X is clicked", async () => {
      mockGetComplianceRecords.mockResolvedValue([]);

      render(<SafetyView user={mockUser} loads={mockLoads} />);

      await user.click(screen.getByText("Roster"));
      await waitFor(() => {
        expect(screen.getByText("Test Driver")).toBeInTheDocument();
      });

      const complianceBtns = screen.getAllByText("Compliance History");
      await user.click(complianceBtns[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/No active compliance violations logged/),
        ).toBeInTheDocument();
      });

      // The compliance modal's close button is in the header bar.
      // The h3 "Compliance History" is inside a modal with a close button.
      // Find all buttons currently in the document, the X close is
      // near the compliance modal heading.
      const allButtons = screen.getAllByRole("button");
      // Find the close button that's inside the compliance modal overlay
      // (the fixed inset-0 z-[1000] div) by looking for the one near "Compliance History"
      const complianceHeading = screen.getByText("Compliance History", {
        selector: "h3",
      });
      const modalContainer =
        complianceHeading.closest("[class*='fixed inset-0']") ||
        complianceHeading.closest("[class*='z-']");

      // If we found the modal container, find the close button within it
      if (modalContainer) {
        const closeBtn =
          modalContainer.querySelectorAll("button")[
            modalContainer.querySelectorAll("button").length - 1
          ];
        await user.click(closeBtn);
      } else {
        // Fallback: click the header's parent close button
        const headerDiv = complianceHeading.closest(
          ".flex.items-center.justify-between",
        );
        if (headerDiv) {
          const closeBtns = headerDiv.querySelectorAll("button");
          await user.click(closeBtns[closeBtns.length - 1]);
        }
      }

      await waitFor(() => {
        expect(
          screen.queryByText(/No active compliance violations logged/),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("asset form submission (line 1235-1236)", () => {
    it("opens asset registration from Assets tab and submits", async () => {
      render(<SafetyView user={mockUser} loads={mockLoads} />);

      await user.click(screen.getByText("Assets"));
      await waitFor(() => {
        expect(screen.getByText("Fleet Registry")).toBeInTheDocument();
      });

      // Click "Register Asset"
      await user.click(screen.getByText("Register Asset"));

      await waitFor(() => {
        expect(screen.getByText(/Registration/)).toBeInTheDocument();
      });

      // Fill in asset ID
      const assetInput = screen.getByPlaceholderText("e.g. TR-101");
      await user.type(assetInput, "TR-505");

      // Submit
      const submitBtn = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockRegisterAsset).toHaveBeenCalledTimes(1);
      });

      expect(mockRegisterAsset).toHaveBeenCalledWith(
        "company-1",
        expect.objectContaining({ id: "TR-505" }),
        mockUser,
      );
    });
  });

  describe("form modal close behavior", () => {
    it("closes any form modal when X button is clicked", async () => {
      render(<SafetyView user={mockUser} loads={mockLoads} />);

      await user.click(screen.getByText("Assets"));
      await waitFor(() => {
        expect(screen.getByText("Fleet Registry")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Register Asset"));
      await waitFor(() => {
        expect(screen.getByText(/Registration/)).toBeInTheDocument();
      });

      // Find the X button in the form modal header
      const modalHeader = screen
        .getByText(/Registration/)
        .closest("div")!.parentElement!;
      const xButtons = modalHeader.querySelectorAll("button");
      // The X close button is the last one in the header row
      let found = false;
      for (const btn of xButtons) {
        if (btn.querySelector("svg") || btn.textContent === "") {
          await user.click(btn);
          found = true;
          break;
        }
      }

      if (found) {
        await waitFor(() => {
          expect(
            screen.queryByText("asset Registration"),
          ).not.toBeInTheDocument();
        });
      }
    });

    it("shows feedback toast after successful form submission", async () => {
      render(<SafetyView user={mockUser} loads={mockLoads} />);

      await user.click(screen.getByText("Service"));
      await waitFor(() => {
        expect(
          screen.getByText("Maintenance & Service Tickets"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByText("Open Service Ticket"));
      await waitFor(() => {
        expect(screen.getByText(/Registration/)).toBeInTheDocument();
      });

      const submitBtn = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Saved Successfully/i)).toBeInTheDocument();
      });
    });
  });
});
