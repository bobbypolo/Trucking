import { api } from "./api";
import { NetworkParty } from "../types";

export const getParties = async (
  companyId: string,
  signal?: AbortSignal,
): Promise<NetworkParty[]> => {
  try {
    const data = await api.get(`/parties`, { signal });
    return data ?? [];
  } catch (e) {
    console.error("[networkService] getParties failed:", e);
    throw e instanceof Error ? e : new Error("Failed to load parties");
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
