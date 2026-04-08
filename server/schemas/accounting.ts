import { z } from "zod";

/**
 * Schema for journal entry lines — used within createJournalEntrySchema.
 */
const journalLineSchema = z.object({
  id: z.string().optional(),
  glAccountId: z.string().min(1),
  debit: z.number().min(0).optional().default(0),
  credit: z.number().min(0).optional().default(0),
  allocationType: z.string().optional(),
  allocationId: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Schema for POST /api/accounting/journal — creating a journal entry.
 * Matches the fields destructured in routes/accounting.ts journal POST handler.
 */
export const createJournalEntrySchema = z.object({
  id: z.string().optional(),
  entryDate: z.string().min(1),
  referenceNumber: z.string().optional(),
  description: z.string().min(1),
  sourceDocumentType: z.string().optional(),
  sourceDocumentId: z.string().optional(),
  createdBy: z.string().optional(),
  lines: z.array(journalLineSchema).min(1),
});

/**
 * Schema for invoice line items — used within createInvoiceSchema.
 */
const invoiceLineSchema = z.object({
  id: z.string().optional(),
  catalogItemId: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  totalAmount: z.number().optional(),
  glAccountId: z.string().optional(),
});

/**
 * Schema for POST /api/accounting/invoices — creating an AR invoice.
 * Matches the fields used in routes/accounting.ts invoices POST handler.
 */
export const createInvoiceSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1),
  loadId: z.string().optional(),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional(),
  status: z.string().optional(),
  totalAmount: z.number(),
  lines: z.array(invoiceLineSchema).optional(),
});

/**
 * Schema for AP bill line items — used within createBillSchema.
 */
const billLineSchema = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  amount: z.number(),
  glAccountId: z.string().optional(),
  allocationType: z.string().optional(),
  allocationId: z.string().optional(),
});

/**
 * Schema for POST /api/accounting/bills — creating an AP bill.
 * Matches the fields used in routes/accounting.ts bills POST handler.
 */
export const createBillSchema = z.object({
  id: z.string().optional(),
  vendorId: z.string().min(1),
  billNumber: z.string().min(1),
  billDate: z.string().min(1),
  dueDate: z.string().optional(),
  status: z.string().optional(),
  totalAmount: z.number(),
  lines: z.array(billLineSchema).optional(),
});

/**
 * Schema for POST /api/accounting/docs — archiving a document in the vault.
 * Matches the fields used in routes/accounting.ts docs POST handler.
 */
export const createDocumentVaultSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  url: z.string().min(1),
  filename: z.string().min(1),
  loadId: z.string().optional(),
  driverId: z.string().optional(),
  truckId: z.string().optional(),
  vendorId: z.string().optional(),
  customerId: z.string().optional(),
  amount: z.number().optional(),
  date: z.string().optional(),
  stateCode: z.string().optional(),
  status: z.string().optional(),
});

/**
 * Schema for POST /api/accounting/batch-import — bulk-importing financial records.
 * Matches the fields destructured in routes/accounting.ts batch-import POST handler.
 */
export const batchImportSchema = z.object({
  type: z.enum(["Fuel", "Bills", "Invoices", "Settlements"]),
  data: z.array(z.object({}).passthrough()).min(1),
});

/**
 * Schema for PATCH /api/accounting/settlements/batch — batch-updating settlement status.
 * Used by the Finalize All button in Settlements component.
 */
export const batchUpdateSettlementsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  status: z.enum(["Draft", "Calculated", "Approved", "Paid", "Finalized"]),
});

/**
 * Schema for POST /api/accounting/fuel-receipt — creating a fuel entry from scanned receipt.
 */
export const fuelReceiptSchema = z.object({
  vendorName: z.string().min(1),
  gallons: z.number().positive(),
  pricePerGallon: z.number().min(0),
  totalCost: z.number().positive(),
  transactionDate: z.string().min(1),
  stateCode: z.string().length(2),
  truckId: z.string().optional(),
  cardNumber: z.string().optional(),
});

/**
 * Schema for POST /api/accounting/ifta-analyze — GPS-based IFTA jurisdiction analysis.
 */
export const iftaAnalyzeSchema = z.object({
  pings: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    state_code: z.string().length(2).optional(),
    stateCode: z.string().length(2).optional(),
  })).min(1).max(10_000),
  mode: z.enum(["GPS"]),
});

/**
 * Schema for POST /api/accounting/ifta-audit-lock — locking a trip for IFTA audit.
 */
export const iftaAuditLockSchema = z.object({
  truckId: z.string().optional(),
  loadId: z.string().optional(),
  tripDate: z.string().min(1),
  startOdometer: z.number().min(0).optional(),
  endOdometer: z.number().min(0).optional(),
  totalMiles: z.number().min(0),
  method: z.enum(["ACTUAL_GPS", "ROUTES", "MANUAL", "ELD_ODOMETER"]),
  confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
  jurisdictionMiles: z.record(z.string(), z.number().min(0)),
  attestedBy: z.string().optional(),
});

/**
 * Schema for POST /api/accounting/mileage — logging jurisdiction mileage.
 */
export const mileageSchema = z.object({
  truckId: z.string().optional(),
  loadId: z.string().optional(),
  date: z.string().min(1),
  stateCode: z.string().length(2),
  miles: z.number().min(0),
  source: z.enum(["ELD", "Manual", "GPS", "ROUTES", "Import"]).optional().default("Manual"),
});

/**
 * Schema for POST /api/accounting/ifta-post — posting IFTA tax liability to the journal.
 */
export const iftaPostSchema = z.object({
  quarter: z.union([z.number().int().min(1).max(4), z.string()]),
  year: z.union([z.number().int(), z.string()]),
  netTaxDue: z.number().min(0),
});

/**
 * Schema for POST /api/accounting/adjustments — creating an adjustment entry.
 */
export const adjustmentSchema = z.object({
  parentEntityType: z.string().min(1),
  parentEntityId: z.string().min(1),
  reasonCode: z.string().optional(),
  description: z.string().optional(),
  amountAdjustment: z.number(),
  createdBy: z.string().optional(),
});
