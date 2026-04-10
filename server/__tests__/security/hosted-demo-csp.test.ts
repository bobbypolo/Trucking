import { describe, expect, it } from "vitest";
import express from "express";
import helmet from "helmet";
import request from "supertest";

const cspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  imgSrc: ["'self'", "data:", "blob:", "https:"],
  styleSrc: ["'self'", "'unsafe-inline'", "https:"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "https://www.googletagmanager.com",
    "https://www.gstatic.com",
    "https://maps.googleapis.com",
    "https://js.stripe.com",
  ],
  fontSrc: ["'self'", "data:", "https:"],
  connectSrc: [
    "'self'",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://firebaseinstallations.googleapis.com",
    "https://firebase.googleapis.com",
    "https://www.googleapis.com",
    "https://*.googleapis.com",
    "https://www.google-analytics.com",
    "https://www.google.com",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    "https://*.firebaseio.com",
    "wss://*.firebaseio.com",
    "https://*.cloudfunctions.net",
    "https://api.stripe.com",
  ],
  frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
  workerSrc: ["'self'", "blob:"],
  manifestSrc: ["'self'"],
};

describe("hosted demo CSP", () => {
  it("allows Firebase and Google auth/install endpoints required for browser login", async () => {
    const app = express();
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: cspDirectives,
        },
      }),
    );
    app.get("/", (_req, res) => res.send("ok"));

    const response = await request(app).get("/");
    const cspHeader = response.headers["content-security-policy"];

    expect(response.status).toBe(200);
    expect(cspHeader).toContain("connect-src");
    expect(cspHeader).toContain("https://identitytoolkit.googleapis.com");
    expect(cspHeader).toContain("https://securetoken.googleapis.com");
    expect(cspHeader).toContain("https://firebaseinstallations.googleapis.com");
    expect(cspHeader).toContain("https://firebase.googleapis.com");
    expect(cspHeader).toContain("https://www.googleapis.com");
    expect(cspHeader).toContain("https://www.google-analytics.com");
    expect(cspHeader).toContain("https://www.google.com");
  });
});
