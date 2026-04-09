Trucker App Sprint A - IFTA Audit Packet Export MVP

Status: Dispatch-ready after the Phase -1 entry gate in `docs/trucker-app-entry-gate.md` is completed and BSD is merged to `main`.

Branch at dispatch time: `ralph/trucker-app-sprint-a`

Scope of this sprint: implement the first executable trucker-app phase from the master plan without waiting for the monorepo move. This sprint is intentionally pre-monorepo and web/backend-only so the highest-ROI owner-operator feature ships before the repo restructure.

---
## System Context

The current web SaaS already contains the underlying IFTA data needed for a first audit-packet feature:

- mileage evidence and jurisdiction splits already exist in the accounting domain
- fuel purchases and receipt-backed ledger data already exist in the accounting domain
- the product already has document storage and download primitives
- the research and strategy memos both locked "audit packet export first" as the lowest-risk, highest-ROI trucker-app feature

This sprint must remain compatible with the current pre-monorepo layout:

- frontend paths stay under root `components/`, `services/`, and `src/__tests__/`
- backend paths stay under `server/`
- no file move into `apps/web/` or `packages/shared/` occurs in this sprint

Dependencies that must already be true before dispatch:

1. `ralph/pre-demo-remediation` is merged to `main`
2. `ralph/bulletproof-sales-demo` is merged to `main`
3. the entry gate doc is filled out with actual commit SHAs, CI state, and account owner decisions

Discovery evidence:

```text
rg -n "IFTAManager|financialService|documents|fuel_ledger|mileage_jurisdiction|ifta" components services server
components/IFTAManager.tsx:1:import React, { useState, useEffect } from 'react';
services/financialService.ts:1:import { apiFetch } from './api';
server/routes/accounting.ts:878:router.get('/ifta/reports', requireAuth, requireTenant, async (req, res) => {
server/routes/documents.ts:141:router.post('/', requireAuth, upload.single('file'), async (req, res) => {
```

---
## Prime Directive

Ship the audit packet feature as a bounded additive capability:

- no monorepo move
- no React Native app work
- no new compliance categories beyond IFTA
- no refactor of the existing accounting domain
- no new AI prompt work

The outcome is simple: a fleet user can generate, verify, list, and download an IFTA audit packet from the existing web app, and the backend starts collecting invoice-aging data needed later for broker credit.

---
## Hard Rules

1. Only files listed in this sprint plan may be edited.
2. All backend changes are additive. Existing accounting endpoints must continue to work unchanged.
3. The packet generator must produce deterministic output for the same seeded input.
4. The feature must work in the current repo layout. Do not front-run the monorepo migration in this sprint.
5. Packet verification must fail closed on hash mismatch. A corrupted or modified packet must never report as verified.

---
## Phase 1 - IFTA Audit Packet Export MVP (module)

**Phase Type**: `module`

Goal: after this phase, the existing web app can generate an IFTA audit packet ZIP for a requested quarter and tax year, list previously generated packets, verify packet integrity by hash, and download the packet from the UI. The backend also starts collecting invoice-aging data for later broker-credit work.

### Changes

