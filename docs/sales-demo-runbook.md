# Bulletproof Sales Demo — Runbook

This runbook is the salesperson-facing operational guide for running the
Bulletproof Sales Demo against a seeded `SALES-DEMO-001` tenant. It covers
the multi-window setup, environment toggles, reset workflow, recovery
procedures, prerequisites, the 6-step demo script, and the optional
"wow" appendix for a live driver upload.

The demo uses **only live production code paths** — there are no mocks,
no shims, and no demo branches inside production handlers. Every "magic
moment" comes from pre-seeded real database rows that the same code
production tenants run reads and renders. The only opt-in surfaces are
two flag-gated production-code touches in `App.tsx` and `server/index.ts`
plus an additive column-alias mapping in `server/repositories/document.repository.ts`.

---

## Two Chrome profiles

Run the demo from **two separate Chrome profiles** so the dispatcher and
driver views never share auth or storage state.

- **Profile A — Dispatcher**: signed in as the sales-demo admin user,
  navigates `localhost:3000` with `VITE_DEMO_NAV_MODE=sales` set in
  `.env.local`. Sidebar is collapsed to the 6 demo nav items.
- **Profile B — Driver**: signed in as the seeded driver user, navigates
  the same `localhost:3000` (driver UI is unaffected by the nav filter).

Pin both profile shortcuts to the taskbar before the demo so switching
between them takes one click — never two.

## Setting demo nav mode (.env.local)

The single source of truth for every sales-demo env var is the project
root `.env.local` file. Copy `.env.example.sales-demo` to `.env.local`
and fill in the placeholders:

```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=loadpilot
DB_PASSWORD=<local password>
DB_NAME=loadpilot_dev
SALES_DEMO_ADMIN_FIREBASE_UID=<provisioned admin uid>
SALES_DEMO_DRIVER_FIREBASE_UID=<provisioned driver uid>
VITE_DEMO_NAV_MODE=sales
ALLOW_DEMO_RESET=1
```

Restart `npm run dev` after editing `.env.local`. The Vite client will
re-read `VITE_DEMO_NAV_MODE` and the React sidebar will collapse to the
demo allowlist on next mount.

## Resetting between demos

Click the **Reset Demo** button in the bottom-left of the sidebar (only
visible when `VITE_DEMO_NAV_MODE=sales` is active and the signed-in user
is the sales-demo admin). The button posts to `POST /api/demo/reset`
which is gated by all four of:

1. `requireAuth` middleware (401 on missing/invalid token)
2. `user.role === "admin"` (403 otherwise)
3. `user.tenantId === "SALES-DEMO-001"` (403 otherwise)
4. `process.env.ALLOW_DEMO_RESET === "1"` (403 otherwise)

A successful reset takes 1-3 seconds and returns `{ ok: true }`. The UI
reloads the load board to pick up the freshly re-seeded hero load
`LP-DEMO-RC-001` and broker `SALES-DEMO-CUST-001`.

CLI fallback if the button does not respond:

```bash
npm run demo:reset:sales
```

## Recovery from accidental URL

If a buyer accidentally types a deep-link URL that hits a non-allowlisted
route (e.g. `/telematics-setup`), do **not** panic — the sidebar nav has
already hidden that route, but the route handler itself still answers. To
recover:

1. Click the LoadPilot logo in the top-left to return to `/operations-hub`.
2. If the page renders an error boundary, click **Reset Demo** to reload
   the load board with seeded state.
3. If neither works, switch to the spare Chrome profile (kept ready as
   the recovery profile) and resume from the last clean step.

Never close the browser mid-demo — the spare profile is the recovery
mechanism.

## Firebase user provisioning prerequisite

Before the first demo, both `SALES_DEMO_ADMIN_FIREBASE_UID` and
`SALES_DEMO_DRIVER_FIREBASE_UID` must point at **already-provisioned**
Firebase Auth users in the project console. The seed pipeline does NOT
create Firebase users — it only writes the matching `firebase_uid`
column on the `users` table rows it inserts.

Steps:

