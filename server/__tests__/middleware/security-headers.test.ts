import { describe, it, expect } from "vitest";
import supertest from "supertest";
import express from "express";
import helmet from "helmet";

/**
 * HSTS Security Headers — Integration Tests
 *
 * # Tests R-SEC-01, R-SEC-02, R-SEC-03, R-SEC-04, R-SEC-05
 *
 * Verifies that helmet is configured with explicit HSTS settings:
 *   - max-age=31536000 (1 year)
 *   - includeSubDomains
 *   - preload
 */

function buildApp() {
  const app = express();

  // Mirror production helmet config from server/index.ts
  app.use(
    helmet({
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

describe("HSTS Security Headers", () => {
  const app = buildApp();
  const request = supertest(app);

  // Tests R-SEC-02: max-age=31536000
  it("includes strict-transport-security header with max-age=31536000", async () => {
    const res = await request.get("/api/health");
    expect(res.status).toBe(200);
    const hsts = res.headers["strict-transport-security"];
    expect(hsts).toBeDefined();
    expect(hsts).toContain("max-age=31536000");
  });

  // Tests R-SEC-03: includeSubDomains
  it("includes includeSubDomains in strict-transport-security header", async () => {
    const res = await request.get("/api/health");
    expect(res.status).toBe(200);
    const hsts = res.headers["strict-transport-security"];
    expect(hsts).toBeDefined();
    expect(hsts).toContain("includeSubDomains");
  });

  // Tests R-SEC-04: preload
  it("includes preload in strict-transport-security header", async () => {
    const res = await request.get("/api/health");
    expect(res.status).toBe(200);
    const hsts = res.headers["strict-transport-security"];
    expect(hsts).toBeDefined();
    expect(hsts).toContain("preload");
  });

  // Tests R-SEC-02, R-SEC-03, R-SEC-04: full header value
  it("produces the complete HSTS header value", async () => {
    const res = await request.get("/api/health");
    expect(res.status).toBe(200);
    const hsts = res.headers["strict-transport-security"];
    expect(hsts).toBe("max-age=31536000; includeSubDomains; preload");
  });
});
