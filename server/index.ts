import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

import { validateEnv, getCorsOrigin } from "./lib/env";
import { errorHandler } from "./middleware/errorHandler";
import { correlationId } from "./middleware/correlationId";
import { metricsMiddleware } from "./middleware/metrics";
import { logger } from "./lib/logger";
import { registerShutdownHandlers } from "./lib/graceful-shutdown";
import { initSentry } from "./lib/sentry";

validateEnv();

if (process.env.SENTRY_DSN) {
  initSentry();
}

if (!process.env.GEMINI_API_KEY) {
  logger.warn("GEMINI_API_KEY is not set — AI endpoints will be unavailable");
}

import usersRouter from "./routes/users";
import loadsRouter from "./routes/loads";
import equipmentRouter from "./routes/equipment";
import clientsRouter from "./routes/clients";
import contractsRouter from "./routes/contracts";
import dispatchRouter from "./routes/dispatch";
import complianceRouter from "./routes/compliance";
import incidentsRouter from "./routes/incidents";
import accountingRouter from "./routes/accounting";
import exceptionsRouter from "./routes/exceptions";
import trackingRouter from "./routes/tracking";
import weatherRouter from "./routes/weather";
import metricsRouter from "./routes/metrics";
import aiRouter from "./routes/ai";
import messagesRouter from "./routes/messages";
import callSessionsRouter from "./routes/call-sessions";
import quotesRouter from "./routes/quotes";
import leadsRouter from "./routes/leads";
import agreementsRouter from "./routes/agreements";
import financialObjectivesRouter from "./routes/financial-objectives";
import bookingsRouter from "./routes/bookings";
import contactsRouter from "./routes/contacts";
import providersRouter from "./routes/providers";
import tasksRouter from "./routes/tasks";
import kciRequestsRouter from "./routes/kci-requests";
import crisisActionsRouter from "./routes/crisis-actions";
import serviceTicketsRouter from "./routes/service-tickets";
import safetyRouter from "./routes/safety";
import notificationJobsRouter from "./routes/notification-jobs";
import documentsRouter from "./routes/documents";
import healthRouter from "./routes/health";
import quickbooksRouter from "./routes/quickbooks";
import callLogsRouter from "./routes/call-logs";
import geofenceRouter from "./routes/geofence";
import stripeRouter from "./routes/stripe";
import invitationsRouter from "./routes/invitations";
import intelligenceRouter from "./routes/intelligence";
import driverIntakeRouter from "./routes/loads-driver-intake";
import iftaAuditPacketsRouter from "./routes/ifta-audit-packets";
import featureFlagsRouter from "./routes/feature-flags";
import demoRouter from "./routes/demo";

const app = express();
const port = process.env.PORT || 5000;

app.set("trust proxy", 1); // Trust proxy headers behind reverse proxies
app.use(
  helmet({
    hsts: {
      maxAge: 31536000, // 1 year
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
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
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
app.use(compression());
app.use(cors({ origin: getCorsOrigin(), credentials: true }));
app.use(stripeRouter); // BEFORE express.json() so webhook receives raw body
app.use(express.json({ limit: "5mb" }));
app.use(correlationId);
app.use(metricsMiddleware);
app.use(healthRouter); // Unauthenticated, before rate limiter

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

app.use(usersRouter);
app.use(loadsRouter);
app.use(equipmentRouter);
app.use(clientsRouter);
app.use(contractsRouter);
app.use(dispatchRouter);
app.use(complianceRouter);
app.use(incidentsRouter);
app.use(accountingRouter);
app.use(quickbooksRouter);
app.use(exceptionsRouter);
app.use(trackingRouter);
app.use(weatherRouter);
app.use(metricsRouter);
app.use("/api/ai", express.json({ limit: "5mb" }), aiRouter);
app.use(messagesRouter);
app.use(callSessionsRouter);
app.use(quotesRouter);
app.use(leadsRouter);
app.use(agreementsRouter);
app.use(financialObjectivesRouter);
app.use(bookingsRouter);
app.use(contactsRouter);
app.use(providersRouter);
app.use(tasksRouter);
app.use(kciRequestsRouter);
app.use(crisisActionsRouter);
app.use(serviceTicketsRouter);
app.use(safetyRouter);
app.use(notificationJobsRouter);
app.use(documentsRouter);
app.use(callLogsRouter);
app.use(geofenceRouter);
app.use(invitationsRouter);
app.use(intelligenceRouter);
app.use(driverIntakeRouter);
app.use(iftaAuditPacketsRouter);
app.use("/api/feature-flags", featureFlagsRouter);
if (process.env.ALLOW_DEMO_RESET === "1") app.use("/api/demo", demoRouter);

// Serve built frontend from dist/ when it exists (demo + production mode).
// This allows the backend to serve both API and UI on a single port,
// which is required for Cloudflare tunnel (one URL, one port).
const distPath = path.resolve(__dirname, "../dist");
const fs = require("fs");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback: any non-API GET that doesn't match a static file
  // returns index.html so React Router handles client-side routing.
  // Express 5 requires named wildcard params: {*path} instead of bare *.
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
  logger.info({ distPath }, "Serving static frontend from dist/");
}

app.use(errorHandler);

const server = app.listen(port, () => {
  logger.info({ port }, `Server running on port ${port}`);
});

process.on("SIGTERM", () => registerShutdownHandlers(server, "SIGTERM"));
process.on("SIGINT", () => registerShutdownHandlers(server, "SIGINT"));

export { app };
