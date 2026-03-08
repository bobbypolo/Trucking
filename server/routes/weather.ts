/**
 * Weather Route — GET /api/weather
 *
 * Returns current weather conditions for a given lat/lng coordinate.
 * Delegates to weather.service.ts which handles timeouts, fallbacks,
 * and feature flag checks. This route never returns 500 for weather
 * failures — the service always returns a degraded response.
 *
 * Query params:
 *   lat: number — latitude
 *   lng: number — longitude
 *
 * @see .claude/docs/PLAN.md R-P3-03
 */

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { getWeatherForLocation } from "../services/weather.service";

const router = Router();

router.get(
  "/api/weather",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({
        error_code: "VALIDATION_001",
        error_class: "VALIDATION",
        message:
          "lat and lng query parameters are required and must be numbers",
        retryable: false,
      });
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({
        error_code: "VALIDATION_002",
        error_class: "VALIDATION",
        message: "lat must be between -90 and 90, lng between -180 and 180",
        retryable: false,
      });
      return;
    }

    const weather = await getWeatherForLocation(lat, lng);

    // Always return 200 — degraded response is still a valid response
    res.json(weather);
  },
);

export default router;
