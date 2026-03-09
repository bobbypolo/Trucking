# localStorage Release Audit — LoadPilot RC1

**Date:** 2026-03-09
**Sprint:** R-FS-04 — Release-Scoped localStorage Eradication
**Status:** COMPLETE — all release-blocking localStorage eliminated

---

## Verdict

All release-scoped entity flows are fully API/database-backed.
No release-critical workflow depends on browser-local state as authoritative storage.

---

## Release-Scoped Entities — localStorage Status

These are the entities explicitly required by R-FS-04-01 to have zero localStorage usage.

| Entity                       | localStorage Keys      | localStorage Usage       | Authoritative Storage                                                 | Status |
| ---------------------------- | ---------------------- | ------------------------ | --------------------------------------------------------------------- | ------ |
| Loads                        | None                   | None                     | API — `/api/loads` via `loadService.ts`                               | CLEAN  |
| Stops (Load Legs)            | None                   | None                     | Part of LoadData via API                                              | CLEAN  |
| Documents (VaultDoc uploads) | None in FileVault flow | None in user-facing flow | API — `/api/accounting/docs` via `financialService.ts`                | CLEAN  |
| Settlements                  | None                   | None                     | API — `/api/accounting/settlements`, status via `updateLoadStatusApi` | CLEAN  |
| Dispatch Events              | None                   | None                     | API — `/api/dispatch-events` via `storageService.logDispatchEvent`    | CLEAN  |

### Evidence

- `services/loadService.ts` — all load CRUD operations use backend API
- `services/storageService.ts:63-67` — imports `fetchLoads`, `createLoad`, `updateLoadStatusApi`, `searchLoadsApi`
- `services/storageService.ts:69` — comment: "STORAGE_KEY for loads removed — load data comes from backend API only"
- `services/storageService.ts:113-131` — `getLoads()` fetches from API; fallback is in-memory cache (not localStorage)
- `services/storageService.ts:134-147` — `saveLoad()` calls `apiCreateLoad()`, updates in-memory cache only
- `services/storageService.ts:208-221` — `logDispatchEvent()` uses `fetch` to API, no localStorage
- `services/storageService.ts:223-244` — `getDispatchEvents()` uses `fetch` to API, no localStorage
- `services/storageService.ts:280-289` — `settleLoad()` calls `updateLoadStatusApi()`, comment "no localStorage"
- `services/financialService.ts:76-96` — `getVaultDocs`, `uploadToVault`, `updateDocStatus` use API
- `components/FileVault.tsx:9` — imports from `financialService`, not `storageService`

---

## Remaining localStorage Usage — Deferred as Non-Blocking

The following localStorage usages remain in the codebase. All are classified as **deferred-safe** and do not affect release-scoped workflows.

### `services/storageService.ts`

