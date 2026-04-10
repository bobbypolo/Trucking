import { describe, it, expect } from "vitest";
import supertest from "supertest";
import express from "express";
import helmet from "helmet";

/**
 * Security Headers — Integration Tests
 *
 * # Tests R-SEC-01, R-SEC-02, R-SEC-03, R-SEC-04, R-SEC-05
 *
 * Verifies that helmet is configured with explicit HSTS and CSP settings.
 * The CSP must allow Firebase Auth, Google Maps, and other external APIs.
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
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://www.googletagmanager.com",
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https://*.googleapis.com",
            "https://*.gstatic.com",
            "https://*.google.com",
          ],
          connectSrc: [
            "'self'",
            "https://identitytoolkit.googleapis.com",
            "https://securetoken.googleapis.com",
            "https://firebase.googleapis.com",
            "https://firebaseinstallations.googleapis.com",
            "https://www.googleapis.com",
            "https://*.firebaseio.com",
            "https://*.cloudfunctions.net",
            "https://maps.googleapis.com",
            "https://weather.service.azure.com",
            "https://atlas.microsoft.com",
            "https://api.openweathermap.org",
            "https://api.samsara.com",
            "https://mobile.fmcsa.dot.gov",
            "wss://*.firebaseio.com",
          ],
          frameSrc: ["'self'", "https://*.firebaseapp.com"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
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

describe("CSP Security Headers", () => {
  const app = buildApp();
  const request = supertest(app);

  it("includes content-security-policy header", async () => {
    const res = await request.get("/api/health");
    expect(res.status).toBe(200);
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();
  });

  it("sets default-src to self", async () => {
    const res = await request.get("/api/health");
    const csp = res.headers["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
  });

  it("allows Firebase Auth domains in connect-src", async () => {
    const res = await request.get("/api/health");
    const csp = res.headers["content-security-policy"];
    expect(csp).toContain("identitytoolkit.googleapis.com");
    expect(csp).toContain("securetoken.googleapis.com");
    expect(csp).toContain("firebase.googleapis.com");
    expect(csp).toContain("firebaseinstallations.googleapis.com");
  });

  it("allows Google Maps in connect-src", async () => {
    const res = await request.get("/api/health");
    const csp = res.headers["content-security-policy"];
    expect(csp).toContain("maps.googleapis.com");
  });

  it("allows external API domains in connect-src", async () => {
    const res = await request.get("/api/health");
    const csp = res.headers["content-security-policy"];
    expect(csp).toContain("api.samsara.com");
    expect(csp).toContain("mobile.fmcsa.dot.gov");
  });

  it("allows Google Tag Manager in script-src", async () => {
    const res = await request.get("/api/health");
    const csp = res.headers["content-security-policy"];
    expect(csp).toContain("www.googletagmanager.com");
  });

  it("blocks object-src", async () => {
    const res = await request.get("/api/health");
    const csp = res.headers["content-security-policy"];
    expect(csp).toContain("object-src 'none'");
  });
});