1. Open the Firebase Console → Authentication → Users.
2. Add an admin user (`admin@salesdemo-loadpilot.invalid`) with a
   throwaway password and copy its UID into `.env.local` as
   `SALES_DEMO_ADMIN_FIREBASE_UID`.
3. Add a driver user (`driver@salesdemo-loadpilot.invalid`) and copy
   its UID into `SALES_DEMO_DRIVER_FIREBASE_UID`.
4. Run `npm run demo:seed:sales` once to validate end-to-end.

If either env var is unset, `seedSalesDemo` throws with the exact
required env-var name (verified by R-P1-02).

## Live Gemini disclaimer

The certified demo path uses **zero AI calls**. The hero load
`LP-DEMO-RC-001` is created by the seed pipeline as a real database row
with all the AI-extracted fields stored on the load record in their
normal columns. The salesperson opens the existing load via the live
`LoadBoardEnhanced` component and the live document UI. The "AI-extracted
fields" the buyer sees are real columns the production code reads from
the row the seed wrote.

If the buyer asks "is this live or pre-seeded?", the honest answer is
**pre-seeded by the same code path that runs in production**. The seeded
row is byte-for-byte the shape the live AI extraction would produce.

**Important:** Do NOT present the certified demo as a "live AI demo."
The certified path is deterministic and reproducible because it uses
pre-seeded data. Present it as: "This is our production software running
against real data — the same code and UI your drivers and dispatchers
will use." The optional Wow Appendix below covers live AI extraction
for situations where the salesperson wants to demonstrate that capability.

A separate optional path (see Wow Appendix) lets the salesperson run a
real Gemini extraction live if they want — but the certified script
never depends on it.

## Certified Core demo script (6 steps)

This 6-step sequence is the only path certified by the Phase 7 e2e
suite (R-P7-04 onwards). Stick to it on stage.

1. **Operations Center** — open `/operations-hub`. Show the seeded
   exception count, the load count, and the calendar tile rendering
   real seeded values.
2. **Load Board** — click `Load Board`, find the hero row with load
   number `LP-DEMO-RC-001`. Click into it.
3. **Load Detail** — show the buyer the auto-extracted commodity
   (`Frozen Beef`), weight (`42,500 lbs`), rate (`$3,250`), and the
   Houston TX → Chicago IL route. Open the **Documents** panel and
   show the 3 real PDF cards (`rate-con.pdf`, `bol.pdf`,
   `lumper-receipt.pdf`) — each downloadable.
4. **CRM / Network** — click `Network` in the sidebar. Locate the row
   for `ACME Logistics LLC`. Open the broker — show the buyer the same
   broker is the customer attached to the hero load they just viewed.
5. **IFTA / Accounting** — click `Accounting`, switch to the
   `Fuel & IFTA` tab. Show the auto-computed Q4 2025 jurisdiction
   summary backed by real fuel-ledger and mileage rows.
6. **Reset Demo** — click the Reset Demo button to demonstrate the
   one-click reset flow. The page reloads with the hero load fresh,
   confirming the salesperson can run the demo back-to-back without
   manual cleanup.

## Wow Appendix — Optional live driver upload

For salespeople who want to add a live AI-extraction beat (and accept
the model variability that comes with it), this optional appendix walks
through a real Gemini call.

1. Switch to the driver Chrome profile.
2. Open the driver mobile shell at `/drive`.
3. Click the **Scan Doc** button.
4. Upload the seeded `rate-con.pdf` from
   `server/scripts/sales-demo-fixtures/rate-con.pdf`.
5. Wait for the live Gemini extraction (3-7 seconds).
6. Review the extracted fields and tap **Save Load**.
7. Return to the dispatcher profile, refresh the Load Board, and show
   the buyer the new live-extracted load alongside `LP-DEMO-RC-001`.

This appendix exercises the same production code path that real
customers use. Because Gemini output is non-deterministic, do **not**
rely on this appendix for the certified flow — keep it as a "wow"
flourish to use when the room is engaged and the salesperson has
already nailed the certified script.
