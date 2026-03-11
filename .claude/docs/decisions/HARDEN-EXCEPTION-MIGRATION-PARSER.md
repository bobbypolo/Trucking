# HARDEN-EXCEPTION-MIGRATION-PARSER

Status: Follow-up required
Priority: Medium
Date: 2026-03-11

## Why this exists

The local auth/runtime enablement sprint is functionally closed, but the migration runner still emits parse warnings when applying `server/migrations/exception_management.sql`.

This is not blocking the completed sprint closeout:

- local MySQL booted successfully
- backend auth/runtime validation passed
- browser login passed
- `/api/users`, `/api/auth/login`, and `/api/users/me` returned expected success codes

## Remaining issue

`server/scripts/apply-all-migrations.cjs` reports repeated parse warnings while processing `server/migrations/exception_management.sql`.

Current interpretation:

- non-blocking for local auth/runtime closure
- still a migration hygiene / hardening defect
- should be fixed before making broader rollout-hardening claims

## Required follow-up

1. Identify the exact statements in `server/migrations/exception_management.sql` that the current runner splits incorrectly.
2. Determine whether the problem is:
   - migration SQL syntax that depends on delimiters/procedures
   - the simplistic semicolon-based splitter in `server/scripts/apply-all-migrations.cjs`
   - both
3. Update the migration file or runner so `exception_management.sql` applies without parse warnings.
4. Re-run the migration pass and capture clean output.

## Done when

- `node server/scripts/apply-all-migrations.cjs` completes without parse warnings from `exception_management.sql`
- exception-related tables and seed rows still exist and remain correct
- no regression is introduced in the local auth/runtime proof path
