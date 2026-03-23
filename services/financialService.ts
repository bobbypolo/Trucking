import { API_URL as API_BASE } from './config';
import {
    GLAccount, JournalEntry, ARInvoice, APBill, DriverSettlement, FuelEntry,
    IFTASummary, MileageEntry, VaultDoc, IFTATripEvidence, IFTATripAudit
} from '../types';

export const getGLAccounts = async (
  signal?: AbortSignal,
): Promise<GLAccount[]> => {
  const res = await fetch(`${API_BASE}/accounting/accounts`, {
    ...(signal ? { signal } : {}),
  });
  return res.json();
};

export const getLoadProfitLoss = async (loadId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/accounting/load-pl/${loadId}`);
    return res.json();
};

export const createARInvoice = async (invoice: Partial<ARInvoice>): Promise<ARInvoice> => {
    const res = await fetch(`${API_BASE}/accounting/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice)
    });
    return res.json();
};

export const createAPBill = async (bill: Partial<APBill>): Promise<APBill> => {
    const res = await fetch(`${API_BASE}/accounting/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bill)
    });
    return res.json();
};

export const createJournalEntry = async (entry: Partial<JournalEntry>): Promise<JournalEntry> => {
    const res = await fetch(`${API_BASE}/accounting/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
    });
    return res.json();
};

export const getSettlements = async (
  driverId?: string,
  signal?: AbortSignal,
): Promise<DriverSettlement[]> => {
  const url = driverId
    ? `${API_BASE}/accounting/settlements?driverId=${driverId}`
    : `${API_BASE}/accounting/settlements`;
  const res = await fetch(url, { ...(signal ? { signal } : {}) });
  return res.json();
};

export const createSettlement = async (settlement: Partial<DriverSettlement>): Promise<DriverSettlement> => {
    const res = await fetch(`${API_BASE}/accounting/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settlement)
    });
    return res.json();
};

export const importFuelPurchases = async (purchases: FuelEntry[]): Promise<void> => {
    await fetch(`${API_BASE}/accounting/fuel/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchases)
    });
};
export const getInvoices = async (
  signal?: AbortSignal,
): Promise<ARInvoice[]> => {
  const res = await fetch(`${API_BASE}/accounting/invoices`, {
    ...(signal ? { signal } : {}),
  });
  return res.json();
};

export const getBills = async (
  signal?: AbortSignal,
): Promise<APBill[]> => {
  const res = await fetch(`${API_BASE}/accounting/bills`, {
    ...(signal ? { signal } : {}),
  });
  return res.json();
};

export const getVaultDocs = async (filters: any): Promise<any[]> => {
    const query = new URLSearchParams(filters).toString();
    const res = await fetch(`${API_BASE}/accounting/docs?${query}`);
    return res.json();
};

export const uploadToVault = async (doc: Partial<VaultDoc>): Promise<void> => {
    await fetch(`${API_BASE}/accounting/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
    });
};

export const updateDocStatus = async (id: string, status: string, isLocked: boolean, updatedBy?: string): Promise<void> => {
    await fetch(`${API_BASE}/accounting/docs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, is_locked: isLocked, updatedBy })
    });
};

export const getIFTASummary = async (quarter?: number, year?: number): Promise<IFTASummary> => {
    const query = new URLSearchParams({
        quarter: (quarter || 0).toString(),
        year: (year || 0).toString()
    }).toString();
    const res = await fetch(`${API_BASE}/accounting/ifta-summary?${query}`);
    return res.json();
};

export const getMileageEntries = async (truckId?: string): Promise<MileageEntry[]> => {
    const url = truckId ? `${API_BASE}/accounting/mileage?truckId=${truckId}` : `${API_BASE}/accounting/mileage`;
    const res = await fetch(url);
    return res.json();
};

export const saveMileageEntry = async (entry: Partial<MileageEntry>): Promise<void> => {
    await fetch(`${API_BASE}/accounting/mileage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
    });
};

export const postIFTAToLedger = async (data: { quarter: number, year: number, netTaxDue: number }): Promise<void> => {
    await fetch(`${API_BASE}/accounting/ifta-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
};

export const getIFTAEvidence = async (loadId: string): Promise<IFTATripEvidence[]> => {
    const res = await fetch(`${API_BASE}/accounting/ifta-evidence/${loadId}`);
    return res.json();
};

export const analyzeIFTA = async (data: { pings: any[], mode: 'GPS' | 'ROUTES' }): Promise<any> => {
    const res = await fetch(`${API_BASE}/accounting/ifta-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
};

export const lockIFTATrip = async (audit: Partial<IFTATripAudit>): Promise<void> => {
    await fetch(`${API_BASE}/accounting/ifta-audit-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(audit)
    });
};