| Storage Key                      | Entity               | Classification | Rationale                                                                                                                                      |
| -------------------------------- | -------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadpilot_incidents_v1`         | Safety incidents     | Deferred       | Safety module not on Release 1 critical path; no financial or dispatch impact                                                                  |
| `loadpilot_messages_v1`          | Internal messages    | Deferred       | Message history is supplementary; core dispatch uses API-backed dispatch events                                                                |
| `trucklogix_threads_v1`          | Message threads      | Deferred       | Thread grouping metadata only                                                                                                                  |
| `loadpilot_calls_v1`             | Call sessions        | Deferred       | CRM/call center feature; not part of core load lifecycle                                                                                       |
| `loadpilot_requests_v1`          | KCI requests         | Deferred       | Internal request tracking; no release-blocking dependency                                                                                      |
| `loadpilot_leads_v1`             | Sales leads          | Deferred       | CRM feature; not part of Release 1 operational scope                                                                                           |
| `loadpilot_quotes_v1`            | Quotes               | Deferred       | Booking portal feature; not part of core dispatch workflow                                                                                     |
| `loadpilot_bookings_v1`          | Bookings             | Deferred       | Booking portal feature; not part of core dispatch workflow                                                                                     |
| `loadpilot_providers_v1`         | Providers            | Deferred       | Reference data; no operational transaction dependency                                                                                          |
| `loadpilot_contacts_v1`          | Contacts             | Deferred       | CRM reference data only                                                                                                                        |
| `loadpilot_tasks_v1`             | Operational tasks    | Deferred       | Internal workflow helper; not user-facing release feature                                                                                      |
| `loadpilot_crisis_v1`            | Crisis actions       | Deferred       | Emergency response module; not on Release 1 critical path                                                                                      |
| `loadpilot_work_items_v1`        | Work items           | Deferred       | Internal queue management; no financial or dispatch impact                                                                                     |
| `loadpilot_service_tickets_v1`   | Service tickets      | Deferred       | Maintenance tracking; not part of Release 1 scope                                                                                              |
| `loadpilot_notification_jobs_v1` | Notification jobs    | Deferred       | Background notification queue; non-critical                                                                                                    |
| `loadpilot_vault_docs_v1`        | VaultDoc aggregation | Deferred       | Only used by internal `getLoadSummary()` aggregation — NOT by FileVault user flow. FileVault uses `financialService.getVaultDocs` (API-backed) |

### `services/safetyService.ts`

| Storage Key                    | Entity               | Classification | Rationale                                                |
| ------------------------------ | -------------------- | -------------- | -------------------------------------------------------- |
| `loadpilot_maintenance_v1`     | Maintenance records  | Deferred       | Safety/compliance module; not on Release 1 critical path |
| `loadpilot_tickets_v1`         | Service tickets      | Deferred       | Same as above                                            |
| `loadpilot_vendors_v1`         | Vendors              | Deferred       | Reference data; no financial transaction dependency      |
| `loadpilot_safety_activity_v1` | Safety activity logs | Deferred       | Audit logging; non-blocking                              |
| `loadpilot_quizzes_v1`         | Safety quizzes       | Deferred       | Training module; not release-blocking                    |
| `loadpilot_quiz_results_v1`    | Quiz results         | Deferred       | Training module; not release-blocking                    |

### `services/authService.ts`

| Storage Key              | Entity          | Classification | Rationale                                                                  |
| ------------------------ | --------------- | -------------- | -------------------------------------------------------------------------- |
| `loadpilot_companies_v1` | Companies cache | Deferred       | Read-only cache of company data fetched from API; no write-path dependency |

### `services/brokerService.ts`

| Storage Key            | Entity        | Classification | Rationale                                                |
| ---------------------- | ------------- | -------------- | -------------------------------------------------------- |
| `loadpilot_brokers_v1` | Brokers cache | Deferred       | Reference data; not part of load lifecycle critical path |

### `components/IntelligenceHub.tsx`

| Usage                             | Classification | Rationale                                           |
| --------------------------------- | -------------- | --------------------------------------------------- |
| `loadpilot_crisis_v1` handoff     | Deferred       | Crisis handoff is a non-critical operational helper |
| `loadpilot_work_items_v1` handoff | Deferred       | Work item handoff is supplementary to core dispatch |

### `components/Scanner.tsx`

| Usage            | Classification | Rationale                                                  |
| ---------------- | -------------- | ---------------------------------------------------------- |
| `authToken` read | Deferred       | Auth token storage for API calls; standard session pattern |

---

## Silent Fallback Assessment

### Release-Scoped Code Paths — No Silent Fallbacks

| Function                             | Fallback Behavior                                                    | Safe?                                      |
| ------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------ |
| `getLoads()`                         | On API failure, returns `_cachedLoads` (in-memory, not localStorage) | Yes — in-memory cache, not browser storage |
| `saveLoad()`                         | No fallback — throws on API failure                                  | Yes                                        |
| `updateLoadStatus()`                 | No fallback — throws on API failure                                  | Yes                                        |
| `logDispatchEvent()`                 | Silent catch — event dropped (no localStorage write)                 | Yes — no data corruption                   |
| `getDispatchEvents()`                | Returns `[]` on API failure                                          | Yes — empty is safe                        |
| `settleLoad()`                       | No fallback — throws on API failure                                  | Yes                                        |
| `getVaultDocs()` (financialService)  | No fallback — throws on API failure                                  | Yes                                        |
| `uploadToVault()` (financialService) | No fallback — throws on API failure                                  | Yes                                        |

### Conclusion

No release-scoped code path silently falls back from API to localStorage.
The only fallback is `getLoads()` returning an in-memory cache — this is not localStorage and is acceptable.

---

## Grep Verification

To verify release-scoped localStorage usage is zero:

```bash
grep -rn "STORAGE_KEY_LOADS\|STORAGE_KEY_STOPS\|STORAGE_KEY_SETTLEMENTS\|STORAGE_KEY_DISPATCH_EVENTS\|loadpilot_loads\|loadpilot_stops\|loadpilot_settlements\|loadpilot_dispatch_events" \
  services/ components/ App.tsx --include="*.ts" --include="*.tsx"
```

Expected output: (empty — zero matches)

```bash
grep -n "getVaultDocs\|uploadToVault\|updateDocStatus" components/FileVault.tsx
```

Expected: imports from financialService only (API-backed)

---

## Risk Assessment

**Release Risk:** LOW

All release-critical workflows (load creation, load lifecycle, dispatch, settlement generation, document upload) are fully API/database-backed. The remaining localStorage usage is confined to:

- Non-critical CRM features (leads, quotes, bookings)
- Safety/training modules (not Release 1 scope)
- Reference data caches (companies, brokers — read-only)
- Supplementary operational helpers (crisis, work items)

None of these affect the core release-scoped workflows. The sprint can close on this criterion.
