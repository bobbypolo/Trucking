import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import dotenv from "dotenv";

dotenv.config();

import { validateEnv, getCorsOrigin } from "./lib/env";
import { errorHandler } from "./middleware/errorHandler";
import { correlationId } from "./middleware/correlationId";
import { metricsMiddleware } from "./middleware/metrics";
import { logger } from "./lib/logger";
import { registerShutdownHandlers } from "./lib/graceful-shutdown";

validateEnv();

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
import bookingsRouter from "./routes/bookings";
import contactsRouter from "./routes/contacts";
import providersRouter from "./routes/providers";
import tasksRouter from "./routes/tasks";
import kciRequestsRouter from "./routes/kci-requests";
import crisisActionsRouter from "./routes/crisis-actions";
import serviceTicketsRouter from "./routes/service-tickets";
import safetyRouter from "./routes/safety";
import notificationJobsRouter from "./routes/notification-jobs";
import vaultDocsRouter from "./routes/vault-docs";
import healthRouter from "./routes/health";

const app = express();
const port = process.env.PORT || 5000;

// Trust proxy headers (X-Forwarded-For) when behind reverse proxies (Cloud Run, Cloudflare Tunnel)
app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());
app.use(cors({ origin: getCorsOrigin(), credentials: true }));
app.use(express.json());
app.use(correlationId);
app.use(metricsMiddleware);

// Health check — unauthenticated, used by load balancers; registered before rate limiter
// so high-frequency polling from GCP/ALB does not consume rate-limit budget.
app.use(healthRouter);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
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
app.use(exceptionsRouter);
app.use(trackingRouter);
app.use(weatherRouter);
app.use(metricsRouter);
app.use("/api/ai", express.json({ limit: "5mb" }), aiRouter);
app.use(messagesRouter);
app.use(callSessionsRouter);
app.use(quotesRouter);
app.use(leadsRouter);
app.use(bookingsRouter);
app.use(contactsRouter);
app.use(providersRouter);
app.use(tasksRouter);
app.use(kciRequestsRouter);
app.use(crisisActionsRouter);
app.use(serviceTicketsRouter);
app.use(safetyRouter);
app.use(notificationJobsRouter);
app.use(vaultDocsRouter);

app.use(errorHandler);

const server = app.listen(port, () => {
  logger.info({ port }, `Server running on port ${port}`);
});

process.on("SIGTERM", () => registerShutdownHandlers(server, "SIGTERM"));
process.on("SIGINT", () => registerShutdownHandlers(server, "SIGINT"));

export { app };
