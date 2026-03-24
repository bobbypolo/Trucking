import { api } from "./api";
import { NetworkParty } from "../types";

export const getParties = async (
  companyId: string,
): Promise<NetworkParty[]> => {
  try {
    return (await api.get(`/parties/${companyId}`)) ?? [];
  } catch {
    return [];
  }
};

export const saveParty = async (party: Partial<NetworkParty>) => {
  await api.post("/parties", party);
};

export const updatePartyStatus = async (partyId: string, status: string) => {
  throw new Error("updatePartyStatus not implemented");
};
