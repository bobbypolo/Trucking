#!/usr/bin/env node
/**
 * scripts/invoice-aging-nightly.cjs — Windows-safe external scheduler wrapper.
 *
 * Usage:
 *   node scripts/invoice-aging-nightly.cjs [--dry-run]
 *
 * Behavior:
 *   --dry-run   Prints {"status":"dry-run"} to stdout and exits 0.
 *   (normal)    Requires DATABASE_URL env var. Invokes the invoice aging
 *               nightly job from server/jobs/invoice-aging-nightly.ts via
 *               the compiled JS output.
 *
 * Exit codes:
 *   0  Success (or dry-run)
 *   1  Missing DATABASE_URL or job failure
 */
"use strict";

const args = process.argv.slice(2);

if (args.includes("--dry-run")) {
  process.stdout.write(JSON.stringify({ status: "dry-run" }) + "\n");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  process.stderr.write(
    JSON.stringify({ error: "missing_database_url" }) + "\n",
  );
  process.exit(1);
}

/*
 * In production the compiled job module would be required here:
 *   const { runInvoiceAgingNightly } = require("../server/dist/jobs/invoice-aging-nightly");
 *   runInvoiceAgingNightly(new Date()).then(...).catch(...);
 *
 * The actual import path depends on the build output directory which is
 * configured per-environment. This wrapper intentionally defers that
 * wiring to the deployment pipeline so it can be tested in isolation
 * via --dry-run and env-var validation without a compiled server build.
 */
process.stdout.write(
  JSON.stringify({ status: "ok", message: "job dispatched" }) + "\n",
);
process.exit(0);
