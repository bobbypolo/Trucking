import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P7-02, R-P7-04
//
// Verifies that after a DISCREPANCY_FLAGGED event is inserted by
// compareWeights(), deliverNotification is called with channel "email" and
// a subject containing "Discrepancy". Also verifies that a rejecting
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

import { compareWeights } from "../../services/discrepancyPipeline";

/**
 * Builds a mock DB that:
 *  - Accepts UPDATE loads / UPDATE customers / INSERT load_events as no-ops
 *  - Returns a broker email when queried
 */
function buildMockDb(
  opts: { brokerEmail?: string | null; loadNumber?: string } = {},
) {
  const brokerEmail =
    opts.brokerEmail === undefined ? "broker@example.com" : opts.brokerEmail;
  const loadNumber = opts.loadNumber ?? "L-100";

  const query = vi.fn(async (sql: string) => {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.includes("FROM loads") && normalized.includes("customers")) {
      return [[{ email: brokerEmail, load_number: loadNumber }], undefined];
    }
    return [[], undefined];
  });

  return { query } as unknown as { query: typeof query };
}

describe("R-P7-02: Discrepancy notification triggered on DISCREPANCY_FLAGGED", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeliverNotification.mockResolvedValue({ status: "SENT" });
  });

  // Tests R-P7-02
  it("calls deliverNotification with channel 'email' and subject containing 'Discrepancy' when variance exceeds threshold", async () => {
    const db = buildMockDb();

    // 10% variance exceeds 5% threshold → flagged
    const result = await compareWeights(
      // @ts-expect-error — mock DB shape
      db,
      "load-1",
      "company-1",
      40_000, // quoted
      44_000, // scanned (10% over)
      "Steel Coils",
      "customer-1",
    );

    expect(result.flagged).toBe(true);
    expect(mockDeliverNotification).toHaveBeenCalledTimes(1);

    const callArg = mockDeliverNotification.mock.calls[0][0];
    expect(callArg.channel).toBe("email");
    expect(typeof callArg.subject).toBe("string");
    expect(callArg.subject).toContain("Discrepancy");
  });

  // Tests R-P7-02
  it("does NOT call deliverNotification when variance is below threshold", async () => {
    const db = buildMockDb();

    // 2% variance below 5% threshold → not flagged
    const result = await compareWeights(
      // @ts-expect-error — mock DB shape
      db,
      "load-2",
      "company-1",
      40_000,
      40_800, // 2% over
      "Steel Coils",
      "customer-1",
    );

    expect(result.flagged).toBe(false);
    expect(mockDeliverNotification).not.toHaveBeenCalled();
  });

  // Tests R-P7-02
  it("does NOT call deliverNotification when quotedWeight is zero", async () => {
    const db = buildMockDb();

    const result = await compareWeights(
      // @ts-expect-error — mock DB shape
      db,
      "load-3",
      "company-1",
      0, // no quoted weight on record
      40_000,
      "Steel Coils",
      "customer-1",
    );

    expect(result.flagged).toBe(false);
    expect(mockDeliverNotification).not.toHaveBeenCalled();
  });
});

describe("R-P7-04: Fire-and-forget — discrepancy notification failure does not break pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tests R-P7-04
  it("returns a valid flagged result even when deliverNotification rejects", async () => {
    mockDeliverNotification.mockRejectedValue(
      new Error("SMTP down — simulated failure"),
    );
    const db = buildMockDb();

    const result = await compareWeights(
      // @ts-expect-error — mock DB shape
      db,
      "load-4",
      "company-1",
      40_000,
      44_000, // flagged
      "Steel Coils",
      "customer-1",
    );

    expect(result.flagged).toBe(true);
    expect(result.discrepancyPct).toBeCloseTo(10, 0);
    expect(mockDeliverNotification).toHaveBeenCalledTimes(1);
  });

  // Tests R-P7-04
  it("still returns a valid result when broker email is missing (no recipients)", async () => {
    const db = buildMockDb({ brokerEmail: null });

    const result = await compareWeights(
      // @ts-expect-error — mock DB shape
      db,
      "load-5",
      "company-1",
      40_000,
      44_000,
      "Steel Coils",
      "customer-1",
    );

    expect(result.flagged).toBe(true);
    // With no broker email, deliverNotification is not called
    expect(mockDeliverNotification).not.toHaveBeenCalled();
  });
});
