import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditLoadForm } from "../../../components/EditLoadForm";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Mock services at network boundary
vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn().mockResolvedValue({ id: "company-1", name: "Test Co" }),
  getCompanyUsers: vi.fn().mockResolvedValue([]),
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
}));

vi.mock("../../../services/storageService", () => ({
  generateBolPDF: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("test-uuid-1234"),
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

function buildLoadData(overrides: Partial<LoadData> = {}): Partial<LoadData> {
  return {
    id: "load-val-1",
    companyId: "company-1",
    loadNumber: "LN-VAL-001",
    status: LOAD_STATUS.Planned,
    carrierRate: 1500,
    driverPay: 900,
    pickupDate: "2025-12-01",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
    driverId: "driver-1",
    commodity: "Electronics",
    freightType: "Dry Van",
    legs: [
      {
        id: "leg-1",
        type: "Pickup",
        location: { city: "Chicago", state: "IL", facilityName: "Warehouse A" },
        date: "2025-12-01",
        completed: false,
      },
      {
        id: "leg-2",
        type: "Dropoff",
        location: { city: "Dallas", state: "TX", facilityName: "Depot B" },
        date: "2025-12-05",
        completed: false,
      },
    ],
    ...overrides,
  };
}

// Tests R-VAL-07
describe("EditLoadForm validation", () => {
  const onSave = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tests R-VAL-05
  it("shows error message when carrier rate is negative", async () => {
    const user = userEvent.setup();
    const loadData = buildLoadData({ carrierRate: -100 });

    render(
      <EditLoadForm
        initialData={loadData as LoadData}
        onSave={onSave}
        onCancel={onCancel}
        currentUser={mockUser}
      />,
    );

    const saveButton = screen.getByText("Save Changes");
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getAllByText("Carrier rate cannot be negative").length,
      ).toBeGreaterThanOrEqual(1);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  // Tests R-VAL-01
  it("validateForm rejects negative carrierRate", async () => {
    const user = userEvent.setup();
    const loadData = buildLoadData({ carrierRate: -50 });

    render(
      <EditLoadForm
        initialData={loadData as LoadData}
        onSave={onSave}
        onCancel={onCancel}
        currentUser={mockUser}
      />,
    );

    const saveButton = screen.getByText("Save Changes");
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getAllByText("Carrier rate cannot be negative").length,
      ).toBeGreaterThanOrEqual(1);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  // Tests R-VAL-02
  it("validateForm rejects negative driverPay", async () => {
    const user = userEvent.setup();
    const loadData = buildLoadData({ driverPay: -25 });

    render(
      <EditLoadForm
        initialData={loadData as LoadData}
        onSave={onSave}
        onCancel={onCancel}
        currentUser={mockUser}
      />,
    );

    const saveButton = screen.getByText("Save Changes");
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getAllByText("Driver pay cannot be negative").length,
      ).toBeGreaterThanOrEqual(1);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  // Tests R-VAL-03, R-VAL-06
  it("shows error when pickup date is after dropoff date", async () => {
    const user = userEvent.setup();
    const loadData = buildLoadData({
      legs: [
        {
          id: "leg-1",
          type: "Pickup",
          location: {
            city: "Chicago",
            state: "IL",
            facilityName: "Warehouse A",
          },
          date: "2025-12-10",
          completed: false,
        },
        {
          id: "leg-2",
          type: "Dropoff",
          location: {
            city: "Dallas",
            state: "TX",
            facilityName: "Depot B",
          },
          date: "2025-12-05",
          completed: false,
        },
      ],
    });

    render(
      <EditLoadForm
        initialData={loadData as LoadData}
        onSave={onSave}
        onCancel={onCancel}
        currentUser={mockUser}
      />,
    );

    const saveButton = screen.getByText("Save Changes");
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getAllByText("Pickup date must be before dropoff date").length,
      ).toBeGreaterThanOrEqual(1);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  // Tests R-VAL-04
  it("rate inputs have min=0 attribute", () => {
    const loadData = buildLoadData();

    render(
      <EditLoadForm
        initialData={loadData as LoadData}
        onSave={onSave}
        onCancel={onCancel}
        currentUser={mockUser}
      />,
    );

    const grossPayInput = document.getElementById(
      "elfGrossPayRevenue",
    ) as HTMLInputElement;
    const carrierPayInput = document.getElementById(
      "elfCarrierPayExp",
    ) as HTMLInputElement;

    expect(grossPayInput).not.toBeNull();
    expect(carrierPayInput).not.toBeNull();
    expect(grossPayInput.getAttribute("min")).toBe("0");
    expect(carrierPayInput.getAttribute("min")).toBe("0");
  });

  // Tests R-VAL-05 (negative path: valid rate passes)
  it("allows save with valid positive rates", async () => {
    const user = userEvent.setup();
    const loadData = buildLoadData({ carrierRate: 1000, driverPay: 500 });

    render(
      <EditLoadForm
        initialData={loadData as LoadData}
        onSave={onSave}
        onCancel={onCancel}
        currentUser={mockUser}
      />,
    );

    const saveButton = screen.getByText("Save Changes");
    await user.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  // Tests R-VAL-06 (negative path: valid date order passes)
  it("allows save with valid date order (pickup before dropoff)", async () => {
    const user = userEvent.setup();
    const loadData = buildLoadData({
      legs: [
        {
          id: "leg-1",
          type: "Pickup",
          location: {
            city: "Chicago",
            state: "IL",
            facilityName: "Warehouse A",
          },
          date: "2025-12-01",
          completed: false,
        },
        {
          id: "leg-2",
          type: "Dropoff",
          location: {
            city: "Dallas",
            state: "TX",
            facilityName: "Depot B",
          },
          date: "2025-12-05",
          completed: false,
        },
      ],
    });

    render(
      <EditLoadForm
        initialData={loadData as LoadData}
        onSave={onSave}
        onCancel={onCancel}
        currentUser={mockUser}
      />,
    );

    const saveButton = screen.getByText("Save Changes");
    await user.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  // Negative test: both rate errors shown simultaneously
  it("shows both rate errors when both rates are negative", async () => {
    const user = userEvent.setup();
    const loadData = buildLoadData({ carrierRate: -100, driverPay: -50 });

    render(
      <EditLoadForm
        initialData={loadData as LoadData}
        onSave={onSave}
        onCancel={onCancel}
        currentUser={mockUser}
      />,
    );

    const saveButton = screen.getByText("Save Changes");
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getAllByText("Carrier rate cannot be negative").length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText("Driver pay cannot be negative").length,
      ).toBeGreaterThanOrEqual(1);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  // Negative test: zero rates are valid
  it("allows save when rates are exactly zero", async () => {
    const user = userEvent.setup();
    const loadData = buildLoadData({ carrierRate: 0, driverPay: 0 });

    render(
      <EditLoadForm
        initialData={loadData as LoadData}
        onSave={onSave}
        onCancel={onCancel}
        currentUser={mockUser}
      />,
    );

    const saveButton = screen.getByText("Save Changes");
    await user.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });
});
