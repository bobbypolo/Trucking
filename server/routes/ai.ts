/**
 * ai.ts — AI proxy route handlers.
 *
 * All Gemini AI requests are proxied through these server-side endpoints.
 * The Gemini API key lives in process.env.GEMINI_API_KEY (server-only).
 * Clients must be authenticated (requireAuth) to access any endpoint.
 */

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import {
  extractLoadInfo,
  extractBrokerFromImage,
  extractEquipmentFromImage,
  generateTrainingFromImage,
  analyzeSafetyCompliance,
} from "../services/gemini.service";
import { createChildLogger } from "../lib/logger";

const router = Router();

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/**
 * Validate that imageBase64 is present and is a non-empty string.
 * Returns an error message or null if valid.
 */
function validateImagePayload(body: unknown): string | null {
  if (
    !body ||
    typeof body !== "object" ||
    !("imageBase64" in body) ||
    typeof (body as Record<string, unknown>).imageBase64 !== "string" ||
    (body as Record<string, unknown>).imageBase64 === ""
  ) {
    return "imageBase64 is required and must be a non-empty string";
  }
  return null;
}

/**
 * Validate the mimeType field when provided.
 * Returns an error message or null if valid.
 */
function validateMimeType(body: Record<string, unknown>): string | null {
  if (!("mimeType" in body) || body.mimeType === undefined) {
    // mimeType is optional — defaults handled at call site
    return null;
  }
  if (
    !ALLOWED_MIME_TYPES.includes(
      body.mimeType as (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return (
      "Invalid mimeType '" +
      body.mimeType +
      "'. Allowed values: " +
      ALLOWED_MIME_TYPES.join(", ")
    );
  }
  return null;
}

/**
 * POST /extract-load  (mounted at /api/ai in index.ts → effective path: /api/ai/extract-load)
 * Extract load and broker info from a document image.
 * Body: { imageBase64: string, mimeType?: string }
 */
router.post(
  "/extract-load",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/ai/extract-load",
    });
    const validationError = validateImagePayload(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const mimeError = validateMimeType(req.body as Record<string, unknown>);
    if (mimeError) {
      res.status(400).json({ error: mimeError });
      return;
    }

    const { imageBase64, mimeType = "image/jpeg" } = req.body as {
      imageBase64: string;
      mimeType?: string;
    };

    try {
      const result = await extractLoadInfo(imageBase64, mimeType);
      res.json({ loadInfo: result });
    } catch (error) {
      log.error({ err: error }, "Gemini extractLoadInfo failed");
      res.status(500).json({ error: "AI extraction failed" });
    }
  },
);

/**
 * POST /extract-broker  (mounted at /api/ai in index.ts → effective path: /api/ai/extract-broker)
 * Extract broker profile from a document image.
 * Body: { imageBase64: string, mimeType?: string }
 */
router.post(
  "/extract-broker",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/ai/extract-broker",
    });
    const validationError = validateImagePayload(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const mimeError = validateMimeType(req.body as Record<string, unknown>);
    if (mimeError) {
      res.status(400).json({ error: mimeError });
      return;
    }

    const { imageBase64, mimeType = "image/jpeg" } = req.body as {
      imageBase64: string;
      mimeType?: string;
    };

    try {
      const result = await extractBrokerFromImage(imageBase64, mimeType);
      res.json({ brokerInfo: result });
    } catch (error) {
      log.error({ err: error }, "Gemini extractBrokerFromImage failed");
      res.status(500).json({ error: "AI extraction failed" });
    }
  },
);

/**
 * POST /extract-equipment  (mounted at /api/ai in index.ts → effective path: /api/ai/extract-equipment)
 * Extract equipment info from a photo.
 * Body: { imageBase64: string, mimeType?: string }
 */
router.post(
  "/extract-equipment",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/ai/extract-equipment",
    });
    const validationError = validateImagePayload(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const mimeError = validateMimeType(req.body as Record<string, unknown>);
    if (mimeError) {
      res.status(400).json({ error: mimeError });
      return;
    }

    const { imageBase64, mimeType = "image/jpeg" } = req.body as {
      imageBase64: string;
      mimeType?: string;
    };

    try {
      const result = await extractEquipmentFromImage(imageBase64, mimeType);
      res.json({ equipmentInfo: result });
    } catch (error) {
      log.error({ err: error }, "Gemini extractEquipmentFromImage failed");
      res.status(500).json({ error: "AI extraction failed" });
    }
  },
);

/**
 * POST /generate-training  (mounted at /api/ai in index.ts → effective path: /api/ai/generate-training)
 * Generate a training quiz from a safety document image.
 * Body: { imageBase64: string, mimeType?: string }
 */
router.post(
  "/generate-training",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/ai/generate-training",
    });
    const validationError = validateImagePayload(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const mimeError = validateMimeType(req.body as Record<string, unknown>);
    if (mimeError) {
      res.status(400).json({ error: mimeError });
      return;
    }

    const { imageBase64, mimeType = "image/jpeg" } = req.body as {
      imageBase64: string;
      mimeType?: string;
    };

    try {
      const result = await generateTrainingFromImage(imageBase64, mimeType);
      res.json({ training: result });
    } catch (error) {
      log.error({ err: error }, "Gemini generateTrainingFromImage failed");
      res.status(500).json({ error: "AI generation failed" });
    }
  },
);

/**
 * POST /analyze-safety  (mounted at /api/ai in index.ts → effective path: /api/ai/analyze-safety)
 * Analyze safety compliance data for a driver.
 * Body: { data: { activityHistory: unknown[], performance: unknown } }
 */
router.post(
  "/analyze-safety",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/ai/analyze-safety",
    });

    const body = req.body as Record<string, unknown>;
    if (!body || !body.data || typeof body.data !== "object") {
      res.status(400).json({ error: "data is required and must be an object" });
      return;
    }

    const { activityHistory = [], performance = {} } = body.data as {
      activityHistory?: unknown[];
      performance?: unknown;
    };

    try {
      const result = await analyzeSafetyCompliance(
        activityHistory as unknown[],
        performance,
      );
      res.json({ analysis: result });
    } catch (error) {
      log.error({ err: error }, "Gemini analyzeSafetyCompliance failed");
      res.status(500).json({ error: "AI analysis failed" });
    }
  },
);

export default router;
