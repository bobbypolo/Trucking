# LoadPilot Trucker App Migration Numbering

This document defines the migration numbering conventions used across the LoadPilot trucker app. Consistent numbering prevents conflicts when multiple sprints or agents produce migrations concurrently.

## Placeholder convention

The master program plan (`docs/PLAN-trucker-app-master.md`) uses the placeholder token `<NEXT>` in migration file paths when the exact sequence number is not yet assigned. Placeholders are resolved before a sprint is dispatched to Ralph.

Rules:

1. A sprint plan MUST NOT contain unresolved `<NEXT>` tokens at dispatch time. Ralph halts if it encounters `<NEXT>` in any file path.
2. Placeholder resolution is a one-time, pre-dispatch step performed by the operator. Once a number is assigned, it is final for that sprint.
3. The resolved numbers are recorded in the sprint plan's "Migration-number management" section (e.g., "053 = `invoices_aging_bucket`").
4. Numbers are sequential with no gaps. If a migration is removed before merge, its number is NOT reused -- the next sprint starts from the highest committed migration + 1.

Current state (as of Sprint B1):

- Maximum existing migration at B1 dispatch: **052** (`052_invoices_aging_tracking.sql`)
- B1 assignments: **053** (`invoices_aging_bucket`), **054** (`feature_flags`)

## Assignment procedure

To assign the next migration number for a new sprint:

1. Run `node scripts/next-migration-number.cjs` from the repository root.
2. The helper reads `server/migrations/` via `fs.readdirSync`, parses the numeric prefix from each `.sql` filename, and returns `max + 1`.
3. Replace every `<NEXT>` in the sprint's `PLAN.md` with the actual number returned by the helper, incrementing by 1 for each additional migration in the sprint.
4. Commit the resolved plan before creating the Ralph dispatch branch.

Example workflow:

```
$ node scripts/next-migration-number.cjs
Next migration number: 055

# In PLAN.md, replace:
#   server/migrations/<NEXT>_my_table.sql
# with:
#   server/migrations/055_my_table.sql
```
