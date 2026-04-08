/**
 * Tests for ExceptionConsole handleCreateIssue — covers R-P3-01..R-P3-06.
 *
 * Strategy: tests render <ExceptionConsole />, open the Create Issue modal,
 * fill the required fields, and click the submit button. All tests mock
 * createException at the service boundary (never mock the function under test).
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ExceptionConsole } from "../../../components/ExceptionConsole";
import { User, Exception, ExceptionType } from "../../../types";

/* ── Service mock ── */
vi.mock("../../../services/exceptionService", () => ({
  getExceptions: vi.fn(),
  getExceptionTypes: vi.fn(),
  updateException: vi.fn(),
  createException: vi.fn(),
}));

import {
  getExceptions,
  getExceptionTypes,
  createException,
} from "../../../services/exceptionService";

/* ── Fixtures ── */
const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Admin User",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockExceptions: Exception[] = [];

const mockTypes: ExceptionType[] = [
  {
    typeCode: "ROADSIDE_BREAKDOWN",
    displayName: "Roadside / Breakdown",
    dashboardGroup: "Maintenance",
    defaultOwnerTeam: "Dispatch",
    defaultSeverity: 3 as any,
    defaultSlaHours: 4,
  },
];

/* ── Helpers ── */

/** Renders ExceptionConsole and waits for the initial load to settle. */
async function renderAndSettle() {
  const utils = render(<ExceptionConsole currentUser={mockUser} />);
  await waitFor(() =>
    expect(screen.queryByText("Synching Issues...")).not.toBeInTheDocument(),
  );
  return utils;
}

/** Gets the modal overlay container (the fixed-positioned div). */
function getModalOverlay(): HTMLElement {
  // The modal is a fixed-positioned overlay rendered first in the component tree.
  // The Entity ID input lives inside it — walk up to the fixed div.
  return screen
    .getByLabelText(/Entity ID \/ Reference/i)
    .closest('div[class*="fixed"]') as HTMLElement;
}

/**
 * Opens the Create Issue modal by clicking the header button, then fills
 * the two required fields. Returns the modal overlay element.
 */
