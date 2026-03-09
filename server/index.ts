import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import dotenv from "dotenv";

// Load .env BEFORE any validation or module imports that read env vars
dotenv.config();

import { validateEnv } from "./lib/env";
import { errorHandler } from "./middleware/errorHandler";
import { correlationId } from "./middleware/correlationId";
import { metricsMiddleware } from "./middleware/metrics";
import { logger } from "./lib/logger";
import { registerShutdownHandlers } from "./lib/graceful-shutdown";

// Fail fast if required environment variables are missing
validateEnv();

// Domain route modules
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

const app = express();
const port = process.env.PORT || 5000;

// Security headers via helmet (must be first)
app.use(helmet());

// Gzip compression
app.use(compression());

// CORS — restrict to configured origin in production
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors({ origin: corsOrigin || "*", credentials: true }));

app.use(express.json());
app.use(correlationId);
app.use(metricsMiddleware);

// Rate limiting on all /api routes
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || "100", 10);
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "LoadPilot API is running", database: "Firestore" });
});

// Mount domain routers
app.use(usersRouter);
app.use(loadsRouter);
app.use(equipmentRouter);
app.use(clientsRouter);
app.use(contractsRouter);
app.use(dispatchRouter);
app.use(complianceRouter);
app.use(incidentsRouter);
app.use(accountingRouter);
app.use(exceptionsRouter);
app.use(trackingRouter);
app.use(weatherRouter);
app.use(metricsRouter);
app.use(aiRouter);

// Global error handler — must be registered AFTER all routes
app.use(errorHandler);

const server = app.listen(port, () => {
  logger.info({ port }, `Server running on port ${port}`);
});

// Graceful shutdown — SIGTERM and SIGINT both invoke shutdownHandler
process.on("SIGTERM", () => registerShutdownHandlers(server, "SIGTERM"));
process.on("SIGINT", () => registerShutdownHandlers(server, "SIGINT"));

export { app };
