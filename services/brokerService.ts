import { API_URL } from "./config";
import { Broker, Contract } from "../types";
import { getAuthHeaders } from "./authService";

export const getBrokers = async (companyId?: string): Promise<Broker[]> => {
  const url = companyId
    ? `${API_URL}/clients/${companyId}`
    : `${API_URL}/clients`;
  const response = await fetch(url, {
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch brokers: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data
    .map((b: any) => ({
      ...b,
      approvedChassis:
        typeof b.chassis_requirements === "string"
          ? JSON.parse(b.chassis_requirements)
          : b.chassis_requirements || [],
      clientType: b.type,
    }))
    .sort((a: Broker, b: Broker) => a.name.localeCompare(b.name));
};

export const saveBroker = async (broker: Broker) => {
  const response = await fetch(`${API_URL}/clients`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      ...broker,
      type: broker.clientType, // Map to SQL 'type'
      chassis_requirements: broker.approvedChassis,
    }),
  });
  if (!response.ok) throw new Error("Failed to save to backend");
};

export const getBrokerById = async (
  id: string,
): Promise<Broker | undefined> => {
  const brokers = await getBrokers();
  return brokers.find((b) => b.id === id);
};

// Contracts
export const getContracts = async (customerId: string): Promise<Contract[]> => {
  const response = await fetch(`${API_URL}/contracts/${customerId}`, {
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch contracts: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.map((c: any) => ({
    ...c,
    equipmentPreferences:
      typeof c.equipment_preferences === "string"
        ? JSON.parse(c.equipment_preferences)
        : c.equipment_preferences || {},
  }));
};

export const saveContract = async (contract: Contract) => {
  const response = await fetch(`${API_URL}/contracts`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(contract),
  });
  if (!response.ok) throw new Error("Failed to save contract");
};

// FMCSA safety score lookup — returns null until real integration is built
export const checkSafetyScore = (_mcNumber: string): null => {
  return null;
};
