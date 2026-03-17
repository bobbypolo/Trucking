import { describe, it, expect } from "vitest";

import {
  generateQBSummaryJournal,
  exportToCSV,
} from "../../../services/syncService";
import type { LoadData, DriverSettlement, APBill } from "../../../types";

describe("syncService", () => {
  const makeDateRange = () => ({ start: "2026-03-01", end: "2026-03-31" });

  // ─── generateQBSummaryJournal ────────────────────────────────────────
  describe("generateQBSummaryJournal", () => {
    it("returns empty journals for empty input", () => {
      const journals = generateQBSummaryJournal(makeDateRange(), [], [], []);
      expect(journals).toEqual([]);
    });

    it("generates sales summary journal from delivered loads", () => {
      const loads = [
        { status: "delivered", carrierRate: 3000 } as any,
        { status: "completed", carrierRate: 2000 } as any,
        { status: "draft", carrierRate: 5000 } as any, // should be excluded
      ];

      const journals = generateQBSummaryJournal(
        makeDateRange(),
        loads,
        [],
        [],
      );
      expect(journals).toHaveLength(1);

      const salesJournal = journals[0];
      expect(salesJournal.reference).toContain("AR-SUM");
      expect(salesJournal.lines).toHaveLength(2);
      expect(salesJournal.lines[0].accountName).toBe("Accounts Receivable");
      expect(salesJournal.lines[0].debit).toBe(5000); // 3000 + 2000
      expect(salesJournal.lines[1].accountName).toBe("Freight Revenue");
      expect(salesJournal.lines[1].credit).toBe(5000);
    });

    it("generates settlement summary journal", () => {
      const settlements = [
        {
          netPay: 1500,
          totalDeductions: 200,
          totalEarnings: 1600,
          totalReimbursements: 100,
        } as DriverSettlement,
        {
          netPay: 1000,
          totalDeductions: 100,
          totalEarnings: 1050,
          totalReimbursements: 50,
        } as DriverSettlement,
      ];

      const journals = generateQBSummaryJournal(
        makeDateRange(),
        [],
        settlements,
        [],
      );
      expect(journals).toHaveLength(1);

      const payroll = journals[0];
      expect(payroll.reference).toContain("PR-SUM");
      expect(payroll.lines).toHaveLength(3);
      expect(payroll.lines[0].accountName).toBe("Driver Compensation (COGS)");
      expect(payroll.lines[0].debit).toBe(2800); // (1600+100) + (1050+50)
      expect(payroll.lines[1].accountName).toBe("Payroll Liabilities (Net Pay)");
      expect(payroll.lines[1].credit).toBe(2500); // 1500+1000
      expect(payroll.lines[2].accountName).toBe("Operational Offsets (Deductions)");
      expect(payroll.lines[2].credit).toBe(300); // 200+100
    });

    it("generates AP/expenses summary journal", () => {
      const bills = [
        { totalAmount: 500 } as APBill,
        { totalAmount: 300 } as APBill,
      ];

      const journals = generateQBSummaryJournal(
        makeDateRange(),
        [],
        [],
        bills,
      );
      expect(journals).toHaveLength(1);

      const ap = journals[0];
      expect(ap.reference).toContain("AP-SUM");
      expect(ap.lines[0].debit).toBe(800);
      expect(ap.lines[1].accountName).toBe("Accounts Payable");
      expect(ap.lines[1].credit).toBe(800);
    });

    it("generates all three journals when data is complete", () => {
      const loads = [{ status: "delivered", carrierRate: 5000 } as any];
      const settlements = [
        {
          netPay: 2000,
          totalDeductions: 100,
          totalEarnings: 2000,
          totalReimbursements: 100,
        } as DriverSettlement,
      ];
      const bills = [{ totalAmount: 300 } as APBill];

      const journals = generateQBSummaryJournal(
        makeDateRange(),
        loads,
        settlements,
        bills,
      );
      expect(journals).toHaveLength(3);
      expect(journals[0].reference).toContain("AR-SUM");
      expect(journals[1].reference).toContain("PR-SUM");
      expect(journals[2].reference).toContain("AP-SUM");
    });

    it("uses dateRange.end as journal date", () => {
      const loads = [{ status: "delivered", carrierRate: 1000 } as any];
      const range = { start: "2026-01-01", end: "2026-01-31" };

      const journals = generateQBSummaryJournal(range, loads, [], []);
      expect(journals[0].date).toBe("2026-01-31");
    });

    it("skips sales journal when no revenue loads", () => {
      const loads = [{ status: "draft", carrierRate: 5000 } as any];
      const journals = generateQBSummaryJournal(
        makeDateRange(),
        loads,
        [],
        [],
      );
      expect(journals).toHaveLength(0);
    });
  });

  // ─── exportToCSV ─────────────────────────────────────────────────────
  describe("exportToCSV", () => {
    it("creates a downloadable CSV (mocked DOM)", () => {
      // Mock DOM elements
      const clickFn = vi.fn();
      const mockElement = { href: "", download: "", click: clickFn };
      vi.spyOn(document, "createElement").mockReturnValue(mockElement as any);

      const mockUrl = "blob:http://test/fake";
      vi.spyOn(URL, "createObjectURL").mockReturnValue(mockUrl);

      const journals = [
        {
          date: "2026-03-31",
          reference: "AR-SUM-2026-03-31",
          description: "Test",
          lines: [
            {
              accountName: "Accounts Receivable",
              debit: 5000,
              credit: 0,
              memo: "Test Memo",
            },
          ],
        },
      ];

      exportToCSV(journals);

      expect(clickFn).toHaveBeenCalled();
      expect(mockElement.download).toContain("KCI_QB_Sync_");
      expect(mockElement.download).toContain(".csv");
    });
  });
});
