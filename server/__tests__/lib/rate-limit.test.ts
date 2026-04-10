import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { createApiLimiter } from "../../lib/rate-limit";

describe("API rate limiter", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_MAX;
  });

  it("does not throttle authenticated API traffic", async () => {
    process.env.RATE_LIMIT_MAX = "1";

    const app = express();
    app.use(express.json());
    app.use("/api", createApiLimiter());
    app.get("/api/demo", (_req, res) => res.json({ ok: true }));

    const first = await request(app)
      .get("/api/demo")
      .set("Authorization", "Bearer demo-token");
    const second = await request(app)
      .get("/api/demo")
      .set("Authorization", "Bearer demo-token");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("still throttles anonymous API traffic", async () => {
    process.env.RATE_LIMIT_MAX = "1";

    const app = express();
    app.use(express.json());
    app.use("/api", createApiLimiter());
    app.get("/api/demo", (_req, res) => res.json({ ok: true }));

    const first = await request(app).get("/api/demo");
    const second = await request(app).get("/api/demo");

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });
});
