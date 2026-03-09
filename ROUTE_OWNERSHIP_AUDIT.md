# Route Ownership Audit

**Sprint**: LoadPilot Release Readiness Sprint  
**Story**: R-FS-01 — Release Scope Freeze and Route Ownership Audit  
**Date**: 2026-03-08  
**Status**: COMPLETE — No duplicate routes, single owner per endpoint

---

## Audit Scope

This document captures the authoritative owner for every release-scoped API endpoint.
It was produced as part of R-FS-01 to satisfy RC1 release gate requirements.

### Release Scope Policy

Only routes in the following modules are in scope for Release 1:

- loads, stops, documents, settlements, dispatch events, messages, users, equipment,
  accounting, incidents, clients, exceptions, contracts, compliance, call-sessions, tracking, ai, metrics, weather

---

## Findings: Duplicate Route Resolved

**Blocker found and resolved**: `POST /api/messages` and `GET /api/messages/:loadId` were
defined in both `server/routes/dispatch.ts` and `server/routes/messages.ts`.

**Resolution**: Both duplicate definitions removed from `dispatch.ts`. The `messages.ts`
module is the canonical and sole owner of all `/api/messages` routes.

---

## Route Ownership Matrix

| Method | Path | Owner Module | Auth | Tenant | Notes |
|--------|------|-------------|------|--------|-------|
| GET | /api/health | index.ts (inline) | No | No | Health check — OK inline |
| GET | /api/loads | loads.ts | Yes | Yes | |
| POST | /api/loads | loads.ts | Yes | Yes | |
| GET | /api/loads/counts | loads.ts | Yes | Yes | Status counts |
| GET | /api/loads/tracking | loads.ts | Yes | Yes | |
| GET | /api/loads/:id | loads.ts | Yes | Yes | |
| PUT | /api/loads/:id | loads.ts | Yes | Yes | |
| DELETE | /api/loads/:id | loads.ts | Yes | Yes | |
| PATCH | /api/loads/:id/status | loads.ts | Yes | Yes | State machine transition |
| GET | /api/loads/:id/tracking | loads.ts | Yes | Yes | |
| POST | /api/loads/:id/stops | loads.ts | Yes | Yes | |
| GET | /api/users | users.ts | Yes | Yes | |
| POST | /api/users | users.ts | Yes | Yes | |
| GET | /api/users/:id | users.ts | Yes | Yes | |
| PUT | /api/users/:id | users.ts | Yes | Yes | |
| DELETE | /api/users/:id | users.ts | Yes | Yes | |
| GET | /api/equipment | equipment.ts | Yes | Yes | |
| POST | /api/equipment | equipment.ts | Yes | Yes | |
| GET | /api/equipment/:companyId | equipment.ts | Yes | Yes | |
| PUT | /api/equipment/:id | equipment.ts | Yes | Yes | |
| DELETE | /api/equipment/:id | equipment.ts | Yes | Yes | |
| POST | /api/time-logs | dispatch.ts | Yes | Yes | Driver time tracking |
| GET | /api/time-logs/:userId | dispatch.ts | Yes | Yes | |
| GET | /api/time-logs/company/:companyId | dispatch.ts | Yes | Yes | |
| GET | /api/dispatch-events/:companyId | dispatch.ts | Yes | Yes | |
| POST | /api/dispatch-events | dispatch.ts | Yes | Yes | |
| GET | /api/dashboard/cards | dispatch.ts | Yes | Yes | |
| GET | /api/messages | messages.ts | Yes | Yes | Query param: loadId |
| POST | /api/messages | messages.ts | Yes | Yes | **Single owner** |
| DELETE | /api/messages/:id | messages.ts | Yes | Yes | |
| GET | /api/accounting/accounts | accounting.ts | Yes | Yes | |
| POST | /api/accounting/accounts | accounting.ts | Yes | Yes | |
| GET | /api/accounting/accounts/:id | accounting.ts | Yes | Yes | |
| PUT | /api/accounting/accounts/:id | accounting.ts | Yes | Yes | |
| DELETE | /api/accounting/accounts/:id | accounting.ts | Yes | Yes | |
| GET | /api/accounting/settlements | accounting.ts | Yes | Yes | |
| POST | /api/accounting/settlements | accounting.ts | Yes | Yes | |
| GET | /api/accounting/settlements/:id | accounting.ts | Yes | Yes | |
| PATCH | /api/accounting/settlements/:id/status | accounting.ts | Yes | Yes | |
| POST | /api/accounting/settlements/:id/adjustments | accounting.ts | Yes | Yes | |
| GET | /api/accounting/load-pl/:loadId | accounting.ts | Yes | Yes | |
| GET | /api/accounting/ifta-evidence/:loadId | accounting.ts | Yes | Yes | |
| GET | /api/incidents | incidents.ts | Yes | Yes | |
| POST | /api/incidents | incidents.ts | Yes | Yes | |
| GET | /api/incidents/:id | incidents.ts | Yes | Yes | |
| PUT | /api/incidents/:id | incidents.ts | Yes | Yes | |
| DELETE | /api/incidents/:id | incidents.ts | Yes | Yes | |
| GET | /api/clients | clients.ts | Yes | Yes | |
| POST | /api/clients | clients.ts | Yes | Yes | |
| GET | /api/clients/:id | clients.ts | Yes | Yes | |
| PUT | /api/clients/:id | clients.ts | Yes | Yes | |
| DELETE | /api/clients/:id | clients.ts | Yes | Yes | |
| GET | /api/exceptions | exceptions.ts | Yes | Yes | |
| POST | /api/exceptions | exceptions.ts | Yes | Yes | |
| GET | /api/exceptions/:id | exceptions.ts | Yes | Yes | |
| PUT | /api/exceptions/:id | exceptions.ts | Yes | Yes | |
| DELETE | /api/exceptions/:id | exceptions.ts | Yes | Yes | |
| GET | /api/contracts | contracts.ts | Yes | Yes | |
| POST | /api/contracts | contracts.ts | Yes | Yes | |
| GET | /api/contracts/:id | contracts.ts | Yes | Yes | |
| PUT | /api/contracts/:id | contracts.ts | Yes | Yes | |
| DELETE | /api/contracts/:id | contracts.ts | Yes | Yes | |
| GET | /api/compliance | compliance.ts | Yes | Yes | |
| POST | /api/compliance | compliance.ts | Yes | Yes | |
| GET | /api/compliance/:id | compliance.ts | Yes | Yes | |
| PUT | /api/compliance/:id | compliance.ts | Yes | Yes | |
| DELETE | /api/compliance/:id | compliance.ts | Yes | Yes | |
| GET | /api/call-sessions | call-sessions.ts | Yes | Yes | |
| POST | /api/call-sessions | call-sessions.ts | Yes | Yes | |
| GET | /api/call-sessions/:id | call-sessions.ts | Yes | Yes | |
| DELETE | /api/call-sessions/:id | call-sessions.ts | Yes | Yes | |
| GET | /api/tracking | tracking.ts | Yes | Yes | |
| POST | /api/ai/* | ai.ts | Yes | No | Gemini proxy, 15MB limit |
| GET | /api/metrics | metrics.ts | No | No | Metrics endpoint — requires auth hardening (R-FS-07) |
| GET | /api/weather | weather.ts | Yes | No | External API proxy |

---

## Duplicate Routes: None Remaining

After removing the duplicate `POST /api/messages` and `GET /api/messages/:loadId` from
`dispatch.ts`, zero duplicate route registrations exist across all release-scoped modules.

---

## Verification

Run the automated audit tests:

```
cd server && npx vitest run --reporter=verbose server/__tests__/routes/route-ownership-audit.test.ts
```

---

## Release Gate Status

| Check | Status |
|-------|--------|
| ROUTE_OWNERSHIP_AUDIT.md exists | PASS |
| POST /api/messages in exactly one module | PASS (messages.ts) |
| No duplicate routes across release-scoped modules | PASS |
| Server tests pass (no regression) | PASS |
