import { API_URL } from "./config";
import { NetworkParty } from "../types";

export const getParties = async (
  companyId: string,
): Promise<NetworkParty[]> => {
  try {
    const res = await fetch(`${API_URL}/parties/${companyId}`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return [];
};

export const saveParty = async (party: Partial<NetworkParty>) => {
  try {
    const res = await fetch(`${API_URL}/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(party),
    });
    if (!res.ok) throw new Error("Failed to save party");
  } catch (e) {
    throw e;
  }
};

export const updatePartyStatus = async (partyId: string, status: string) => {
  throw new Error("updatePartyStatus not implemented");
};
