# Sales Demo E2E Suite

This directory holds the Playwright specs that back the **Bulletproof Sales Demo** sprint. They run end-to-end against a freshly seeded `SALES-DEMO-001` tenant and are invoked by the Windows-safe certification pipeline: `npm run demo:certify:sales`.

## Specs (run in numeric order)

| # | File | Purpose | Backing R-markers |
|---|------|---------|-------------------|
| 00 | `00-smoke.spec.ts` | Bare-minimum smoke: `/api/health` returns 200, app shell renders without 500. Guards the 3 hero specs against catastrophic infra failures before they invest minutes logging in and clicking through modals. | R-P7-04 |
| 01 | `01-document-automation.spec.ts` | Hero load walkthrough — opens the Load Board, clicks `LP-DEMO-RC-001`, asserts broker/commodity/weight/rate/route continuity plus the 3 document cards (rate-con.pdf, bol.pdf, lumper-receipt.pdf). | R-P2-07, R-P2-13 |
| 02 | `02-ifta-walkthrough.spec.ts` | IFTA Evidence Review walkthrough — confirms Q4 2025 fuel receipts, trip miles, and jurisdiction totals render correctly for the seeded tenant. | R-P3-06, R-P3-07 |
| 03 | `03-crm-walkthrough.spec.ts` | CRM / Network Portal depth walkthrough — verifies all 12 seeded parties (brokers, shippers, drivers, receivers) appear in the Network Portal and the hero load routes through ACME Logistics LLC. | R-P4-06, R-P4-07 |

## Required environment (.env.local)

| Variable | Purpose |
|----------|---------|
| `SALES_DEMO_E2E=1` | Master switch — enables every spec in `e2e/sales-demo/`. Keeps the suite out of normal Playwright runs. |
| `E2E_SERVER_RUNNING=1` | Set by `demo-certify.cjs` after the dev server is confirmed listening. Each spec re-checks this to avoid racing startup. |
| `E2E_APP_URL` | Defaults to `http://localhost:3101`. Override for staging. |
| `E2E_API_URL` | Defaults to `http://localhost:5000`. Override for staging. |
| `SALES_DEMO_ADMIN_FIREBASE_UID` | Firebase UID for the seeded admin (required by the seed pipeline from Phase 1). |
| `FIREBASE_WEB_API_KEY` | Needed by the login flow in specs 01–03. If unset they `test.skip` with a clear message. |

## Invocation

### Windows (PowerShell or cmd) — the certified path

```powershell
npm run demo:reset:sales
npm run demo:seed:sales
npm run demo:certify:sales
```

The certify script drives Playwright through all 4 specs, captures stdout to `%TEMP%\sales-demo-cert-<timestamp>.log`, and appends the last 50 lines to `docs/release/evidence.md` under `## Sales Demo Certification`.

### Unix / macOS

```bash
npm run demo:reset:sales
npm run demo:seed:sales
npm run demo:certify:sales
```

`demo-certify.cjs` uses `os.tmpdir()` and `path.join`, so no shell tweaks are required.

### Ad-hoc single spec (debugging)

```bash
SALES_DEMO_E2E=1 E2E_SERVER_RUNNING=1 npx playwright test e2e/sales-demo/00-smoke.spec.ts --headed
```

## Firebase user provisioning prerequisite

Before the first run on a new machine, create the sales-demo admin in the Firebase console (or via the Admin SDK) and export `SALES_DEMO_ADMIN_FIREBASE_UID`. The seed pipeline refuses to run without it (see Phase 1 R-P1-02).
