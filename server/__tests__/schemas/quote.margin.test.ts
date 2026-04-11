/**
 * Tests R-P8-03, R-P8-06: Quote schema margin field validation
 *
 * Validates `createQuoteSchema` and `updateQuoteSchema`:
 *  - Accept 5 new numeric margin fields
 *  - Reject non-numeric values with Zod validation error
 */
import { describe, it, expect } from "vitest";
import { createQuoteSchema, updateQuoteSchema } from "../../schemas/quote";

describe("Quote schema — margin fields (R-P8-03, R-P8-06)", () => {
  // ── R-P8-03: createQuoteSchema accepts the 5 new numeric fields ─────

  it("Tests R-P8-03 — createQuoteSchema accepts margin as a number", () => {
    const result = createQuoteSchema.parse({ margin: 15.5 });
    expect(result.margin).toBe(15.5);
  });

  it("Tests R-P8-03 — createQuoteSchema accepts discount as a number", () => {
    const result = createQuoteSchema.parse({ discount: 7.25 });
    expect(result.discount).toBe(7.25);
  });

  it("Tests R-P8-03 — createQuoteSchema accepts commission as a number", () => {
    const result = createQuoteSchema.parse({ commission: 3.75 });
    expect(result.commission).toBe(3.75);
  });

  it("Tests R-P8-03 — createQuoteSchema accepts estimated_driver_pay as a number", () => {
    const result = createQuoteSchema.parse({ estimated_driver_pay: 1250.5 });
    expect(result.estimated_driver_pay).toBe(1250.5);
  });

  it("Tests R-P8-03 — createQuoteSchema accepts company_cost_factor as a number", () => {
    const result = createQuoteSchema.parse({ company_cost_factor: 52.5 });
    expect(result.company_cost_factor).toBe(52.5);
  });

  it("Tests R-P8-03 — createQuoteSchema accepts all 5 margin fields together", () => {
    const input = {
      margin: 15,
      discount: 5,
      commission: 3,
      estimated_driver_pay: 1000,
      company_cost_factor: 50,
    };
    const result = createQuoteSchema.parse(input);
    expect(result.margin).toBe(15);
    expect(result.discount).toBe(5);
    expect(result.commission).toBe(3);
    expect(result.estimated_driver_pay).toBe(1000);
    expect(result.company_cost_factor).toBe(50);
  });

  // ── R-P8-03: updateQuoteSchema accepts the 5 new numeric fields ─────

  it("Tests R-P8-03 — updateQuoteSchema accepts margin as a number", () => {
    const result = updateQuoteSchema.parse({ margin: 12.75 });
    expect(result.margin).toBe(12.75);
  });

  it("Tests R-P8-03 — updateQuoteSchema accepts all 5 margin fields together", () => {
    const input = {
      margin: 20,
      discount: 4,
      commission: 2,
      estimated_driver_pay: 900,
      company_cost_factor: 55,
    };
    const result = updateQuoteSchema.parse(input);
    expect(result.margin).toBe(20);
    expect(result.discount).toBe(4);
    expect(result.commission).toBe(2);
    expect(result.estimated_driver_pay).toBe(900);
    expect(result.company_cost_factor).toBe(55);
  });

  // ── R-P8-06: Invalid margin value rejected with Zod error ───────────

  it("Tests R-P8-06 — createQuoteSchema rejects margin with invalid string value", () => {
    expect(() => createQuoteSchema.parse({ margin: "invalid" })).toThrow();
  });

  it("Tests R-P8-06 — createQuoteSchema rejects discount with non-numeric string", () => {
    expect(() => createQuoteSchema.parse({ discount: "abc" })).toThrow();
  });

  it("Tests R-P8-06 — createQuoteSchema rejects commission with boolean value", () => {
    expect(() => createQuoteSchema.parse({ commission: true })).toThrow();
  });

  it("Tests R-P8-06 — createQuoteSchema rejects estimated_driver_pay with object value", () => {
    expect(() =>
      createQuoteSchema.parse({ estimated_driver_pay: {} }),
    ).toThrow();
  });

  it("Tests R-P8-06 — updateQuoteSchema rejects company_cost_factor with non-number string", () => {
    expect(() =>
      updateQuoteSchema.parse({ company_cost_factor: "not-a-number" }),
    ).toThrow();
  });

  it("Tests R-P8-06 — Zod error for invalid margin contains 'margin' path", () => {
    const result = createQuoteSchema.safeParse({ margin: "invalid" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("margin");
    }
  });
});
