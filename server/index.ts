import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load .env BEFORE any validation or module imports that read env vars
dotenv.config();

import { validateEnv } from './lib/env';
import { errorHandler } from './middleware/errorHandler';
import { correlationId } from './middleware/correlationId';
import { logger } from './lib/logger';

// Fail fast if required environment variables are missing
validateEnv();

// Domain route modules
import usersRouter from './routes/users';
import loadsRouter from './routes/loads';
import equipmentRouter from './routes/equipment';
import clientsRouter from './routes/clients';
import contractsRouter from './routes/contracts';
import dispatchRouter from './routes/dispatch';
import complianceRouter from './routes/compliance';
import incidentsRouter from './routes/incidents';
import accountingRouter from './routes/accounting';
import exceptionsRouter from './routes/exceptions';
import trackingRouter from './routes/tracking';

const app = express();
const port = process.env.PORT || 5000;

// Global middleware
app.use(cors());
app.use(express.json());
app.use(correlationId);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'LoadPilot API is running',
        database: 'Firestore'
    });
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

// Global error handler — must be registered AFTER all routes
app.use(errorHandler);

app.listen(port, () => {
    logger.info({ port }, `Server running on port ${port}`);
});
