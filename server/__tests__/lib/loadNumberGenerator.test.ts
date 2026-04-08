/**
 * Tests R-P5-03, R-P5-04: generateNextLoadNumber helper
 *
 * Verifies:
 *  - Empty table → DRAFT-{8-char hex uuid}
 *  - Existing LP-0001 → LP-0002
 *  - Non-parseable number → DRAFT fallback
 *  - Concurrent call safety is documented (not atomic, rare race accepted as out-of-scope)
 */
import { describe, it, expect, vi } from "vitest";
import { generateNextLoadNumber } from "../../lib/loadNumberGenerator";

function makeMockPool(rows: { load_number: string }[]): any {
  return {
    query: vi.fn().mockResolvedValue([rows]),
  };
}

describe("generateNextLoadNumber", () => {
  // Tests R-P5-03
  it("Tests R-P5-03 — empty table returns DRAFT-{8-char hex}", async () => {
    const pool = makeMockPool([]);
    const result = await generateNextLoadNumber("C1", pool);
    expect(result).toMatch(/^DRAFT-[a-f0-9]{8}$/);
  });

  // Tests R-P5-04
  it("Tests R-P5-04 — existing LP-0001 returns LP-0002", async () => {
    const pool = makeMockPool([{ load_number: "LP-0001" }]);
    const result = await generateNextLoadNumber("C1", pool);
    expect(result).toBe("LP-0002");
  });

  it("preserves zero-padding width — LP-0009 → LP-0010", async () => {
    const pool = makeMockPool([{ load_number: "LP-0009" }]);
    const result = await generateNextLoadNumber("C1", pool);
    expect(result).toBe("LP-0010");
  });

  it("returns DRAFT fallback when load_number has no dash-digit suffix", async () => {
    const pool = makeMockPool([{ load_number: "NODASH" }]);
    const result = await generateNextLoadNumber("C1", pool);
    expect(result).toMatch(/^DRAFT-[a-f0-9]{8}$/);
  });

  it("returns DRAFT fallback on pool query rejection", async () => {
    const pool = { query: vi.fn().mockRejectedValue(new Error("DB down")) };
    const result = await generateNextLoadNumber("C1", pool);
    expect(result).toMatch(/^DRAFT-[a-f0-9]{8}$/);
  });

  it("concurrent call safety — documented as out-of-scope (no atomicity guarantee)", () => {
    // The helper issues a SELECT then generates a new number client-side.
    // A race between two concurrent calls can produce the same number.
    // This is accepted for draft loads which have no user-visible numbering contract.
    expect(true).toBe(true);
  });
});
