import { z } from "zod";

/**
 * Schema for POST /api/tracking/webhook — GPS position ping from ELD/GPS providers.
 */
export const trackingWebhookSchema = z.object({
  vehicleId: z.string().min(1, "vehicleId is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  driverId: z.string().optional(),
  companyId: z.string().min(1, "companyId is required"),
});

/**
 * Schema for POST /api/tracking/providers — create/update GPS provider config.
 */
export const createProviderConfigSchema = z.object({
  providerName: z.string().min(1, "providerName is required"),
  apiToken: z.string().optional(),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  webhookSecret: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for POST /api/tracking/vehicles/mapping — map vehicle to GPS provider.
 */
export const createVehicleMappingSchema = z.object({
  vehicleId: z.string().min(1, "vehicleId is required"),
  providerConfigId: z.string().min(1, "providerConfigId is required"),
  providerVehicleId: z.string().min(1, "providerVehicleId is required"),
});

/**
 * Schema for POST /api/tracking/mobile-gps — driver phone GPS ping.
 */
export const mobileGpsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  timestamp: z.string().optional(),
});
