import { api } from "./api";
import { NetworkParty } from "../types";

/**
 * Fetch all parties for the current tenant by merging clients and providers.
 * The server already scopes by tenant via the auth token.
 */
export const getParties = async (
  _companyId?: string,
): Promise<NetworkParty[]> => {
  try {
    const [clients, providers] = await Promise.all([
      api.get("/clients").catch(() => []),
      api.get("/providers").catch(() => []),
    ]);
    const clientParties = (Array.isArray(clients) ? clients : []).map(
      (c: any) => ({
        ...c,
        type: c.type || "Shipper",
        status: c.status || "Active",
        isCustomer: true,
        isVendor: false,
      }),
    );
    const providerParties = (Array.isArray(providers) ? providers : []).map(
      (p: any) => ({
        ...p,
        type: p.type || "Carrier",
        status: p.status || "Active",
        isCustomer: false,
        isVendor: true,
      }),
    );
    return [...clientParties, ...providerParties];
  } catch {
    return [];
  }
};

/**
 * Save a party by posting to the appropriate backend route.
 */
export const saveParty = async (
  party: Partial<NetworkParty>,
): Promise<void> => {
  const isVendor =
    party.isVendor || party.type === "Carrier" || party.type === "Vendor";
  const endpoint = isVendor ? "/providers" : "/clients";
  await api.post(endpoint, party);
};

/**
 * Update a party's status.
 */
export const updatePartyStatus = async (
  partyId: string,
  status: string,
): Promise<void> => {
  // Try both endpoints since we don't know the party type
  try {
    await api.patch(`/providers/${partyId}`, { status });
  } catch {
    await api.patch(`/clients/${partyId}`, { status });
  }
};