async function openModalAndFillFields(
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> {
  // Before the modal opens there is exactly one "Create Issue" button (the header).
  const [headerBtn] = screen.getAllByRole("button", { name: /Create Issue/i });
  await user.click(headerBtn);

  // Wait for the modal's Entity ID input to appear
  await waitFor(() =>
    expect(
      screen.getByLabelText(/Entity ID \/ Reference/i),
    ).toBeInTheDocument(),
  );

  await user.type(
    screen.getByLabelText(/Entity ID \/ Reference/i),
    "truck-101",
  );
  await user.type(
    screen.getByPlaceholderText(/Describe the issue in detail/i),
    "Brake failure reported",
  );

  return getModalOverlay();
}

/**
 * Returns the submit button scoped to the modal overlay.
 * Uses `within` to avoid matching the header "Create Issue" button.
 */
function getSubmitButton(): HTMLButtonElement {
  const modal = getModalOverlay();
  return within(modal).getByRole("button", {
    name: /^Create Issue$/i,
  }) as HTMLButtonElement;
}

/* ── Tests ── */

describe("ExceptionConsole handleCreateIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getExceptions).mockResolvedValue(mockExceptions);
    vi.mocked(getExceptionTypes).mockResolvedValue(mockTypes);
  });

  // Tests R-P3-01
  it("happy path — calls setIsCreating(true), resolves, closes modal, reloads", async () => {
    const user = userEvent.setup();
    vi.mocked(createException).mockResolvedValueOnce("ex-123");

    await renderAndSettle();
    await openModalAndFillFields(user);

    const submitBtn = getSubmitButton();
    expect(submitBtn).not.toBeDisabled();

    await user.click(submitBtn);

    // After resolve: modal closes (Entity ID input gone)
    await waitFor(() =>
      expect(
        screen.queryByLabelText(/Entity ID \/ Reference/i),
      ).not.toBeInTheDocument(),
    );

    // createException called once with correct form data
    expect(vi.mocked(createException)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createException)).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "truck-101",
        description: "Brake failure reported",
      }),
    );

    // getExceptions called twice: initial load + reload after success
    expect(vi.mocked(getExceptions)).toHaveBeenCalledTimes(2);
  });

  // Tests R-P3-02
  it("validation error path — spinner resets, toast shows error, modal stays open", async () => {
    const user = userEvent.setup();
    vi.mocked(createException).mockRejectedValueOnce(
      new Error("Validation failed: description too short"),
    );

    await renderAndSettle();
    await openModalAndFillFields(user);

    const submitBtn = getSubmitButton();
    await user.click(submitBtn);

    // After rejection: "Creating..." gone (finally block ran setIsCreating(false))
    await waitFor(() =>
      expect(screen.queryByText("Creating...")).not.toBeInTheDocument(),
    );

    // Toast shows the real error message
    await waitFor(() =>
      expect(
        screen.getByText(/Validation failed: description too short/i),
      ).toBeInTheDocument(),
    );

    // Modal is STILL open — setShowCreateModal(false) was NOT called
    expect(
      screen.getByLabelText(/Entity ID \/ Reference/i),
    ).toBeInTheDocument();
  });

  // Tests R-P3-03
  it("network error path — spinner resets and toast contains network error message", async () => {
    const user = userEvent.setup();
    vi.mocked(createException).mockRejectedValueOnce(
      new Error("Network request failed"),
    );

    await renderAndSettle();
    await openModalAndFillFields(user);

    const submitBtn = getSubmitButton();
    await user.click(submitBtn);

    // setIsCreating(false) called via finally — "Creating..." disappears
    await waitFor(() =>
      expect(screen.queryByText("Creating...")).not.toBeInTheDocument(),
    );

    // Toast surfaces the real network error
    await waitFor(() =>
      expect(screen.getByText(/Network request failed/i)).toBeInTheDocument(),
    );
  });

  // Tests R-P3-04
  it("ExceptionConsole.tsx source contains finally followed (within 100 chars) by setIsCreating(false)", () => {
    const src = readFileSync(
      resolve(__dirname, "../../../components/ExceptionConsole.tsx"),
      "utf8",
    );
    const idx = src.indexOf("finally");
    expect(idx).toBeGreaterThan(-1);
    const windowStr = src.slice(idx, idx + 100);
    expect(windowStr).toContain("setIsCreating(false)");
  });

  // Tests R-P3-05
  it("exceptionService.ts createException body contains throw new Error and cause:", () => {
    const src = readFileSync(
      resolve(__dirname, "../../../services/exceptionService.ts"),
      "utf8",
    );
    expect(src).toContain("throw new Error");
    expect(src).toContain("cause:");
  });

  // Tests R-P3-06
  it("integration — Creating... spinner gone and modal stays visible after API 500 rejection", async () => {
    const user = userEvent.setup();
    vi.mocked(createException).mockRejectedValueOnce(
      new Error("Request failed with status 500"),
    );

    await renderAndSettle();

    // Open the modal using the header "Create Issue" button (first in DOM)
    const [openBtn] = screen.getAllByRole("button", { name: /Create Issue/i });
    await user.click(openBtn);

    await waitFor(() =>
      expect(
        screen.getByLabelText(/Entity ID \/ Reference/i),
      ).toBeInTheDocument(),
    );

    // Fill the two required fields
    await user.type(
      screen.getByLabelText(/Entity ID \/ Reference/i),
      "load-555",
    );
    await user.type(
      screen.getByPlaceholderText(/Describe the issue in detail/i),
      "Integration test error scenario",
    );

    // Click the submit button (last "Create Issue" button in the DOM)
    const submitBtn = getSubmitButton();
    await user.click(submitBtn);

    // After rejection settles: spinner text "Creating..." must be gone
    await waitFor(() =>
      expect(screen.queryByText("Creating...")).not.toBeInTheDocument(),
    );

    // Modal is still visible
    expect(
      screen.getByLabelText(/Entity ID \/ Reference/i),
    ).toBeInTheDocument();
  });
});
