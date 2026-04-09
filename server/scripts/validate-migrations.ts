import path from "path";

async function main(): Promise<void> {
  const { scanMigrationFiles } = await import("../lib/migrator");

  const migrationsDir = path.resolve(__dirname, "../migrations");
  const files = await scanMigrationFiles(migrationsDir);

  let errors = 0;
  const seen = new Set<string>();

  for (const file of files) {
    if (seen.has(file.filename)) {
      console.error("DUPLICATE filename:", file.filename);
      errors++;
    }
    seen.add(file.filename);
  }

  for (const file of files) {
    if (!file.parsed.up && !file.parsed.down) {
      console.error("MISSING both UP and DOWN markers:", file.filename);
      errors++;
    } else if (!file.parsed.up) {
      console.error("MISSING UP marker:", file.filename);
      errors++;
    } else if (!file.parsed.down) {
      console.warn("WARNING: missing DOWN marker:", file.filename);
    }
  }

  console.log("Scanned", files.length, "migration files");
  console.log("Errors:", errors);

  if (errors > 0) {
    process.exit(1);
  }

  console.log("Migration validation passed");
}

main().catch((error) => {
  console.error("Migration validation failed:", error);
  process.exit(1);
});
