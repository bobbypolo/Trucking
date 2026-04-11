import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LoadList } from "../../../components/LoadList";
import { LoadData, LOAD_STATUS } from "../../../types";

// Mock services used by LoadList
vi.mock("../../../services/storageService", () => ({
  generateInvoicePDF: vi.fn(),
  saveLoad: vi.fn(),
}));

vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn().mockReturnValue(null),
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
  onUserChange: vi.fn(() => () => {}),
}));

/**
 * STORY-003 Phase 3 — LoadList Call button phone-dial behavior.
 *
 * Tests R-P3-01: Call button calls window.open("tel:555-0100") when
 *                load.customerContact.phone is "555-0100".
 * Tests R-P3-02: Call button falls back to onOpenHub('messaging', true)
 *                when load.customerContact.phone is undefined.
 * Tests R-P3-03: Call button shows tooltip with phone number "555-0100"
 *                on hover when phone is available.
 *
 * Strategy: full-render with mocked window.open — this matches the
 * pattern established in LoadList.test.tsx and verifies *behavior*
 * (the actual click handler fires the correct side-effect), not
 * source-grep mechanics.
 */

const LOADLIST_PATH = resolve(__dirname, "../../../components/LoadList.tsx");

const baseLoad: LoadData = {
  id: "load-1",
  companyId: "company-1",
  driverId: "driver-1",
  loadNumber: "LN-CALL-001",
  status: LOAD_STATUS.Planned,
  carrierRate: 1500,
  driverPay: 900,
  pickupDate: "2025-12-01",
  pickup: { city: "Chicago", state: "IL" },
  dropoff: { city: "Dallas", state: "TX" },
};

const loadWithPhone: LoadData = {
  ...baseLoad,
  customerContact: {
    name: "Sarah Miller",
    phone: "555-0100",
  },
};

const loadWithoutPhone: LoadData = {
  ...baseLoad,
  id: "load-2",
  loadNumber: "LN-CALL-002",
  // customerContact intentionally omitted
};

function getCallButton() {
  // The Call button is the only button whose accessible text starts with "Call".
  const buttons = screen.getAllByRole("button");
  const call = buttons.find((b) => /^\s*Call\s*$/.test(b.textContent || ""));
  if (!call) {
    throw new Error(
      `No Call button found. Buttons: ${buttons.map((b) => b.textContent).join(" | ")}`,
    );
  }
  return call;
}

describe("LoadList Call button — tel: dialer wiring", () => {
  let originalOpen: typeof window.open;
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    originalOpen = window.open;
    openSpy = vi.fn();
    // @ts-expect-error — test-time override
    window.open = openSpy;
  });

  afterEach(() => {
    window.open = originalOpen;
  });

  // Tests R-P3-01
  it("calls window.open('tel:555-0100') when load.customerContact.phone is '555-0100'", () => {
    const onOpenHub = vi.fn();
    render(
      <LoadList
        loads={[loadWithPhone]}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenHub={onOpenHub}
      />,
    );

    const callBtn = getCallButton();
    fireEvent.click(callBtn);

    // Specific-value assertion: the exact tel: URL must be opened.
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith("tel:555-0100");
    // And the messaging fallback MUST NOT be invoked.
    expect(onOpenHub).not.toHaveBeenCalled();
  });

  // Tests R-P3-02
  it("falls back to onOpenHub('messaging', true) when load.customerContact.phone is undefined", () => {
    const onOpenHub = vi.fn();
    render(
      <LoadList
        loads={[loadWithoutPhone]}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenHub={onOpenHub}
      />,
    );

    const callBtn = getCallButton();
    fireEvent.click(callBtn);

    // Specific-value assertion: exact args to fallback.
    expect(onOpenHub).toHaveBeenCalledTimes(1);
    expect(onOpenHub).toHaveBeenCalledWith("messaging", true);
    // And window.open MUST NOT be invoked for tel dialer.
    expect(openSpy).not.toHaveBeenCalled();
  });

  // Tests R-P3-03
  it("shows a tooltip with phone number '555-0100' via the title attribute when phone is available", () => {
    render(
      <LoadList
        loads={[loadWithPhone]}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenHub={vi.fn()}
      />,
    );

    const callBtn = getCallButton();
    // The title attribute *must contain* the phone number so it shows on hover.
    const title = callBtn.getAttribute("title");
    expect(title).not.toBeNull();
    expect(title).toContain("555-0100");
  });

  // Tests R-P3-03 — absence-case companion: without phone, title must not
  // claim a phone number is present (prevents accidental tooltip regressions).
  it("does not claim a phone number in the tooltip when phone is undefined", () => {
    render(
      <LoadList
        loads={[loadWithoutPhone]}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenHub={vi.fn()}
      />,
    );

    const callBtn = getCallButton();
    const title = callBtn.getAttribute("title") || "";
    expect(title).not.toContain("555-0100");
  });
});

describe("LoadList Call button — source-grep safety net", () => {
  // Tests R-P3-01 — belt-and-suspenders: the source must reference the
  // tel: protocol via window.open for the Call button path.
  it("references window.open with tel: protocol for the Call button", () => {
    const src = readFileSync(LOADLIST_PATH, "utf-8");
    expect(src).toMatch(
      /window\.open\(\s*`tel:\$\{[^}]+\}`\s*\)|window\.open\(\s*["']tel:[^"']+["']\s*\)/,
    );
  });

  // Tests R-P3-02 — source must still contain the onOpenHub('messaging', true)
  // fallback call so the messaging fallback path is intact.
  it("retains onOpenHub('messaging', true) fallback path in source", () => {
    const src = readFileSync(LOADLIST_PATH, "utf-8");
    expect(src).toMatch(/onOpenHub\?\.\(\s*["']messaging["']\s*,\s*true\s*\)/);
  });
});
