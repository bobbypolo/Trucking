import { z } from "zod";

/**
 * Schema for POST /api/geofence-events — record ENTRY/EXIT geofence event.
 */
export const createGeofenceEventSchema = z.object({
  loadId: z.string().min(1, "loadId is required"),
  driverId: z.string().optional(),
  facilityName: z.string().optional(),
  facilityLat: z.number({ error: "facilityLat is required" }),
  facilityLng: z.number({ error: "facilityLng is required" }),
  geofenceRadiusMeters: z.number().positive().optional(),
  eventType: z.enum(["ENTRY", "EXIT"]),
  eventTimestamp: z.string().optional(),
});

/**
 * Schema for POST /api/detention/calculate — calculate detention for a load.
 */
export const calculateDetentionSchema = z.object({
  loadId: z.string().min(1, "loadId is required"),
});
