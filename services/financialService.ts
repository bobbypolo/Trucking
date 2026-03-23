import { api, ApiFetchOptions } from './api';
import {
    GLAccount, JournalEntry, ARInvoice, APBill, DriverSettlement, FuelEntry,
    IFTASummary, MileageEntry, VaultDoc, IFTATripEvidence, IFTATripAudit
} from '../types';

export const getGLAccounts = async (
  signal?: AbortSignal,
): Promise<GLAccount[]> => {
  return api.get('/accounting/accounts', { signal } as ApiFetchOptions);
};

export const getLoadProfitLoss = async (loadId: string): Promise<any> => {
    return api.get(`/accounting/load-pl/${loadId}`);
};

export const createARInvoice = async (invoice: Partial<ARInvoice>): Promise<ARInvoice> => {
    return api.post('/accounting/invoices', invoice);
};

export const createAPBill = async (bill: Partial<APBill>): Promise<APBill> => {
    return api.post('/accounting/bills', bill);
};

export const createJournalEntry = async (entry: Partial<JournalEntry>): Promise<JournalEntry> => {
    return api.post('/accounting/journal', entry);
};

export const getSettlements = async (
  driverId?: string,
  signal?: AbortSignal,
): Promise<DriverSettlement[]> => {
  const endpoint = driverId
    ? `/accounting/settlements?driverId=${driverId}`
    : '/accounting/settlements';
  return api.get(endpoint, { signal } as ApiFetchOptions);
};

export const createSettlement = async (settlement: Partial<DriverSettlement>): Promise<DriverSettlement> => {
    return api.post('/accounting/settlements', settlement);
};

export const importFuelPurchases = async (purchases: FuelEntry[]): Promise<void> => {
    await api.post('/accounting/fuel/import', purchases);
};

export const getInvoices = async (
  signal?: AbortSignal,
): Promise<ARInvoice[]> => {
  return api.get('/accounting/invoices', { signal } as ApiFetchOptions);
};

export const getBills = async (
  signal?: AbortSignal,
): Promise<APBill[]> => {
  return api.get('/accounting/bills', { signal } as ApiFetchOptions);
};

export const getVaultDocs = async (filters: any): Promise<any[]> => {
    const query = new URLSearchParams(filters).toString();
    return api.get(`/accounting/docs?${query}`);
};

export const uploadToVault = async (doc: Partial<VaultDoc>): Promise<void> => {
    await api.post('/accounting/docs', doc);
};

export const updateDocStatus = async (id: string, status: string, isLocked: boolean, updatedBy?: string): Promise<void> => {
    await api.patch(`/accounting/docs/${id}`, { status, is_locked: isLocked, updatedBy });
};

export const getIFTASummary = async (quarter?: number, year?: number): Promise<IFTASummary> => {
    const query = new URLSearchParams({
        quarter: (quarter || 0).toString(),
        year: (year || 0).toString()
    }).toString();
    return api.get(`/accounting/ifta-summary?${query}`);
};

export const getMileageEntries = async (truckId?: string): Promise<MileageEntry[]> => {
    const endpoint = truckId ? `/accounting/mileage?truckId=${truckId}` : '/accounting/mileage';
    return api.get(endpoint);
};

export const saveMileageEntry = async (entry: Partial<MileageEntry>): Promise<void> => {
    await api.post('/accounting/mileage', entry);
};

export const postIFTAToLedger = async (data: { quarter: number, year: number, netTaxDue: number }): Promise<void> => {
    await api.post('/accounting/ifta-post', data);
};

export const getIFTAEvidence = async (loadId: string): Promise<IFTATripEvidence[]> => {
    return api.get(`/accounting/ifta-evidence/${loadId}`);
};

export const analyzeIFTA = async (data: { pings: any[], mode: 'GPS' | 'ROUTES' }): Promise<any> => {
    return api.post('/accounting/ifta-analyze', data);
};

export const lockIFTATrip = async (audit: Partial<IFTATripAudit>): Promise<void> => {
    await api.post('/accounting/ifta-audit-lock', audit);
};
