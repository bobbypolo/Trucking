/**
 * CLI entry point for database migrations.
 *
 * Usage:
 *   npx ts-node server/scripts/migrate.ts up       # Apply pending migrations
 *   npx ts-node server/scripts/migrate.ts down     # Rollback last migration
 *   npx ts-node server/scripts/migrate.ts status   # Show migration status
 *
 * Uses environment variables from .env for database connection.
 * Never hardcodes credentials.
 *
 * @story R-P1-08
 */

import * as path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { MigrationRunner } from "../lib/migrator";
import { logger } from "../lib/logger";

dotenv.config();

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

async function main(): Promise<void> {
  const command = process.argv[2];

  if (!command || !["up", "down", "status"].includes(command)) {
    logger.error(
      { usage: "npx ts-node server/scripts/migrate.ts <up|down|status>" },
      "Invalid or missing command",
    );
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  const runner = new MigrationRunner(connection, MIGRATIONS_DIR);

  try {
    switch (command) {
      case "up": {
        const result = await runner.up();
        if (result.applied.length === 0) {
          logger.info("No pending migrations. Database is up to date.");
        } else {
          logger.info(
            { applied: result.applied },
            `Applied ${result.applied.length} migration(s)`,
          );
        }
        break;
      }

      case "down": {
        const result = await runner.down();
        if (result.rolledBack) {
          logger.info(
            { rolledBack: result.rolledBack },
            `Rolled back: ${result.rolledBack}`,
          );
        } else {
          logger.info("No migrations to roll back.");
        }
        break;
      }

      case "status": {
        const status = await runner.status();
        logger.info({ status }, "Migration status");

        if (status.checksumMismatches.length > 0) {
          logger.warn(
            { mismatches: status.checksumMismatches },
            "Checksum mismatches detected. Migration files may have been modified after being applied.",
          );
        }
        break;
      }
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  logger.error({ err }, "Migration failed");
  process.exit(1);
});