| Action | File | Description | Test File | Test Type |
| --- | --- | --- | --- | --- |
| CREATE | `server/migrations/051_ifta_audit_packets.sql` | Add `ifta_audit_packets` table with packet metadata and signed-download fields. | `server/__tests__/migrations/051_ifta_audit_packets.test.ts` | unit |
| CREATE | `server/migrations/052_invoices_aging_tracking.sql` | Add `days_since_issued` and `last_aging_snapshot_at` columns used by the nightly collection job. | `server/__tests__/migrations/052_invoices_aging_tracking.test.ts` | unit |
| CREATE | `server/routes/ifta-audit-packets.ts` | Add `POST`, `GET`, and `verify` handlers under `/api/accounting/ifta-audit-packets`. | `server/__tests__/routes/ifta-audit-packets.test.ts` | integration |
| CREATE | `server/services/ifta-audit-packet.service.ts` | Generate `cover-letter.pdf`, `jurisdiction-summary.csv`, `fuel-ledger.csv`, and `packet_hash`. | `server/__tests__/services/ifta-audit-packet.service.test.ts` | unit |
| CREATE | `server/jobs/invoice-aging-nightly.ts` | Backfill `days_since_issued` and `last_aging_snapshot_at` for invoices. | `server/__tests__/jobs/invoice-aging-nightly.test.ts` | integration |
| MODIFY | `server/index.ts` | Mount the new `/api/accounting/ifta-audit-packets` router. | `server/__tests__/routes/ifta-audit-packets.test.ts` | integration |
| MODIFY | `server/package.json` | Add `jszip` and the chosen PDF helper dependency for `ifta-audit-packet.service.ts`. | `server/__tests__/services/ifta-audit-packet.service.test.ts` | unit |
| MODIFY | `components/IFTAManager.tsx` | Add `"Generate Audit Packet"` UI, quarter/year selectors, status area, and download action. | `src/__tests__/components/IFTAManager.audit-packet.test.tsx` | integration |
| MODIFY | `services/financialService.ts` | Add typed methods `generateIftaAuditPacket`, `listIftaAuditPackets`, `getIftaAuditPacket`, and `verifyIftaAuditPacket`. | `src/__tests__/services/financialService.ifta-audit-packet.test.ts` | unit |
| CREATE | `server/__tests__/migrations/051_ifta_audit_packets.test.ts` | Assert `UP` creates `ifta_audit_packets` and `DOWN` reverses only that table. | `server/__tests__/migrations/051_ifta_audit_packets.test.ts` | unit |
| CREATE | `server/__tests__/migrations/052_invoices_aging_tracking.test.ts` | Assert `UP` adds exactly `2` invoice-aging columns and `DOWN` removes only those `2` columns. | `server/__tests__/migrations/052_invoices_aging_tracking.test.ts` | unit |
| CREATE | `server/__tests__/routes/ifta-audit-packets.test.ts` | Assert `201`, `400`, `200`, and `409` flows for create, list, show, and verify. | `server/__tests__/routes/ifta-audit-packets.test.ts` | integration |
| CREATE | `server/__tests__/services/ifta-audit-packet.service.test.ts` | Assert `bundleAuditPacket()` ZIP entry names, deterministic `computePacketHash()` output, and `cover-letter.pdf` content. | `server/__tests__/services/ifta-audit-packet.service.test.ts` | unit |
| CREATE | `server/__tests__/jobs/invoice-aging-nightly.test.ts` | Assert seeded invoice rows get non-null `last_aging_snapshot_at` values and positive `days_since_issued` counts. | `server/__tests__/jobs/invoice-aging-nightly.test.ts` | integration |
| CREATE | `src/__tests__/components/IFTAManager.audit-packet.test.tsx` | Assert `IFTAManager.tsx` calls the packet API and renders the returned `packetHash` and download action. | `src/__tests__/components/IFTAManager.audit-packet.test.tsx` | integration |
| CREATE | `src/__tests__/services/financialService.ifta-audit-packet.test.ts` | Assert the `4` packet client methods in `services/financialService.ts` hit the documented routes. | `src/__tests__/services/financialService.ifta-audit-packet.test.ts` | unit |

### Files Not Touched

- `apps/trucker/`
- `packages/shared/`
- `components/Scanner.tsx`
- `server/routes/ai.ts`
- `server/routes/loads.ts`
- `server/routes/driver-compliance.ts`

### API Contracts

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| POST | `/api/accounting/ifta-audit-packets` | `{ "quarter": 4, "taxYear": 2025, "includeDocuments": true }` | `201 { "packetId": "...", "status": "generated", "packetHash": "<64 hex>", "downloadUrl": "..." }` |
| GET | `/api/accounting/ifta-audit-packets` | none | `200 { "packets": [ ... ] }` |
| GET | `/api/accounting/ifta-audit-packets/:packetId` | none | `200 { "packetId": "...", "quarter": 4, "taxYear": 2025, "status": "generated", "packetHash": "<64 hex>", "downloadUrl": "..." }` |
| POST | `/api/accounting/ifta-audit-packets/:packetId/verify` | none | `200 { "verified": true, "packetHash": "<64 hex>" }` or `409 { "error": "HASH_MISMATCH" }` |

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File |
| --- | --- | --- | --- | --- |
| Migration structure for `051_ifta_audit_packets.sql` and `052_invoices_aging_tracking.sql` | unit | Real | Assert `UP` contains the named columns and `DOWN` removes only those artifacts. | `server/__tests__/migrations/051_ifta_audit_packets.test.ts` |
| Packet service ZIP assembly and hash determinism | unit | Real + Mock | Assert `zipEntries == ["cover-letter.pdf", "fuel-ledger.csv", "jurisdiction-summary.csv", "manifest.json"]` and `hash1 == hash2`. | `server/__tests__/services/ifta-audit-packet.service.test.ts` |
| API create/list/show/verify flows | integration | Real + Mock | Assert `response.status == 201`, invalid quarter returns `400`, verify success returns `200`, and corrupted bytes return `409`. | `server/__tests__/routes/ifta-audit-packets.test.ts` |
| Invoice-aging nightly job | integration | Real + Mock | Assert `days_since_issued > 0` and `last_aging_snapshot_at is not None` for each seeded invoice row. | `server/__tests__/jobs/invoice-aging-nightly.test.ts` |
| Existing web UI packet flow in `IFTAManager.tsx` | integration | Mock | Assert the click handler calls `generateIftaAuditPacket(...)` once and the rendered screen includes the returned `packetHash`. | `src/__tests__/components/IFTAManager.audit-packet.test.tsx` |
| Manual smoke in current web app | manual | Real | Assert a real `Q4 2025` packet downloads as `.zip` and opens with at least `4` files. | `docs/trucker-app-entry-gate.md` |

