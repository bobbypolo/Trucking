import { NetworkParty } from "../types";

const API_URL = 'http://localhost:5000/api';

export const getParties = async (companyId: string): Promise<NetworkParty[]> => {
    try {
        const res = await fetch(`${API_URL}/parties/${companyId}`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.error('Failed to fetch parties', e);
    }
    return [];
};

export const saveParty = async (party: Partial<NetworkParty>) => {
    try {
        const res = await fetch(`${API_URL}/parties`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(party)
        });
        if (!res.ok) throw new Error('Failed to save party');
    } catch (e) {
        console.error('Failed to save party', e);
        throw e;
    }
};

export const updatePartyStatus = async (partyId: string, status: string) => {
    // For now use saveParty or specific status endpoint
};
