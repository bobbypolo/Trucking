import { API_URL } from "./config";
import { Broker, Contract } from "../types";
import { getAuthHeaders } from "./authService";
import { DEMO_MODE } from "./firebase";

const BROKERS_KEY = "loadpilot_brokers_v1";

export const getRawBrokers = (): Broker[] => {
  try {
    const data = localStorage.getItem(BROKERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn(
      "[brokerService] Failed to parse brokers from localStorage:",
      e,
    );
    return [];
  }
};

export const getBrokers = async (companyId?: string): Promise<Broker[]> => {
  try {
    const url = companyId
      ? `${API_URL}/clients/${companyId}`
      : `${API_URL}/clients`;
    const response = await fetch(url, {
      headers: await getAuthHeaders(),
    });
    if (response.ok) {
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
    }
  } catch (e) {
    console.warn("[brokerService] API fetch brokers failed:", e);
  }
  return getRawBrokers().sort((a, b) => a.name.localeCompare(b.name));
};

export const saveBroker = async (broker: Broker) => {
  // Save to backend
  try {
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
  } catch (e) {
    console.warn("[brokerService] API save broker failed:", e);
  }

  // Fallback/Parallel save to localStorage
  const brokers = getRawBrokers();
  const index = brokers.findIndex((b) => b.id === broker.id);

  if (index >= 0) {
    brokers[index] = broker;
  } else {
    brokers.push(broker);
  }
  localStorage.setItem(BROKERS_KEY, JSON.stringify(brokers));
};

export const getBrokerById = async (
  id: string,
): Promise<Broker | undefined> => {
  const brokers = await getBrokers();
  return brokers.find((b) => b.id === id);
};

// Contracts
export const getContracts = async (customerId: string): Promise<Contract[]> => {
  try {
    const response = await fetch(`${API_URL}/contracts/${customerId}`, {
      headers: await getAuthHeaders(),
    });
    if (response.ok) {
      const data = await response.json();
      return data.map((c: any) => ({
        ...c,
        equipmentPreferences:
          typeof c.equipment_preferences === "string"
            ? JSON.parse(c.equipment_preferences)
            : c.equipment_preferences || {},
      }));
    }
  } catch (e) {
    console.warn("[brokerService] API fetch contracts failed:", e);
  }
  return [];
};

export const saveContract = async (contract: Contract) => {
  try {
    const response = await fetch(`${API_URL}/contracts`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(contract),
    });
    if (!response.ok) throw new Error("Failed to save contract");
  } catch (e) {
    console.warn("[brokerService] API save contract failed:", e);
  }
};

// Simulate checking FMCSA safety score (demo only)
export const checkSafetyScore = (mcNumber: string): number | null => {
  if (!DEMO_MODE) return null;
  // Deterministic "random" score based on MC number for demo consistency
  const seed = mcNumber
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  // Generate a score between 65 and 99
  return 65 + (seed % 35);
};
