# Remediation Traceability Matrix (RTM)

**Created**: 2026-03-16
**Audit Source**: Full-Scale Production Audit (2026-03-16)
**Approver**: Operator

## Finding-to-Story Mapping

| Finding ID | Severity | Description                                                                                    | Disposition | Story     | Verification Method                                                |
| ---------- | -------- | ---------------------------------------------------------------------------------------------- | ----------- | --------- | ------------------------------------------------------------------ |
| SEC-001    | Critical | Tenant isolation bypass — incident charges (`POST /api/incidents/:id/charges` no tenant check) | IMPLEMENT   | STORY-005 | Cross-tenant negative test returns 404                             |
| SEC-002    | Critical | Tenant isolation bypass — client creation (`POST /api/clients` accepts body `company_id`)      | IMPLEMENT   | STORY-006 | Cross-tenant body injection returns 403; company_id from auth only |
| SEC-003    | High     | No rate limiting on `/api/auth/login`                                                          | IMPLEMENT   | STORY-007 | 11th request in 15min returns 429                                  |
| SEC-004    | High     | No rate limiting on password reset                                                             | IMPLEMENT   | STORY-028 | 4th request in 15min returns 429                                   |
| SEC-005    | Medium   | IFTA pings array unbounded (DoS vector)                                                        | IMPLEMENT   | STORY-029 | >10,000 pings returns 400                                          |
| SEC-006    | Medium   | AI payload limit too high (15MB)                                                               | IMPLEMENT   | STORY-029 | >5MB returns 413                                                   |
| DATA-001   | Critical | Quotes stored in localStorage only                                                             | IMPLEMENT   | STORY-012 | Server-backed CRUD, STORAGE_KEY_QUOTES removed                     |
| DATA-002   | Critical | Leads stored in localStorage only                                                              | IMPLEMENT   | STORY-013 | Server-backed CRUD, STORAGE_KEY_LEADS removed                      |
| DATA-003   | Critical | Bookings stored in localStorage only                                                           | IMPLEMENT   | STORY-014 | Server-backed CRUD, STORAGE_KEY_BOOKINGS removed                   |
| DATA-004   | Critical | Messages/Threads localStorage-primary with fire-and-forget API sync                            | IMPLEMENT   | STORY-015 | Server-authoritative, fire-and-forget removed                      |
| DATA-005   | High     | Call Sessions localStorage-only                                                                | IMPLEMENT   | STORY-016 | Server-backed CRUD, STORAGE_KEY_CALLS removed                      |
| DATA-006   | High     | Tasks/Work Items localStorage-only                                                             | IMPLEMENT   | STORY-016 | Server-backed CRUD, STORAGE_KEY_TASKS/WORK_ITEMS removed           |
| DATA-007   | High     | Crisis Actions localStorage-only (compliance-relevant)                                         | IMPLEMENT   | STORY-017 | Server-backed, append-only audit trail, never deletable            |
| DATA-008   | High     | KCI Requests localStorage-only (audit-relevant)                                                | IMPLEMENT   | STORY-017 | Server-backed, append-only decision_log, never deletable           |
| DATA-009   | High     | Service Tickets localStorage-primary                                                           | IMPLEMENT   | STORY-017 | Server-backed CRUD, lock after close                               |
| DATA-010   | Medium   | Contacts localStorage-only                                                                     | IMPLEMENT   | STORY-018 | Server-backed CRUD, STORAGE_KEY_CONTACTS removed                   |
| DATA-011   | Medium   | Providers localStorage-only                                                                    | IMPLEMENT   | STORY-018 | Server-backed CRUD, STORAGE_KEY_PROVIDERS removed                  |
| DATA-012   | High     | No migration path for existing localStorage data                                               | IMPLEMENT   | STORY-011 | Migration banner, user-triggered import, idempotent                |
| MOCK-001   | High     | Hardcoded Kansas City coordinates (39.1031, -94.5812) in CompanyProfile                        | IMPLEMENT   | STORY-008 | grep returns 0 matches                                             |
| MOCK-002   | High     | Fake time clock history in CompanyProfile                                                      | IMPLEMENT   | STORY-008 | Real API data or EmptyState                                        |
| MOCK-003   | Medium   | "UNSET" placeholder text                                                                       | IMPLEMENT   | STORY-008 | grep returns 0 matches for "UNSET"                                 |
| MOCK-004   | High     | Hardcoded truck "4022A" in DriverMobileHome                                                    | IMPLEMENT   | STORY-009 | grep returns 0 matches                                             |
| MOCK-005   | Medium   | "Default-01" fallback in DriverMobileHome                                                      | IMPLEMENT   | STORY-009 | grep returns 0 matches                                             |
| MOCK-006   | High     | "KCI-USA" hardcoded tenant in Settlements                                                      | IMPLEMENT   | STORY-009 | Uses currentUser.companyId                                         |
| MOCK-007   | Medium   | DEMO_MODE seed data in 7 locations                                                             | IMPLEMENT   | STORY-019 | All seed blocks removed, DEMO_MODE constant retained               |
| MOCK-008   | Medium   | Fake providers (Titan Recovery, Rapid Tire)                                                    | IMPLEMENT   | STORY-019 | grep returns 0 matches                                             |
| MOCK-009   | Medium   | Fake contacts (John Dispatcher, Sarah Broker, 555-0xxx)                                        | IMPLEMENT   | STORY-019 | grep returns 0 matches                                             |
| UX-001     | High     | 45+ "Authority" jargon instances in customer-facing UI                                         | IMPLEMENT   | STORY-020 | grep -ri "Authority" components/ returns 0                         |
| UX-002     | Medium   | "Emergency Sign Out" label                                                                     | IMPLEMENT   | STORY-020 | Changed to "Sign Out"                                              |
| UX-003     | Medium   | "Real-Time Load P&L" (not real-time)                                                           | IMPLEMENT   | STORY-031 | Relabeled "Load P&L"                                               |
| UX-004     | Medium   | "View Live Track" / "Live Asset Tracking" (polling, not live)                                  | IMPLEMENT   | STORY-031 | Relabeled honestly                                                 |
| UX-005     | High     | 26 native browser dialogs (alert/confirm/prompt)                                               | IMPLEMENT   | STORY-021 | grep returns 0 matches for alert(/confirm(/prompt(                 |
| UX-006     | Medium   | No loading/error/empty states on async views                                                   | IMPLEMENT   | STORY-022 | Every async fetch has skeleton/error/empty                         |
| UX-007     | Low      | No form validation / autocomplete attributes                                                   | IMPLEMENT   | STORY-023 | Required fields marked, autocomplete on passwords                  |
| UX-008     | Medium   | Silent API failures (console.warn only)                                                        | IMPLEMENT   | STORY-010 | Visible ConnectionBanner within 30s                                |
| FEAT-001   | Medium   | Equipment update UI exists, no PATCH endpoint                                                  | IMPLEMENT   | STORY-025 | PATCH endpoint with role check                                     |
| FEAT-002   | Medium   | File upload UI exists, no backend                                                              | IMPLEMENT   | STORY-026 | End-to-end upload with Firebase Storage                            |
| FEAT-003   | Medium   | Customer archive button exists, no backend                                                     | IMPLEMENT   | STORY-027 | Soft-delete endpoint with archived_at                              |
| FEAT-004   | Medium   | No "Forgot Password?" flow                                                                     | IMPLEMENT   | STORY-028 | Server-proxied password reset                                      |
| FEAT-005   | Low      | QB Sync returns fake "Sync queued"                                                             | REMOVE      | STORY-030 | Endpoint returns 501, UI hidden                                    |
| FEAT-006   | Low      | IFTA quarterly filing submission (no backend)                                                  | REMOVE      | STORY-030 | UI hidden, no fake success                                         |
| FEAT-007   | Low      | WebSocket tracking claimed but not implemented                                                 | REMOVE      | STORY-030 | Claims removed, polling labeled honestly                           |
| FEAT-008   | Low      | Driver certifications UI (no backend)                                                          | REMOVE      | STORY-030 | UI hidden                                                          |
| FEAT-009   | Low      | Load templates copy UI (no backend)                                                            | REMOVE      | STORY-030 | UI hidden                                                          |
| PERF-001   | Medium   | 2.2MB monolithic JS bundle                                                                     | IMPLEMENT   | STORY-032 | Code splitting, no chunk >500KB gzip                               |
| QUAL-001   | Medium   | 56 TypeScript errors in frontend (tests/scripts)                                               | IMPLEMENT   | STORY-033 | 0 TS errors frontend + server                                      |
| ARCH-001   | Low      | storageService.ts is 2,319-line monolith                                                       | IMPLEMENT   | STORY-004 | Split into domain modules                                          |

## Disposition Summary

| Disposition      | Count | Stories                                                                            |
| ---------------- | ----- | ---------------------------------------------------------------------------------- |
| IMPLEMENT        | 38    | STORY-004 through STORY-029, STORY-031 through STORY-033                           |
| REMOVE_FROM_PROD | 5     | STORY-030 (QB Sync, IFTA filing, WebSocket tracking, driver certs, load templates) |
| DEFER_AND_HIDE   | 0     | —                                                                                  |

## Verification Methods Legend

- **Cross-tenant negative test**: Automated test proving cross-tenant access returns 404/403
- **grep returns 0 matches**: Pattern scan confirms removal
- **Server-backed CRUD**: Full API lifecycle tested (create, read, update, list, archive/delete)
- **UI hidden**: Feature not accessible via any UI path (nav, route, button, badge)
- **Endpoint returns 501**: Explicit "not available" response instead of fake success
