import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CommsOverlay } from "../../../components/CommsOverlay";
import type { WorkspaceSession, CallSession } from "../../../types";

/**
 * STORY-003 Phase 3 — CommsOverlay tel: link wiring.
 *
 * Tests R-P3-04: CommsOverlay.tsx renders a clickable <a href="tel:555-0100">
 *                link when the active call session contact has a phone number.
 *
 * Strategy: full-render with an activeCallSession that carries a contactPhone
 * field. The overlay must project that phone into an <a href="tel:..."> element.
 * A source-grep companion confirms the `tel:` protocol is wired into the JSX.
 */

const COMMS_PATH = resolve(__dirname, "../../../components/CommsOverlay.tsx");

const makeSession = (
  overrides: Partial<WorkspaceSession> = {},
): WorkspaceSession => ({
  primaryContext: {
    id: "load-1",
    type: "LOAD",
    label: "Load #LD-001",
    timestamp: new Date().toISOString(),
  },
  secondaryContexts: [],
  recentContexts: [],
  pinnedContexts: [],
  splitView: { enabled: false },
  ...overrides,
});

// Typed helper that produces a CallSession carrying an optional `contactPhone`
// field consumed by CommsOverlay. We cast through `unknown` because
// contactPhone is a local extension of the shared CallSession shape.
const makeCallSessionWithPhone = (phone: string | undefined): CallSession => {
  const base: CallSession = {
    id: "CALL-PHONE001",
    startTime: new Date().toISOString(),
    status: "ACTIVE",
    participants: [
      { id: "user-1", name: "Test Dispatcher", role: "DISPATCHER" },
    ],
    lastActivityAt: new Date().toISOString(),
    links: [],
  };
  return { ...base, contactPhone: phone } as unknown as CallSession;
};

const defaultProps = {
  session: makeSession(),
  activeCallSession: null as CallSession | null,
  setActiveCallSession: vi.fn(),
  onRecordAction: vi.fn().mockResolvedValue(undefined),
  openRecordWorkspace: vi.fn(),
  onNavigate: vi.fn(),
  overlayState: "floating" as const,
  setOverlayState: vi.fn(),
  user: { id: "user-1", name: "Test Dispatcher" },
  allLoads: [
    {
      id: "load-1",
      loadNumber: "LD-001",
      driverName: "John Driver",
      status: "in_transit",
      messages: [],
    },
  ],
};

describe("CommsOverlay tel: link rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tests R-P3-04
  it("renders <a href='tel:555-0100'> when the active call session has contactPhone='555-0100'", () => {
    const { container } = render(
      <CommsOverlay
        {...defaultProps}
        activeCallSession={makeCallSessionWithPhone("555-0100")}
      />,
    );

    const telLinks = container.querySelectorAll('a[href^="tel:"]');
    // Specific-value assertions: exactly one tel link, with the exact href.
    expect(telLinks.length).toBeGreaterThanOrEqual(1);
    const link = telLinks[0] as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("tel:555-0100");
    // And the link must be an anchor element (clickable by default).
    expect(link.tagName.toLowerCase()).toBe("a");
  });

  // Tests R-P3-04 — absence case: when no phone is attached, no tel link.
  it("renders no tel: link when the active call session has no contactPhone", () => {
    const { container } = render(
      <CommsOverlay
        {...defaultProps}
        activeCallSession={makeCallSessionWithPhone(undefined)}
      />,
    );

    const telLinks = container.querySelectorAll('a[href^="tel:"]');
    // Specific-value assertion: exactly zero tel: anchors.
    expect(telLinks.length).toBe(0);
  });

  // Tests R-P3-04 — absence case: idle overlay (no active call) renders no tel link.
  it("renders no tel: link when there is no active call session at all", () => {
    const { container } = render(
      <CommsOverlay {...defaultProps} activeCallSession={null} />,
    );

    const telLinks = container.querySelectorAll('a[href^="tel:"]');
    expect(telLinks.length).toBe(0);
  });
});

describe("CommsOverlay tel: link — source-grep safety net", () => {
  // Tests R-P3-04 — the source must contain an href using the tel: protocol,
  // interpolating a phone field from the active call session.
  it("wires a tel: href into the JSX", () => {
    const src = readFileSync(COMMS_PATH, "utf-8");
    // Accept either template-literal (`tel:${...}`) or bracketed attribute form.
    const telHref =
      /href=\{?`tel:\$\{[^}]+\}`\}?|href="tel:[^"]+"|href=\{"tel:[^"]+"\}/;
    expect(src).toMatch(telHref);
  });
});
