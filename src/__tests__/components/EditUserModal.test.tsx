import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { EditUserModal } from "../../../components/EditUserModal";
import { User } from "../../../types";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    companyId: "co-1",
    email: "john@example.com",
    name: "John Smith",
    role: "dispatcher",
    onboardingStatus: "Completed",
    safetyScore: 90,
    payModel: "percent",
    payRate: 25,
    permissions: {
      createLoads: true,
      showRates: false,
      manageLegs: false,
      createBrokers: false,
      viewIntelligence: true,
      manageSafety: false,
      manageDrivers: false,
      canAutoCreateClientFromScan: false,
    },
    ...overrides,
  } as User;
}

describe("EditUserModal", () => {
  let onSave: MockedFunction<(updatedUser: User) => void>;
  let onCancel: MockedFunction<() => void>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    onSave = vi.fn<(updatedUser: User) => void>();
    onCancel = vi.fn<() => void>();
    user = userEvent.setup();
  });

  it("renders user name and role in the header", () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("dispatcher")).toBeInTheDocument();
  });

  it("renders user initial avatar", () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("renders three tab buttons: Identity, Pay Profile, Access", () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByText("Pay Profile")).toBeInTheDocument();
    expect(screen.getByText("Access")).toBeInTheDocument();
  });

  it("shows Identity tab content by default", () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    // Labels include asterisk for required fields: "Full Legal Name *", "Email *"
    expect(screen.getByText("Full Legal Name *")).toBeInTheDocument();
    expect(screen.getByText("Email *")).toBeInTheDocument();
    expect(screen.getByDisplayValue("John Smith")).toBeInTheDocument();
    expect(screen.getByDisplayValue("john@example.com")).toBeInTheDocument();
  });

  it("renders Primary Workspace and Duty Mode selects on Identity tab", () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    expect(screen.getByText("Primary Workspace")).toBeInTheDocument();
    expect(screen.getByText("Duty Mode")).toBeInTheDocument();
  });

  it("updates name field when typed into", async () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    const nameInput = screen.getByDisplayValue("John Smith");
    await user.clear(nameInput);
    await user.type(nameInput, "Jane Doe");
    expect(nameInput).toHaveValue("Jane Doe");
  });

  it("updates email field when typed into", async () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    const emailInput = screen.getByDisplayValue("john@example.com");
    await user.clear(emailInput);
    await user.type(emailInput, "jane@example.com");
    expect(emailInput).toHaveValue("jane@example.com");
  });

  it("switches to Pay Profile tab and shows pay model options", async () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Pay Profile"));
    expect(screen.getByText("Core Pay Model")).toBeInTheDocument();
    expect(screen.getByText("Load Revenue %")).toBeInTheDocument();
    expect(screen.getByText("Rate / Mile ($)")).toBeInTheDocument();
    expect(screen.getByText("Hourly Rate ($)")).toBeInTheDocument();
    expect(screen.getByText("Staff Salary (Fixed)")).toBeInTheDocument();
  });

  it("selects a different pay model", async () => {
    render(
      <EditUserModal
        user={makeUser({ payModel: "percent" })}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByText("Pay Profile"));
    // Click on "Rate / Mile ($)" to switch pay model
    await user.click(screen.getByText("Rate / Mile ($)"));
    // The mileage button should now have active styling
    const mileageBtn = screen.getByText("Rate / Mile ($)").closest("button")!;
    expect(mileageBtn.className).toContain("bg-blue-900");
  });

  it("shows pay rate input on Pay Profile tab", async () => {
    render(
      <EditUserModal
        user={makeUser({ payRate: 25 })}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByText("Pay Profile"));
    const rateInput = screen.getByDisplayValue("25");
    expect(rateInput).toBeInTheDocument();
  });

  it("switches to Access tab and shows permission toggles", async () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Access"));
    expect(screen.getByText("Sensitivity Controls")).toBeInTheDocument();
    expect(screen.getByText("Create Manifests")).toBeInTheDocument();
    expect(screen.getByText("See Gross Rates")).toBeInTheDocument();
    expect(screen.getByText("Itemize Custom Stops")).toBeInTheDocument();
    expect(screen.getByText("Create New Clients")).toBeInTheDocument();
    expect(screen.getByText("View Market IQ")).toBeInTheDocument();
  });

  it("toggles a permission checkbox on Access tab", async () => {
    render(
      <EditUserModal
        user={makeUser({
          permissions: {
            createLoads: true,
            showRates: false,
          },
        })}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByText("Access"));
    const checkboxes = screen.getAllByRole("checkbox");
    // Find the "See Gross Rates" checkbox -- it should be unchecked
    const ratesLabel = screen.getByText("See Gross Rates").closest("label")!;
    const ratesCheckbox = ratesLabel.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(ratesCheckbox.checked).toBe(false);

    await user.click(ratesCheckbox);
    expect(ratesCheckbox.checked).toBe(true);
  });

  it("calls onSave with updated user data when Save Changes is clicked", async () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    const nameInput = screen.getByDisplayValue("John Smith");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Name");
    await user.click(screen.getByText("Save Changes"));
    expect(onSave).toHaveBeenCalledTimes(1);
    const savedUser = onSave.mock.calls[0][0];
    expect(savedUser.name).toBe("Updated Name");
  });

  it("calls onCancel when Discard Modifications is clicked", async () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Discard Modifications"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when X button is clicked", async () => {
    render(
      <EditUserModal user={makeUser()} onSave={onSave} onCancel={onCancel} />,
    );
    // X button is in the header area
    const header = screen.getByText("John Smith").closest(".border-b")!;
    const closeBtn = header.querySelector("button")!;
    await user.click(closeBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows salary label when pay model is salary", async () => {
    render(
      <EditUserModal
        user={makeUser({ payModel: "salary", salaryAmount: 65000 })}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByText("Pay Profile"));
    expect(screen.getByText("Annual Compensation")).toBeInTheDocument();
  });

  it("shows Base Rate Policy label for non-salary pay model", async () => {
    render(
      <EditUserModal
        user={makeUser({ payModel: "percent" })}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByText("Pay Profile"));
    expect(screen.getByText("Base Rate Policy")).toBeInTheDocument();
  });
});
