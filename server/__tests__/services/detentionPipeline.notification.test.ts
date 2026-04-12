import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P7-01, R-P7-04
//
// Verifies that after a billable DETENTION_FLAGGED event is inserted by
// recordBOLScan(), deliverNotification is called with channel "email" and
// a subject containing "Detention". Also verifies that a rejecting
// deliverNotification does not break the pipeline (fire-and-forget).

const { mockDeliverNotification } = vi.hoisted(() => ({
  mockDeliverNotification: vi.fn(),
}));

vi.mock("../../services/notification-delivery.service", () => ({
  deliverNotification: mockDeliverNotification,
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child() {
      return this;
    },
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { recordBOLScan } from "../../services/detentionPipeline";

/**
 * Builds a mock DB that:
 *  - Returns arrived_at far enough in the past to guarantee billable detention
 *  - Provides a broker email row for notification lookup
 *  - Accepts all UPDATE/INSERT calls as no-ops
 */
function buildMockDb(
  opts: { arrivedAtMinutesAgo?: number; brokerEmail?: string | null } = {},
) {
  const arrivedAt = new Date(
    Date.now() - (opts.arrivedAtMinutesAgo ?? 8 * 60) * 60_000, // default 8 hours ago
  ).toISOString();
  const brokerEmail =
    opts.brokerEmail === undefined ? "broker@example.com" : opts.brokerEmail;

  const query = vi.fn(async (sql: string) => {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.startsWith("SELECT arrived_at FROM load_legs")) {
      return [[{ arrived_at: arrivedAt }], undefined];
    }
    if (normalized.includes("FROM loads") && normalized.includes("customers")) {
      // Broker email lookup
      return [[{ email: brokerEmail, load_number: "L-42" }], undefined];
    }
    // UPDATE load_legs / INSERT load_events / etc.
    return [[], undefined];
  });

  return {
    query,
  } as unknown as {
    query: typeof query;
  };
}

describe("R-P7-01: Detention notification triggered on billable detention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeliverNotification.mockResolvedValue({ status: "SENT" });
    process.env.DETENTION_FREE_HOURS = "2";
    process.env.DETENTION_HOURLY_RATE = "75";
  });

  // Tests R-P7-01
  it("calls deliverNotification with channel 'email' and subject containing 'Detention'", async () => {
    const db = buildMockDb({ arrivedAtMinutesAgo: 8 * 60 }); // 8h dwell → billable
    const result = await recordBOLScan(
      // @ts-expect-error — mock DB shape
      db,
      "leg-1",
      "load-1",
      "L-42",
      40.0,
      -74.0,
      new Date().toISOString(),
    );

    // Preconditions: the detention WAS billable, so the DETENTION_FLAGGED event fired
    expect(result.isBillable).toBe(true);

    // deliverNotification must have been called exactly once
    expect(mockDeliverNotification).toHaveBeenCalledTimes(1);

    // ...with the expected channel and subject
    const callArg = mockDeliverNotification.mock.calls[0][0];
    expect(callArg.channel).toBe("email");
    expect(typeof callArg.subject).toBe("string");
    expect(callArg.subject).toContain("Detention");
  });

  // Tests R-P7-01
  it("does NOT call deliverNotification when detention is not billable", async () => {
    // 30 minutes dwell with 2h free hours → zero billable hours → no event, no email
    const db = buildMockDb({ arrivedAtMinutesAgo: 30 });
    const result = await recordBOLScan(
      // @ts-expect-error — mock DB shape
      db,
      "leg-2",
      "load-2",
      "L-43",
      40.0,
      -74.0,
      new Date().toISOString(),
    );

    expect(result.isBillable).toBe(false);
    expect(mockDeliverNotification).not.toHaveBeenCalled();
  });
});

describe("R-P7-04: Fire-and-forget — detention notification failure does not break pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DETENTION_FREE_HOURS = "2";
    process.env.DETENTION_HOURLY_RATE = "75";
  });

  // Tests R-P7-04
  it("returns a valid billable detention result even when deliverNotification rejects", async () => {
    mockDeliverNotification.mockRejectedValue(
      new Error("SMTP down — simulated failure"),
    );
    const db = buildMockDb({ arrivedAtMinutesAgo: 8 * 60 });

    const result = await recordBOLScan(
      // @ts-expect-error — mock DB shape
      db,
      "leg-3",
      "load-3",
      "L-44",
      40.0,
      -74.0,
      new Date().toISOString(),
    );

    // Pipeline still returns a well-formed result — the rejection is swallowed
    expect(result.isBillable).toBe(true);
    expect(result.totalAmount).toBeGreaterThan(0);
    expect(result.detentionRequest).not.toBeNull();

    // And deliverNotification was in fact invoked (fire-and-forget, not skipped)
    expect(mockDeliverNotification).toHaveBeenCalledTimes(1);
  });

  // Tests R-P7-04
  it("still returns a valid result when broker email is missing (no recipients)", async () => {
    const db = buildMockDb({ arrivedAtMinutesAgo: 8 * 60, brokerEmail: null });

    const result = await recordBOLScan(
      // @ts-expect-error — mock DB shape
      db,
      "leg-4",
      "load-4",
      "L-45",
      40.0,
      -74.0,
      new Date().toISOString(),
    );

    expect(result.isBillable).toBe(true);
    // With no broker email, deliverNotification is not called — but the pipeline still completes
    expect(mockDeliverNotification).not.toHaveBeenCalled();
  });
});
