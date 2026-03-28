import { describe, it, expect } from "vitest";
import {
  normalizeEntityClass,
  CANONICAL_ENTITY_CLASSES,
  ENTITY_CLASS_ALIAS_MAP,
  createPartySchema,
} from "../../schemas/parties";

describe("Party Schema — normalizeEntityClass", () => {
  describe("canonical entity classes", () => {
    it.each(["Customer", "Broker", "Vendor", "Facility", "Contractor"])(
      'returns "%s" unchanged for canonical class',
      (cls) => {
        const result = normalizeEntityClass(cls);
        expect(result).toBe(cls);
      },
    );
  });

  describe("alias mapping", () => {
    it('maps "Shipper" to "Customer"', () => {
      expect(normalizeEntityClass("Shipper")).toBe("Customer");
    });

    it('maps "Carrier" to "Contractor"', () => {
      expect(normalizeEntityClass("Carrier")).toBe("Contractor");
    });

    it('maps "Vendor_Service" to "Vendor"', () => {
      expect(normalizeEntityClass("Vendor_Service")).toBe("Vendor");
    });

    it('maps "Vendor_Equipment" to "Vendor"', () => {
      expect(normalizeEntityClass("Vendor_Equipment")).toBe("Vendor");
    });

    it('maps "Vendor_Product" to "Vendor"', () => {
      expect(normalizeEntityClass("Vendor_Product")).toBe("Vendor");
    });
  });

  describe("edge cases", () => {
    it("returns null for null input", () => {
      expect(normalizeEntityClass(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(normalizeEntityClass(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(normalizeEntityClass("")).toBeNull();
    });

    it("returns null for unrecognized type", () => {
      expect(normalizeEntityClass("FakeType")).toBeNull();
    });

    it("trims whitespace before matching", () => {
      expect(normalizeEntityClass("  Customer  ")).toBe("Customer");
    });

    it("is case-sensitive (lowercase rejected)", () => {
      expect(normalizeEntityClass("customer")).toBeNull();
    });
  });
});

describe("Party Schema — CANONICAL_ENTITY_CLASSES", () => {
  it("contains exactly 5 canonical classes", () => {
    expect(CANONICAL_ENTITY_CLASSES.length).toBe(5);
  });

  it("contains Customer, Broker, Vendor, Facility, Contractor", () => {
    expect([...CANONICAL_ENTITY_CLASSES].sort()).toEqual(
      ["Broker", "Contractor", "Customer", "Facility", "Vendor"],
    );
  });
});

describe("Party Schema — ENTITY_CLASS_ALIAS_MAP", () => {
  it("maps exactly 5 legacy types", () => {
    expect(Object.keys(ENTITY_CLASS_ALIAS_MAP).length).toBe(5);
  });

  it("all alias targets are canonical classes", () => {
    for (const target of Object.values(ENTITY_CLASS_ALIAS_MAP)) {
      expect(
        (CANONICAL_ENTITY_CLASSES as readonly string[]).includes(target),
      ).toBe(true);
    }
  });
});

describe("Party Schema — createPartySchema validation", () => {
  it("validates a minimal valid party", () => {
    const result = createPartySchema.safeParse({
      name: "Test Party",
      type: "Customer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createPartySchema.safeParse({
      type: "Customer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createPartySchema.safeParse({
      name: "",
      type: "Customer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing type", () => {
    const result = createPartySchema.safeParse({
      name: "Test Party",
    });
    expect(result.success).toBe(false);
  });

  it("passes through extra fields (entityClass, tags, vendorProfile)", () => {
    const input = {
      name: "Test Party",
      type: "Customer",
      entityClass: "Customer",
      tags: ["preferred"],
      vendorProfile: { cdlNumber: "CDL-123" },
    };
    const result = createPartySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entityClass).toBe("Customer");
      expect(result.data.tags).toEqual(["preferred"]);
    }
  });

  it("validates optional email format", () => {
    const valid = createPartySchema.safeParse({
      name: "Test",
      type: "Customer",
      email: "valid@test.com",
    });
    expect(valid.success).toBe(true);

    const invalid = createPartySchema.safeParse({
      name: "Test",
      type: "Customer",
      email: "not-an-email",
    });
    expect(invalid.success).toBe(false);
  });
});
