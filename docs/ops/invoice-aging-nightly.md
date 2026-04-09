# Invoice Aging Nightly Job — Runbook

This runbook covers operation of the invoice aging nightly job
(`scripts/invoice-aging-nightly.cjs`), which computes `days_since_issued`
and `aging_bucket` for every AR invoice and writes the results back to
the `ar_invoices` table.

## Dry-run

Verify the wrapper is reachable and exits cleanly without touching the
database:

```bash
node scripts/invoice-aging-nightly.cjs --dry-run
```

Expected output: `{"status":"dry-run"}` with exit code 0.

## Production invocation

Set `DATABASE_URL` to the production MySQL connection string and run:

```bash
DATABASE_URL="mysql://user:pass@host:3306/loadpilot" \
  node scripts/invoice-aging-nightly.cjs
```

The wrapper validates `DATABASE_URL` is present before dispatching the
job. On success it prints `{"status":"ok","message":"job dispatched"}`
and exits 0.

## Idempotency

The job is fully idempotent. Running it multiple times for the same
calendar day produces the same `days_since_issued` values and overwrites
`last_aging_snapshot_at` with the latest run timestamp. There is no
harm in re-running after a partial failure.

## Failure alerting

- **Exit code 1** with `{"error":"missing_database_url"}` on stderr
  indicates the `DATABASE_URL` environment variable was not set.
- **Exit code 1** with a stack trace on stderr indicates a database
  connection or query failure.
- Wire the exit code into your scheduler's alerting (cron mail, GitHub
  Actions failure notification, or Sentry via the server-side init).

## Cron example

Run nightly at 02:00 UTC:

```cron
0 2 * * * DATABASE_URL="mysql://user:pass@host:3306/loadpilot" node /opt/loadpilot/scripts/invoice-aging-nightly.cjs >> /var/log/invoice-aging.log 2>&1
```

## GitHub Actions example

```yaml
name: Invoice Aging Nightly
on:
  schedule:
    - cron: "0 2 * * *"
jobs:
  aging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: node scripts/invoice-aging-nightly.cjs
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## Rollback

If the job produces incorrect aging data:

1. Identify affected invoices via:
   ```sql
   SELECT id, days_since_issued, aging_bucket, last_aging_snapshot_at
   FROM ar_invoices
   WHERE last_aging_snapshot_at >= '<bad-run-timestamp>';
   ```
2. Reset the aging columns to NULL:
   ```sql
   UPDATE ar_invoices
   SET days_since_issued = NULL,
       aging_bucket = NULL,
       last_aging_snapshot_at = NULL
   WHERE last_aging_snapshot_at >= '<bad-run-timestamp>';
   ```
3. Fix the root cause, then re-run the job to recompute correct values.

The `aging_bucket` and `days_since_issued` columns are purely derived
data. Nulling them out has no side effects on other tables or business
logic; downstream features degrade gracefully when these columns are
NULL.
