#!/usr/bin/env ts-node
/**
 * CLI runner for reconciliation jobs.
 *
 * Usage:
 *   npx ts-node scripts/reconcile.ts --company <company_id>
 *
 * Runs all reconciliation checks for the specified tenant and prints
 * a structured JSON report to stdout.
 *
 * @story R-P4-03
 */

import { runReconciliation } from "../services/reconciliation.service";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const companyIdx = args.indexOf("--company");

  if (companyIdx === -1 || !args[companyIdx + 1]) {
    console.error(
      "Usage: npx ts-node scripts/reconcile.ts --company <company_id>",
    );
    process.exit(1);
  }

  const companyId = args[companyIdx + 1];

  // In production, this would use the real Firebase Storage adapter.
  // For CLI usage, provide a stub that warns about needing real credentials.
  const storageAdapter = {
    async listObjects(tenantPrefix: string): Promise<string[]> {
      console.warn(
        `WARN: Using stub storage adapter — Firebase Storage listing for prefix '${tenantPrefix}' skipped. ` +
          "Set GOOGLE_APPLICATION_CREDENTIALS to enable real storage reconciliation.",
      );
      return [];
    },
  };

  try {
    const report = await runReconciliation(companyId, storageAdapter);
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.isClean ? 0 : 1);
  } catch (error) {
    console.error("Reconciliation failed:", error);
    process.exit(2);
  }
}

main();
