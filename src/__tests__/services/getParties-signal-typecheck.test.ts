/**
 * Type-level test: verifies that getParties accepts an optional AbortSignal.
 * This file is compiled by tsc; a type error here means R-P2-11 fails.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getParties } from "../../../services/networkService";

vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
  },
}));

describe("getParties signal type check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tests R-P2-11
  it("accepts an AbortSignal as the second argument (type + runtime check)", async () => {
    const controller = new AbortController();
    // This call must type-check: getParties(string, AbortSignal) -> Promise<NetworkParty[]>
    const result = await getParties("company-123", controller.signal);
    expect(Array.isArray(result)).toBe(true);
  });

  it("accepts no signal argument (optional parameter)", async () => {
    const result = await getParties("company-123");
    expect(Array.isArray(result)).toBe(true);
  });
});
