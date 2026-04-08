# Sales Demo Seed Contract

Authoritative reset contract for the Bulletproof Sales Demo sprint.
Every row listed here is produced by `npm run demo:reset:sales` (Phase 1
pipeline, independent of `server/scripts/seed-demo.ts`).

## Rows present after reset

After a clean `npm run demo:reset:sales` run, the `SALES-DEMO-001`
tenant contains exactly this starting state:

| Table        | Rows | Notes                                                        |
| ------------ | ---- | ------------------------------------------------------------ |
| `companies`  | 1    | `SALES-DEMO-001`, `subscription_tier='Fleet Core'`, `active` |
| `users`      | 2    | 1 admin + 1 driver, each linked to a Firebase Auth UID       |
| `gl_accounts`| 7    | 1200, 2000, **2200**, 4000, 6100, 6200, **6900** (IFTA pair) |

Phases 2-4 extend this list (hero load + documents, IFTA evidence, CRM
parties). The reset contract for those rows lives next to each phase's
seed module; this document is the Phase 1 baseline.

## Firebase UID env contract

The two MySQL `users` rows are linked to Firebase Auth users via the
`firebase_uid` column. The UIDs are supplied by the salesperson via
environment variables — the seed script FAILS FAST if either is missing.

| Env var                          | Maps to            | Required |
| -------------------------------- | ------------------ | -------- |
| `SALES_DEMO_ADMIN_FIREBASE_UID`  | admin user row     | yes      |
| `SALES_DEMO_DRIVER_FIREBASE_UID` | driver user row    | yes      |

Provisioning steps (before running the seed):

1. Sign in to the Firebase Console for the demo project.
2. Create two Auth users: one for the admin and one for the driver.
   The emails may be `admin@salesdemo-loadpilot.invalid` and
   `driver@salesdemo-loadpilot.invalid` (or any address the salesperson
   controls — the email is purely cosmetic).
3. Copy each user's UID from the Firebase Console.
4. Copy `.env.example.sales-demo` to `.env.local` at the repo root.
5. Paste the two UIDs into `SALES_DEMO_ADMIN_FIREBASE_UID` and
   `SALES_DEMO_DRIVER_FIREBASE_UID` in `.env.local`.
6. Fill in the 5 DB credentials in the same file.

The seed script throws `SALES_DEMO_ADMIN_FIREBASE_UID required` (or the
driver equivalent) when either value is missing — the demo cannot run
without both because the live `requireAuth` middleware looks up the
MySQL user row by `firebase_uid` on every request.

## GL accounts that must exist

Phase 1 seeds exactly 7 GL accounts. Two of them (the IFTA pair) are
REQUIRED by the Phase 3 IFTA walkthrough — without them the live
`POST /api/accounting/ifta-post` handler FK-fails against the
`gl_accounts` table:

| ID        | Number | Name                      | Type      | Purpose                          |
| --------- | ------ | ------------------------- | --------- | -------------------------------- |
| `GL-1200` | 1200   | Accounts Receivable       | Asset     | AR invoices (base)               |
| `GL-2000` | 2000   | Accounts Payable          | Liability | AP bills (base)                  |
| `GL-2200` | 2200   | IFTA Payable              | Liability | **Required for IFTA posting**    |
| `GL-4000` | 4000   | Freight Revenue           | Income    | Load revenue (base)              |
| `GL-6100` | 6100   | Carrier Cost              | Expense   | Driver pay + carrier settlements |
| `GL-6200` | 6200   | Fuel Expense              | Expense   | General fuel purchases           |
| `GL-6900` | 6900   | IFTA Fuel Tax Expense     | Expense   | **Required for IFTA posting**    |

The existing `server/scripts/seed-demo.ts` seeds only the first 5 and
does NOT seed `GL-2200` / `GL-6900`. That is why this sprint builds an
independent pipeline — touching the SaaS `seed-demo.ts` would violate
the prime directive. The independent pipeline is a byte-for-byte
disjoint file set.

## Hidden routes & rationale

The Phase 6 demo-shell nav allowlist hides a small number of routes
that exist in production but are not part of the hero narrative:

| Route key          | Nav label           | Hidden because                               |
| ------------------ | ------------------- | -------------------------------------------- |
| `telematics-setup` | Telematics          | No real provider wired — distracts the demo  |
| `company`          | Company Settings    | SaaS admin surface — irrelevant to buyers    |
| `quotes`           | (no nav entry)      | Known 403 issue; already hidden on main      |

The allowlist is flag-gated (`VITE_DEMO_NAV_MODE=sales`) so production
tenants are byte-for-byte unaffected. Details live in
`docs/sales-demo-runbook.md` (Phase 6).

## Known SaaS follow-ups (out of scope this sprint)

This sprint is LIVE FUNCTIONS ONLY — no SaaS source file is modified
beyond the 3 surgical touches documented in `.claude/docs/PLAN.md`.
Bugs discovered during exploration that would normally be fixed are
captured here as follow-ups, not touched by Phase 1-7:

- **POST `/api/parties`** (`server/routes/clients.ts:797`) attempts to
  INSERT the `entity_class` and `vendor_profile` columns, which do not
  exist in the `parties` table. The existing `GET /api/parties` works
  fine because its query uses `SELECT *`. Phase 4 works around the bug
  by seeding parties directly via SQL instead of calling the POST
  endpoint. This should be filed as a separate SaaS bug ticket.
- **`seed-demo.ts` missing IFTA GL accounts** — the existing
  procedural seed script does not seed `GL-6900` or `GL-2200`, so a
  tenant that only ran `seed-demo.ts` will FK-fail on the live IFTA
  post endpoint. The independent `seed-sales-demo.ts` fixes this for
  the sales demo tenant; the SaaS fix (extending `seed-demo.ts`) is
  deliberately deferred.

## Quotes route disposition

The `/quotes` route (Quotes & Booking) is **hidden** from the
`VITE_DEMO_NAV_MODE=sales` nav allowlist (see Phase 6), NOT deleted.
Production tenants still see the route normally. The allowlist keys
that remain visible in sales-demo mode are exactly:

```
['operations-hub', 'loads', 'calendar', 'network', 'accounting', 'exceptions']
```

**Why hide instead of fix?** The 403 response that previously blocked
Quotes in the stale demo fixture was **environment-specific**, not a
code bug. Root cause: the prior demo tenant's user-to-tenant mapping
in the `tenant_users` bridge table was out of sync with the Firebase
UID claimed by the admin session, so `requireTenant` middleware
correctly rejected the cross-tenant access. The canonical
quote-to-load path itself is healthy (verified in commit `b735d48`
feat: complete hybrid load workflow remediation) and continues to be
covered by the pre-existing quotes regression tests.

**Sprint scope decision.** Re-provisioning a Firebase admin user for
the new `SALES-DEMO-001` tenant and re-seeding the `tenant_users`
bridge for that user is a Phase 1 seed concern, not a Phase 5
regression concern. Phase 5 locks down the **other two** demo-blocker
concerns (SafetyView fake KPI + Fleet Map env-var leak) with
component-level regression tests. The Quotes route is removed from
the salesperson's view entirely by the Phase 6 nav allowlist so the
403 path cannot be exercised during a live demo. If a salesperson
reaches the route via a direct URL, the existing `requireTenant`
middleware's 403 response is the correct production behavior.

**Follow-up (out of scope this sprint).** Fixing the environment-
specific `tenant_users` mapping so Quotes works inside the sales-demo
tenant as a live hero path is a separate story; it would require a
new seed helper plus a Firebase user provisioning step, and was
deliberately descoped to keep this sprint live-functions-only.
