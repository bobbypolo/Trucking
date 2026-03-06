import { LoadData, User, DriverSettlement, APBill, ARInvoice } from '../types';

export interface QBSyncJournal {
    date: string;
    reference: string;
    description: string;
    lines: {
        accountName: string;
        accountNumber?: string;
        debit: number;
        credit: number;
        memo?: string;
    }[];
}

export const generateQBSummaryJournal = (
    dateRange: { start: string, end: string },
    loads: LoadData[],
    settlements: DriverSettlement[],
    bills: APBill[]
): QBSyncJournal[] => {
    const journals: QBSyncJournal[] = [];

    // 1. Sales Summary Journal (Accounts Receivable vs Revenue)
    const periodRevenue = loads
        .filter(l => l.status === 'Invoiced' || l.status === 'Settled')
        .reduce((sum, l) => sum + (l.carrierRate || 0), 0);

    if (periodRevenue > 0) {
        journals.push({
            date: dateRange.end,
            reference: `AR-SUM-${dateRange.end}`,
            description: `KCI Sales Summary: ${dateRange.start} to ${dateRange.end}`,
            lines: [
                { accountName: 'Accounts Receivable', debit: periodRevenue, credit: 0, memo: 'Total Fleet Revenue' },
                { accountName: 'Freight Revenue', debit: 0, credit: periodRevenue, memo: 'Invoiced Loads' }
            ]
        });
    }

    // 2. Payroll / Settlement Summary (Wages vs Liabilities)
    const totalNetPay = settlements.reduce((sum, s) => sum + s.netPay, 0);
    const totalDeductions = settlements.reduce((sum, s) => sum + s.totalDeductions, 0);
    const totalGross = settlements.reduce((sum, s) => sum + s.totalEarnings + s.totalReimbursements, 0);

    if (totalGross > 0) {
        journals.push({
            date: dateRange.end,
            reference: `PR-SUM-${dateRange.end}`,
            description: `KCI Settlement Summary: ${dateRange.start} to ${dateRange.end}`,
            lines: [
                { accountName: 'Driver Compensation (COGS)', debit: totalGross, credit: 0, memo: 'Earnings + Reimb' },
                { accountName: 'Payroll Liabilities (Net Pay)', debit: 0, credit: totalNetPay, memo: 'Due to Drivers' },
                { accountName: 'Operational Offsets (Deductions)', debit: 0, credit: totalDeductions, memo: 'Insurance/Fuel Recovery' }
            ]
        });
    }

    // 3. AP / Expenses Summary
    const totalBills = bills.reduce((sum, b) => sum + b.totalAmount, 0);
    if (totalBills > 0) {
        journals.push({
            date: dateRange.end,
            reference: `AP-SUM-${dateRange.end}`,
            description: `KCI Expenses Summary: ${dateRange.start} to ${dateRange.end}`,
            lines: [
                { accountName: 'Operational Expenses (Maintenance/Misc)', debit: totalBills, credit: 0 },
                { accountName: 'Accounts Payable', debit: 0, credit: totalBills }
            ]
        });
    }

    return journals;
};

export const exportToCSV = (journals: QBSyncJournal[]) => {
    const headers = ['Date', 'Reference', 'Description', 'Account', 'Debit', 'Credit', 'Memo'];
    const rows = journals.flatMap(j =>
        j.lines.map(l => [
            j.date,
            j.reference,
            j.description,
            l.accountName,
            l.debit.toFixed(2),
            l.credit.toFixed(2),
            l.memo || ''
        ].join(','))
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KCI_QB_Sync_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
};
