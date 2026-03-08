import { describe, it, expect } from "vitest";
import {
  createJournalEntrySchema,
  createInvoiceSchema,
  createBillSchema,
  createDocumentVaultSchema,
  batchImportSchema,
} from "../../schemas/accounting";

// Tests R-P2-01, R-P2-02, R-P2-03

describe("R-P2-01, R-P2-03: Accounting Zod Schemas", () => {
  // ---------------------------------------------------------------------------
  // createJournalEntrySchema
  // ---------------------------------------------------------------------------
  describe("createJournalEntrySchema", () => {
    const validEntry = {
      entryDate: "2026-03-01",
      description: "Monthly depreciation entry",
      lines: [
        { glAccountId: "GL-1500", debit: 1000 },
        { glAccountId: "GL-5000", credit: 1000 },
      ],
    };

    it("AC1: accepts a valid journal entry payload", () => {
      const result = createJournalEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
    });

    it("AC3: rejects missing entryDate (required)", () => {
      const invalid = {
        description: "Entry without date",
        lines: [{ glAccountId: "GL-1500", debit: 500 }],
      };
      const result = createJournalEntrySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects missing description (required)", () => {
      const invalid = {
        entryDate: "2026-03-01",
        lines: [{ glAccountId: "GL-1500", debit: 500 }],
      };
      const result = createJournalEntrySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects missing lines (required, min 1)", () => {
      const invalid = {
        entryDate: "2026-03-01",
        description: "No lines",
        lines: [],
      };
      const result = createJournalEntrySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects line missing glAccountId (required in line)", () => {
      const invalid = {
        entryDate: "2026-03-01",
        description: "Bad line",
        lines: [{ debit: 500 }],
      };
      const result = createJournalEntrySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // createInvoiceSchema
  // ---------------------------------------------------------------------------
  describe("createInvoiceSchema", () => {
    const validInvoice = {
      customerId: "cust-001",
      invoiceNumber: "INV-1000",
      invoiceDate: "2026-03-01",
      totalAmount: 5000,
    };

    it("AC1: accepts a valid invoice payload", () => {
      const result = createInvoiceSchema.safeParse(validInvoice);
      expect(result.success).toBe(true);
    });

    it("AC1: accepts invoice with optional lines array", () => {
      const withLines = {
        ...validInvoice,
        lines: [
          {
            description: "Freight charge",
            amount: 5000,
            quantity: 1,
            unitPrice: 5000,
            totalAmount: 5000,
          },
        ],
      };
      const result = createInvoiceSchema.safeParse(withLines);
      expect(result.success).toBe(true);
    });

    it("AC3: rejects missing customerId (required)", () => {
      const invalid = {
        invoiceNumber: "INV-1000",
        invoiceDate: "2026-03-01",
        totalAmount: 5000,
      };
      const result = createInvoiceSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects missing invoiceNumber (required)", () => {
      const invalid = {
        customerId: "cust-001",
        invoiceDate: "2026-03-01",
        totalAmount: 5000,
      };
      const result = createInvoiceSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects missing invoiceDate (required)", () => {
      const invalid = {
        customerId: "cust-001",
        invoiceNumber: "INV-1000",
        totalAmount: 5000,
      };
      const result = createInvoiceSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects non-numeric totalAmount", () => {
      const invalid = {
        customerId: "cust-001",
        invoiceNumber: "INV-1000",
        invoiceDate: "2026-03-01",
        totalAmount: "five thousand",
      };
      const result = createInvoiceSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // createBillSchema
  // ---------------------------------------------------------------------------
  describe("createBillSchema", () => {
    const validBill = {
      vendorId: "vend-001",
      billNumber: "BILL-500",
      billDate: "2026-03-01",
      totalAmount: 2500,
    };

    it("AC1: accepts a valid bill payload", () => {
      const result = createBillSchema.safeParse(validBill);
      expect(result.success).toBe(true);
    });

    it("AC1: accepts bill with optional lines", () => {
      const withLines = {
        ...validBill,
        lines: [
          { description: "Fuel expense", amount: 2500, glAccountId: "GL-6100" },
        ],
      };
      const result = createBillSchema.safeParse(withLines);
      expect(result.success).toBe(true);
    });

    it("AC3: rejects missing vendorId (required)", () => {
      const invalid = {
        billNumber: "BILL-500",
        billDate: "2026-03-01",
        totalAmount: 2500,
      };
      const result = createBillSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects missing billNumber (required)", () => {
      const invalid = {
        vendorId: "vend-001",
        billDate: "2026-03-01",
        totalAmount: 2500,
      };
      const result = createBillSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects missing billDate (required)", () => {
      const invalid = {
        vendorId: "vend-001",
        billNumber: "BILL-500",
        totalAmount: 2500,
      };
      const result = createBillSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects non-numeric totalAmount", () => {
      const invalid = {
        vendorId: "vend-001",
        billNumber: "BILL-500",
        billDate: "2026-03-01",
        totalAmount: "twenty-five hundred",
      };
      const result = createBillSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // createDocumentVaultSchema
  // ---------------------------------------------------------------------------
  describe("createDocumentVaultSchema", () => {
    const validDoc = {
      type: "BOL",
      url: "https://storage.example.com/bol-001.pdf",
      filename: "bol-001.pdf",
    };

    it("AC1: accepts a valid document vault payload", () => {
      const result = createDocumentVaultSchema.safeParse(validDoc);
      expect(result.success).toBe(true);
    });

    it("AC1: accepts document with all optional fields", () => {
      const full = {
        ...validDoc,
        loadId: "load-001",
        driverId: "drv-001",
        truckId: "trk-001",
        amount: 5000,
        date: "2026-03-01",
        stateCode: "TX",
        status: "Verified",
      };
      const result = createDocumentVaultSchema.safeParse(full);
      expect(result.success).toBe(true);
    });

    it("AC3: rejects missing type (required)", () => {
      const invalid = {
        url: "https://storage.example.com/bol-001.pdf",
        filename: "bol-001.pdf",
      };
      const result = createDocumentVaultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects missing url (required)", () => {
      const invalid = {
        type: "BOL",
        filename: "bol-001.pdf",
      };
      const result = createDocumentVaultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects missing filename (required)", () => {
      const invalid = {
        type: "BOL",
        url: "https://storage.example.com/bol-001.pdf",
      };
      const result = createDocumentVaultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects empty string for type (min 1)", () => {
      const invalid = {
        type: "",
        url: "https://storage.example.com/bol-001.pdf",
        filename: "bol-001.pdf",
      };
      const result = createDocumentVaultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // batchImportSchema
  // ---------------------------------------------------------------------------
  describe("batchImportSchema", () => {
    const validBatch = {
      type: "Fuel",
      data: [
        { stateCode: "TX", gallons: 100, totalCost: 350, date: "2026-03-01" },
      ],
    };

    it("AC1: accepts a valid Fuel batch import payload", () => {
      const result = batchImportSchema.safeParse(validBatch);
      expect(result.success).toBe(true);
    });

    it("AC1: accepts Bills type", () => {
      const billsBatch = {
        type: "Bills",
        data: [
          { billNumber: "B-001", totalAmount: 500, billDate: "2026-03-01" },
        ],
      };
      const result = batchImportSchema.safeParse(billsBatch);
      expect(result.success).toBe(true);
    });

    it("AC1: accepts Invoices type", () => {
      const invoicesBatch = {
        type: "Invoices",
        data: [{ invoiceNumber: "I-001", totalAmount: 1000 }],
      };
      const result = batchImportSchema.safeParse(invoicesBatch);
      expect(result.success).toBe(true);
    });

    it("AC1: accepts Settlements type", () => {
      const settlementsBatch = {
        type: "Settlements",
        data: [{ driverId: "drv-001", netPay: 3000 }],
      };
      const result = batchImportSchema.safeParse(settlementsBatch);
      expect(result.success).toBe(true);
    });

    it("AC3: rejects missing type (required)", () => {
      const invalid = { data: [{ stateCode: "TX" }] };
      const result = batchImportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects invalid type value (not in enum)", () => {
      const invalid = { type: "Expenses", data: [{ amount: 100 }] };
      const result = batchImportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects missing data (required)", () => {
      const invalid = { type: "Fuel" };
      const result = batchImportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC3: rejects empty data array (min 1)", () => {
      const invalid = { type: "Fuel", data: [] };
      const result = batchImportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