Acceptance criteria (R-markers):

- R-P1-01 [backend] [unit]: `server/migrations/051_ifta_audit_packets.sql` creates exactly `1` table named `ifta_audit_packets` with at least the `9` named columns `id`, `company_id`, `quarter`, `tax_year`, `status`, `packet_hash`, `download_url`, `created_by`, and `created_at`.
- R-P1-02 [backend] [unit]: the DOWN section of `server/migrations/051_ifta_audit_packets.sql` drops exactly `1` table, `ifta_audit_packets`, and does not drop or rename any pre-existing table.
- R-P1-03 [backend] [unit]: `server/migrations/052_invoices_aging_tracking.sql` adds exactly `2` columns, `days_since_issued` and `last_aging_snapshot_at`, to the invoice-aging source table and the DOWN section removes only those `2` columns.
- R-P1-04 [backend] [integration]: `POST /api/accounting/ifta-audit-packets` with body `{ "quarter": 4, "taxYear": 2025, "includeDocuments": true }` returns `201` and a JSON body containing `packetId`, `status: "generated"`, a 64-character `packetHash`, and a non-empty `downloadUrl`.
- R-P1-05 [backend] [integration]: `POST /api/accounting/ifta-audit-packets` with invalid body `{ "quarter": 5, "taxYear": 2025 }` returns `400` and an error message containing the quoted field name `"quarter"`.
- R-P1-06 [backend] [unit]: `bundleAuditPacket()` produces a ZIP buffer containing exactly `4` top-level entries: `cover-letter.pdf`, `jurisdiction-summary.csv`, `fuel-ledger.csv`, and `manifest.json`.
- R-P1-07 [backend] [unit]: `computePacketHash()` returns the same 64-character SHA-256 hex string for the same packet bytes across 2 consecutive calls.
- R-P1-08 [backend] [integration]: `POST /api/accounting/ifta-audit-packets/:packetId/verify` returns `200 { "verified": true }` when the stored packet bytes match the saved `packet_hash`.
- R-P1-09 [backend] [integration]: `POST /api/accounting/ifta-audit-packets/:packetId/verify` returns `409 { "error": "HASH_MISMATCH" }` when the stored packet bytes are modified after generation.
- R-P1-10 [backend] [integration]: running `server/jobs/invoice-aging-nightly.ts` against 3 seeded invoices updates `days_since_issued` to values greater than `0` and writes a non-null `last_aging_snapshot_at`.
- R-P1-11 [frontend] [unit]: `services/financialService.ts` exports the 4 methods `generateIftaAuditPacket`, `listIftaAuditPackets`, `getIftaAuditPacket`, and `verifyIftaAuditPacket`.
- R-P1-12 [frontend] [integration]: `components/IFTAManager.tsx` renders a button labeled `"Generate Audit Packet"`, a quarter selector with values `1` through `4`, and a tax-year selector seeded to the current year.
- R-P1-13 [frontend] [integration]: clicking `"Generate Audit Packet"` with selected values `Q4` and `2025` calls `generateIftaAuditPacket({ quarter: 4, taxYear: 2025, includeDocuments: true })` exactly once.
- R-P1-14 [frontend] [integration]: after a successful packet generation response, `IFTAManager.tsx` renders the returned 64-character `packetHash` and a clickable download action pointing at `downloadUrl`.
- R-P1-15 [manual] [integration]: in the current web app, generating a `Q4 2025` packet for a seeded company downloads a `.zip` file that opens successfully and contains at least 4 files, including `cover-letter.pdf` and `jurisdiction-summary.csv`.

Verification command:

```bash
bash -c "cd server && npx vitest run __tests__/migrations/051_ifta_audit_packets.test.ts __tests__/migrations/052_invoices_aging_tracking.test.ts __tests__/services/ifta-audit-packet.service.test.ts __tests__/routes/ifta-audit-packets.test.ts __tests__/jobs/invoice-aging-nightly.test.ts && cd .. && npx vitest run src/__tests__/components/IFTAManager.audit-packet.test.tsx src/__tests__/services/financialService.ifta-audit-packet.test.ts"
```

---
## Dispatch Notes

1. This sprint intentionally runs before the monorepo move. Do not combine it with Phase 0.
2. After this sprint merges, the next trucker-app dispatch artifact should be the monorepo/bootstrap sprint, not the mobile document-intake sprint.
3. At dispatch time, copy this file to `.claude/docs/PLAN.md`, run `python .claude/hooks/prd_generator.py --plan .claude/docs/PLAN.md --output .claude/prd.json`, then run the normal Ralph loop.
