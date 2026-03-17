import { Server } from "http";
import { closePool } from "../db";
import { logger } from "./logger";

/**
 * Gracefully shuts down the HTTP server and MySQL pool.
 * Exits with code 0 on success, 1 on forced timeout.
 * Called by the SIGTERM/SIGINT handlers registered in server/index.ts.
 */
export async function registerShutdownHandlers(
  server: Server,
  signal: string,
): Promise<void> {
  logger.info({ signal }, "Shutting down gracefully...");

  const forceExit = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
  forceExit.unref();

  await new Promise<void>((resolve) => {
    server.close((err?: Error) => {
      if (err) logger.error({ err }, "Error closing HTTP server");
      resolve();
    });
  });

  try {
    await closePool();
  } catch (err) {
    logger.error({ err }, "Error closing database pool");
  }
  process.exit(0);
}
