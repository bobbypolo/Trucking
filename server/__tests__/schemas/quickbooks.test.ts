import { describe, it, expect } from "vitest";
import { syncInvoiceSchema, syncBillSchema } from "../../schemas/quickbooks";

// Tests R-SEC-14
describe("R-SEC-14: quickbooks.ts exports syncInvoiceSchema and syncBillSchema", () => {
  it("syncInvoiceSchema accepts valid invoice payload", () => {
    const valid = {
      loadId: "load-001",
      totalAmount: 1500.0,
      customerId: "cust-001",
    };
    const result = syncInvoiceSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.loadId).toBe("load-001");
      expect(result.data.totalAmount).toBe(1500.0);
    }
  });

  it("syncInvoiceSchema rejects missing loadId", () => {
    const invalid = {
      totalAmount: 1500.0,
    };
    const result = syncInvoiceSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("loadId");
    }
  });

  it("syncInvoiceSchema rejects missing totalAmount", () => {
    const invalid = {
      loadId: "load-001",
    };
    const result = syncInvoiceSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("totalAmount");
    }
  });

  it("syncInvoiceSchema rejects negative totalAmount", () => {
    const invalid = {
      loadId: "load-001",
      totalAmount: -100,
    };
    const result = syncInvoiceSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("syncInvoiceSchema accepts optional lineItems", () => {
    const valid = {
      loadId: "load-001",
      totalAmount: 500,
      lineItems: [{ description: "Freight", amount: 500 }],
    };
    const result = syncInvoiceSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("syncBillSchema accepts valid bill payload", () => {
    const valid = {
      vendorId: "vendor-001",
      totalAmount: 800.0,
    };
    const result = syncBillSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vendorId).toBe("vendor-001");
      expect(result.data.totalAmount).toBe(800.0);
    }
  });

  it("syncBillSchema rejects missing vendorId", () => {
    const invalid = {
      totalAmount: 800.0,
    };
    const result = syncBillSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("vendorId");
    }
  });

  it("syncBillSchema rejects missing totalAmount", () => {
    const invalid = {
      vendorId: "vendor-001",
    };
    const result = syncBillSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("totalAmount");
    }
  });

  it("syncBillSchema rejects empty vendorId", () => {
    const invalid = {
      vendorId: "",
      totalAmount: 100,
    };
    const result = syncBillSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("both schemas are exported and are Zod schemas", () => {
    expect(syncInvoiceSchema.safeParse).toBeDefined();
    expect(syncBillSchema.safeParse).toBeDefined();
  });
});
