import { api } from './api';

/** A single detention record returned by the server. */
export interface DetentionRecord {
  facilityName: string | null;
  entryTime: string;
  exitTime: string;
  dwellHours: number;
  billableHours: number;
  charge: number;
  freeHours: number;
  hourlyRate: number;
}

/** Full detention calculation response from the server. */
export interface DetentionCalculation {
  loadId: string;
  records: DetentionRecord[];
  totalCharge: number;
  rules: {
    freeHours: number;
    hourlyRate: number;
    maxBillableHours: number;
  };
}

/** Geofence event payload sent to the server. */
export interface GeofenceEventPayload {
  loadId: string;
  driverId?: string;
  facilityName?: string;
  facilityLat: number;
  facilityLng: number;
  geofenceRadiusMeters?: number;
  eventType: 'ENTRY' | 'EXIT';
  eventTimestamp?: string;
}

/**
 * DetentionService handles geofence event recording and detention calculation
 * via server-side APIs. All detention math is performed server-side using
 * real ENTRY/EXIT event pairs and company-specific detention rules.
 */
export const DetentionService = {
  /**
   * Records a geofence ENTRY or EXIT event on the server.
   */
  processGeofenceEvent: async (
    event: GeofenceEventPayload,
  ): Promise<{ id: string; message: string }> => {
    return api.post('/api/geofence-events', event);
  },

  /**
   * Calculates detention for a load by pairing server-stored ENTRY/EXIT events.
   * Returns detention records with charges based on company detention rules.
   */
  calculateDetention: async (
    loadId: string,
  ): Promise<DetentionCalculation> => {
    return api.post('/api/detention/calculate', { loadId });
  },

  /**
   * Fetches all geofence events for a given load.
   */
  getGeofenceEvents: async (loadId: string): Promise<any[]> => {
    return api.get(`/api/geofence-events?loadId=${encodeURIComponent(loadId)}`);
  },
};
