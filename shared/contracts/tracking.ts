/**
 * Shared Tracking Domain Contracts — FROZEN
 *
 * These types define the cross-team contract for fleet tracking and GPS data.
 * Any team may read these types; changes require cross-team agreement.
 *
 * Derived from types.ts canonical definitions.
 */

export interface TrackingVehicle {
  vehicleId: string;
  equipmentId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  lastUpdate: string;
  providerId: string;
  status: "active" | "idle" | "offline";
}

export interface TrackingProviderConfig {
  id: string;
  companyId: string;
  providerName: string;
  apiKey?: string;
  webhookUrl?: string;
  isActive: boolean;
}

export interface TelemetryEvent {
  timestamp: string;
  event: string;
  lat: number;
  lng: number;
  speed: number;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: string;
}
