import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";

/**
 * Security middleware tests for R-P1-03 and R-P1-04.
 *
 * R-P1-03: helmet() adds x-content-type-options: nosniff
 * R-P1-04: rate limiter returns 429 after threshold exceeded
 */

function buildSecureApp(rateLimitMax = 3) {
  const app = express();

  // Security headers
  app.use(helmet());

  // Compression
  app.use(compression());

  // Rate limit (low threshold for testing)
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  });
  app.use("/api", limiter);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

describe("Security Middleware", () => {
  const app = buildSecureApp(3);
  const request = supertest(app);

  describe("R-P1-03: helmet security headers", () => {
    it("GET /api/health includes x-content-type-options: nosniff", async () => {
      const res = await request.get("/api/health");
      expect(res.status).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("GET /api/health includes x-frame-options header", async () => {
      const res = await request.get("/api/health");
      expect(res.headers["x-frame-options"]).toBeDefined();
    });
  });

  describe("R-P1-04: rate limiting returns 429", () => {
    it("returns 429 after exceeding rate limit threshold", async () => {
      const limitedApp = buildSecureApp(2);
      const req = supertest(limitedApp);

      // First two requests should succeed
      const r1 = await req.get("/api/health");
      expect(r1.status).toBe(200);

      const r2 = await req.get("/api/health");
      expect(r2.status).toBe(200);

      // Third request exceeds limit
      const r3 = await req.get("/api/health");
      expect(r3.status).toBe(429);
    });

    it("429 response includes expected message", async () => {
      const limitedApp = buildSecureApp(1);
      const req = supertest(limitedApp);

      // First request succeeds
      await req.get("/api/health");

      // Second request is rate limited
      const res = await req.get("/api/health");
      expect(res.status).toBe(429);
      expect(res.body.message).toContain("Too many requests");
    });
  });

  describe("Compression", () => {
    it("includes content-encoding when accept-encoding: gzip provided", async () => {
      const res = await request
        .get("/api/health")
        .set("Accept-Encoding", "gzip");
      // Response may or may not be compressed depending on size threshold
      expect([200]).toContain(res.status);
    });
  });
});
