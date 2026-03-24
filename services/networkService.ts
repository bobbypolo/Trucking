import { api } from "./api";
import { NetworkParty } from "../types";

export const getParties = async (
  companyId: string,
): Promise<NetworkParty[]> => {
  try {
    const data = await api.get(`/parties`);
    return data ?? [];
  } catch (e) {
    console.error("[networkService] getParties failed:", e);
    return [];
  }
};

export const saveParty = async (party: Partial<NetworkParty>) => {
  const result = await api.post(`/parties`, party);
  return result;
};

export const updatePartyStatus = async (
  partyId: string,
  status: string,
): Promise<void> => {
  await api.patch(`/parties/${partyId}/status`, { status });
};
