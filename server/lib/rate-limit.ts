import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

function resolveRequestValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getClientIp(req: Request): string {
  const cfConnectingIp = resolveRequestValue(req.headers["cf-connecting-ip"]);
  if (cfConnectingIp) return cfConnectingIp;

  const forwardedFor = resolveRequestValue(req.headers["x-forwarded-for"]);
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  return req.ip || "unknown";
}

export function hasBearerToken(req: Request): boolean {
  const authHeader = resolveRequestValue(req.headers.authorization);
  return Boolean(authHeader && authHeader.startsWith("Bearer "));
}

export function createApiLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(getClientIp(req)),
    skip: (req) => hasBearerToken(req),
    message: { message: "Too many requests, please try again later." },
  });
}

export function createLoginLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
      const firebaseUid =
        resolveRequestValue(req.body?.firebaseUid) ||
        resolveRequestValue(req.body?.firebase_uid);
      if (firebaseUid) return `firebase:${firebaseUid}`;

      const email = resolveRequestValue(req.body?.email)?.toLowerCase();
      if (email) return `email:${email}`;

      return ipKeyGenerator(getClientIp(req));
    },
    message: { error: "Too many login attempts. Try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

export function createResetPasswordLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => {
      const email = resolveRequestValue(req.body?.email)?.toLowerCase();
      if (email) return `email:${email}`;
      return ipKeyGenerator(getClientIp(req));
    },
    message: { error: "Too many password reset requests. Try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });
}
