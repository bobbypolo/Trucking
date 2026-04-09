#!/bin/bash
# demo-entrypoint.sh — Docker demo backend entrypoint
# Waits for MySQL, runs migrations, seeds demo data, starts the server.
set -e

echo "[demo] Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
for i in $(seq 1 60); do
  if node -e "
    const mysql = require('mysql2/promise');
    mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    }).then(c => { c.end(); process.exit(0); }).catch(() => process.exit(1));
  " 2>/dev/null; then
    echo "[demo] MySQL is ready."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "[demo] ERROR: MySQL did not become ready in 60 seconds."
    exit 1
  fi
  echo "[demo] Waiting for MySQL... ($i/60)"
  sleep 2
done

echo "[demo] Running migrations..."
node server/scripts/apply-all-migrations.cjs
echo "[demo] Migrations complete."

echo "[demo] Resetting demo tenant (idempotent)..."
npx ts-node --transpile-only server/scripts/reset-sales-demo.ts || true
echo "[demo] Seeding demo tenant..."
npx ts-node --transpile-only server/scripts/seed-sales-demo.ts
echo "[demo] Seed complete."

echo "[demo] Starting server on port ${PORT:-5000}..."
exec node server/dist/index.js
