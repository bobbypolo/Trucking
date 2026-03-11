/**
 * Path-shim for staging-rehearsal.ts
 *
 * When the gate command is run as `cd server && npx tsx server/scripts/staging-rehearsal.ts`,
 * Node resolves the path relative to the new cwd (server/), resulting in
 * server/server/scripts/staging-rehearsal.ts. This shim re-executes the
 * real script at the correct location.
 *
 * This file exists solely to handle the cd+path combination in the gate command.
 * The canonical script is at server/scripts/staging-rehearsal.ts.
 */

import { spawnSync } from "child_process";
import * as path from "path";

// __dirname when run via tsx resolves to the actual file location:
// F:/Trucking/DisbatchMe/server/server/scripts/
// Real script is 2 levels up: F:/Trucking/DisbatchMe/server/scripts/
const realScript = path.resolve(
  __dirname,
  "..",
  "..",
  "scripts",
  "staging-rehearsal.ts",
);

const args = process.argv.slice(2);
const result = spawnSync("npx", ["tsx", realScript, ...args], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

process.exit(result.status ?? 1);
