import { api } from "./api";
import { Broker, Contract } from "../types";

export const getBrokers = async (companyId?: string): Promise<Broker[]> => {
  try {
    const url = companyId ? `/clients/${companyId}` : `/clients`;
    const data = await api.get(url);
    return (data as any[])
      .map((b: any) => ({
        ...b,
        approvedChassis:
          typeof b.chassis_requirements === "string"
            ? JSON.parse(b.chassis_requirements)
            : b.chassis_requirements || [],
        clientType: b.type,
      }))
      .sort((a: Broker, b: Broker) => a.name.localeCompare(b.name));
  } catch (e) {
    console.warn("[brokerService] API fetch brokers failed:", e);
  }
  return [];
};

export const saveBroker = async (broker: Broker) => {
  try {
    await api.post("/clients", {
      ...broker,
      type: broker.clientType, // Map to SQL 'type'
      chassis_requirements: broker.approvedChassis,
    });
  } catch (e) {
    console.warn("[brokerService] API save broker failed:", e);
  }
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
    const data = await api.get(`/contracts/${customerId}`);
    return (data as any[]).map((c: any) => ({
      ...c,
      equipmentPreferences:
        typeof c.equipment_preferences === "string"
          ? JSON.parse(c.equipment_preferences)
          : c.equipment_preferences || {},
    }));
  } catch (e) {
    console.warn("[brokerService] API fetch contracts failed:", e);
  }
  return [];
};

export const saveContract = async (contract: Contract) => {
  try {
    await api.post("/contracts", contract);
  } catch (e) {
    console.warn("[brokerService] API save contract failed:", e);
  }
};

// FMCSA safety score lookup — returns null until real integration is built
export const checkSafetyScore = (_mcNumber: string): null => {
  return null;
};
