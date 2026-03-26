/**
 * Shared Load Domain Contracts — FROZEN
 *
 * These types define the cross-team contract for load-related data.
 * Any team may read these types; changes require cross-team agreement.
 *
 * Derived from types.ts canonical definitions.
 */

export type LoadStatus =
  | "draft"
  | "planned"
  | "dispatched"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "completed"
  | "cancelled";

export type FreightType = "Intermodal" | "Reefer" | "Dry Van" | "Flatbed";

export interface LoadLeg {
  id: string;
  type: "Pickup" | "Dropoff" | "Fuel" | "Rest";
  location: {
    city: string;
    state: string;
    facilityName: string;
    address?: string;
    zip?: string;
  };
  sealNumber?: string;
  pallets?: number;
  weight?: number;
  hoursOfOp?: string;
  description?: string;
  date: string;
  appointmentTime?: string;
  completed: boolean;
  completedAt?: string;
}

export interface LoadExpense {
  id: string;
  category: string;
  amount: number;
  date: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
  isEquipmentBilling?: boolean;
}

export interface DocumentRef {
  id: string;
  type: string;
  url: string;
  filename: string;
  status: "Draft" | "Submitted" | "Approved" | "Rejected" | "Locked";
}

export interface LoadSummary {
  id: string;
  loadNumber: string;
  status: LoadStatus;
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  driverId?: string;
  driverName?: string;
  customerId?: string;
  customerName?: string;
  companyId: string;
}

export interface LoadDetail extends LoadSummary {
  legs: LoadLeg[];
  expenses: LoadExpense[];
  documents: DocumentRef[];
  weight?: number;
  freightType?: FreightType;
  equipmentId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEntry {
  loadId: string;
  loadNumber: string;
  driverId: string;
  driverName: string;
  pickupDate: string;
  deliveryDate: string;
  origin: string;
  destination: string;
  status: LoadStatus;
}
