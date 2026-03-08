# System-of-Record Matrix

> Generated from analysis of server/schema.sql, server/index.ts, server/firestore.ts, types.ts, and services/storageService.ts.
> Last updated: 2026-03-07 (R-P0-02)

## Legend

| Column               | Meaning                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| Entity               | Table or collection name                                                   |
| Authoritative Source  | Where the canonical data lives today                                       |
| Secondary Source      | Duplicate or fallback copy (if any)                                        |
| Write Owner           | Which layer performs inserts/updates                                        |
| Read Consumers        | Which layer(s) read this data                                              |
| Boundary Rules        | Current enforcement (or lack thereof) around who/what may mutate the entity |
| Recovery Action       | What must change during the recovery program                               |

## 1. Identity and Tenancy

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **companies** | MySQL `companies` | Firestore `companies` collection | Server (POST /api/companies) | Server + Client (via API + Firestore direct) | company_id FK on most tables provides basic tenant scoping. No row-level security. Firestore writes duplicate on create. | Eliminate Firestore dual-write; enforce tenant isolation middleware on all routes |
| **users** | Firestore `users` collection | MySQL `users` table | Server (POST /api/signup, PUT /api/users) | Server (login, auth, search) + Client (Firestore direct reads) | Firebase Auth provides identity; Firestore holds profile. MySQL copy created on signup but Firestore is queried for login. Dual-write on update. | Designate single SOR (MySQL recommended); remove Firestore profile reads from client |

## 2. Customer and Contract Management

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **customers** | MySQL `customers` | localStorage (embedded in load data) | Server (REPLACE INTO /api/customers) | Server + Client | REPLACE INTO allows upsert without conflict check. company_id FK enforced by schema. | Remove localStorage fallback; add tenant-scoped auth middleware |
| **customer_contracts** | MySQL `customer_contracts` | None | Server (REPLACE INTO /api/contracts) | Server + Client | customer_id FK to customers. No status transition enforcement. | Add contract lifecycle validation |

## 3. Equipment

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **equipment** | MySQL `equipment` | None | Server (INSERT /api/equipment) | Server + Client | company_id FK. Status ENUM (Active/Out of Service/Removed) but no transition guard. | Add equipment status state machine on server |

## 4. Load Lifecycle (Core Domain)

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **loads** | MySQL `loads` | localStorage `loadpilot_loads_v1` (storageService.ts) | Server (REPLACE INTO /api/loads, PATCH /api/loads/:id/status) + Client (storageService direct localStorage writes) | Server + Client (dual-read: API with localStorage fallback) | **CRITICAL**: No state machine enforcement. PATCH /api/loads/:id/status accepts ANY status string and writes it directly. Client storageService also writes status to localStorage independently. REPLACE INTO allows full row overwrite without optimistic locking. Schema ENUM has 12 values; types.ts has 15 values (mismatch). | Enforce server-side load state machine (see STATE_MACHINES.md); remove client-side status writes; reconcile ENUM mismatch; add optimistic locking |
| **load_legs** | MySQL `load_legs` | None | Server (INSERT within load transaction) | Server + Client | Cascade-deleted when parent load deleted. sequence_order tracks stop ordering. | Keep as-is; add validation for sequence integrity |

## 5. Dispatch and Communication

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **dispatch_events** | MySQL `dispatch_events` | None | Server (INSERT on status change, manual note) | Server + Client | Append-only audit log. dispatcher_id + load_id FKs. Created automatically on PATCH /api/loads/:id/status. | Keep append-only pattern; add event_type validation |
| **messages** | MySQL `messages` | localStorage `loadpilot_messages_v1` | Server (INSERT /api/messages) + Client (localStorage writes in storageService) | Server + Client | load_id + sender_id FKs. Client writes to localStorage as primary, API as secondary. | Migrate to server-only writes; remove localStorage message store |

## 6. Financial Entities

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **expenses** | MySQL `expenses` | None | Server (INSERT /api/expenses) | Server + Client | load_id optional FK. Status ENUM (pending/approved/rejected) with no transition guard. | Add approval workflow state machine |
| **ar_invoices** | MySQL `ar_invoices` | None | Server (INSERT /api/accounting/invoices) | Server + Client | Auto-posts GL journal entry on create. Status field present but unconstrained. | Add invoice status lifecycle; prevent re-posting |
| **ar_invoice_lines** | MySQL `ar_invoice_lines` | None | Server (INSERT within invoice transaction) | Server + Client | Cascade from ar_invoices. | Keep as-is |
| **ap_bills** | MySQL `ap_bills` | None | Server (INSERT /api/accounting/bills) | Server + Client | Auto-posts GL journal entry on create. Status field present but unconstrained. | Add bill status lifecycle; prevent re-posting |
| **ap_bill_lines** | MySQL `ap_bill_lines` | None | Server (INSERT within bill transaction) | Server + Client | Cascade from ap_bills. | Keep as-is |
| **driver_settlements** | MySQL `driver_settlements` | None | Server (INSERT /api/accounting/settlements) | Server + Client | Status ENUM in types.ts: Draft/Calculated/Approved/Paid. No transition guard on server. Auto-posts GL journal on create. | Enforce settlement state machine (see STATE_MACHINES.md); prevent GL re-posting |
| **settlement_lines** | MySQL `settlement_lines` | None | Server (INSERT within settlement transaction) | Server + Client | settlement_id FK. | Keep as-is |
| **journal_entries** | MySQL `journal_entries` | None | Server (INSERT from invoice/bill/settlement/adjustment routes) | Server + Client | Append-only ledger. posted_at set to NOW() on create. | Add immutability guard (no UPDATE/DELETE); add reversing entry pattern |
| **journal_lines** | MySQL `journal_lines` | None | Server (INSERT within journal entry transaction) | Server + Client | journal_entry_id FK. Debit/credit columns. | Add balanced-entry validation (sum debits = sum credits) |
| **gl_accounts** | MySQL `gl_accounts` | None | Server (read-only in current code) | Server + Client | Chart of accounts reference data. is_active flag for soft delete. | Seed via migration; add admin-only write route |
| **adjustment_entries** | MySQL `adjustment_entries` | None | Server (INSERT /api/accounting/adjustments) | Server + Client | Links to parent entity (invoice, bill, settlement) via parent_entity_type/id. | Add adjustment reason code validation |
| **fuel_ledger** | MySQL `fuel_ledger` | None | Server (INSERT from bulk import) | Server + Client (IFTA report) | state_code + gallons + cost for IFTA calculations. | Keep as-is; add validation |

## 7. IFTA and Mileage

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **mileage_jurisdiction** | MySQL `mileage_jurisdiction` | None | Server (INSERT /api/ifta/mileage) | Server + Client | Per-state mileage records for IFTA reporting. | Add source validation (GPS vs manual) |
| **ifta_trip_evidence** | MySQL `ifta_trip_evidence` | None | Server (read-only in current routes) | Server + Client | GPS breadcrumb trail linked to load_id. | Keep as audit evidence |
| **ifta_trips_audit** | MySQL `ifta_trips_audit` | None | Server (INSERT /api/ifta/submit-trip) | Server + Client | Attested mileage with confidence level. | Add attestation workflow |

## 8. Safety, Compliance, and Incidents

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **incidents** | MySQL `incidents` | localStorage `loadpilot_incidents_v1` | Server (INSERT /api/incidents) + Client (storageService localStorage writes) | Server + Client (dual-read) | Status ENUM: Open/In_Progress/Recovered/Closed. No server-side transition guard. Client writes to localStorage as primary with SQL sync attempted. | Remove localStorage; enforce incident lifecycle on server |
| **incident_actions** | MySQL `incident_actions` | None | Server (INSERT /api/incidents/:id/actions) | Server + Client | Append-only timeline. incident_id FK. | Keep append-only; add actor validation |
| **emergency_charges** | MySQL `emergency_charges` | None | Server (INSERT /api/incidents/:id/charges) | Server + Client | Status: Draft/Pending_Approval/Approved/Billed. No transition guard. incident_id FK. | Add approval state machine |
| **compliance_records** | MySQL `compliance_records` | None | Server (read-only in current routes) | Server + Client | user_id FK. Status: Valid/Expired/Pending_Review. expiry_date for auto-expire logic. | Add write route; add expiry cron job |
| **issues** | MySQL `issues` | None | Server (REPLACE INTO within load save) | Server + Client | Status: Open/Resolved. Created as side effect of load save when chassis issues detected. | Decouple from load save; add dedicated issue route |
| **training_courses** | MySQL `training_courses` | None | Server (no write route exists) | None (table exists but unused) | mandatory_roles JSON field. No routes implemented. | Implement or defer to Phase 6 |

## 9. Driver Operations

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **driver_time_logs** | MySQL `driver_time_logs` | None | Server (INSERT/UPDATE /api/time-logs) | Server + Client | user_id + load_id FKs. clock_in/clock_out pair. | Add validation (no overlapping shifts) |

## 10. Quotes, Leads, and Bookings Pipeline

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **leads** | MySQL `leads` | localStorage `loadpilot_leads_v1` | Server (INSERT /api/leads) + Client (storageService) | Server + Client | company_id FK. Client reads from localStorage first. | Remove localStorage; server-only writes |
| **quotes** | MySQL `quotes` | localStorage `loadpilot_quotes_v1` | Server (INSERT /api/quotes) + Client (storageService) | Server + Client | Status ENUM: Draft/Sent/Negotiating/Accepted/Declined/Expired. No transition guard. version field for optimistic updates but not enforced. | Enforce quote status machine; use version for optimistic locking |
| **bookings** | MySQL `bookings` | localStorage `loadpilot_bookings_v1` | Server (INSERT /api/bookings) + Client (storageService) | Server + Client | Status ENUM: Accepted/Tendered/Pending_Docs/Ready_for_Dispatch. quote_id FK. load_id FK (nullable, set when dispatched). | Enforce booking status machine; remove localStorage |

## 11. Trading Partners (V2 Party System)

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **parties** | MySQL `parties` | None | Server (REPLACE INTO /api/parties) | Server + Client | Unified customer/vendor entity. is_customer/is_vendor flags. company_id FK. | Keep; add deduplication guard |
| **party_contacts** | MySQL `party_contacts` | None | Server (INSERT within party transaction) | Server + Client | Deleted and re-created on party save (delete+insert pattern). | Keep as-is |
| **party_documents** | MySQL `party_documents` | None | Server (read-only in current routes) | Server + Client | party_id FK. | Add write route |
| **rate_rows** | MySQL `rate_rows` | None | Server (INSERT within party transaction) | Server + Client | Complex pricing: price_type, unit_type, tiers. Deleted and re-created on save. | Keep; add rate versioning |
| **rate_tiers** | MySQL `rate_tiers` | None | Server (INSERT within rate save) | Server + Client | Tiered pricing brackets. rate_row_id FK. | Keep as-is |
| **constraint_sets** | MySQL `constraint_sets` | None | Server (INSERT within party transaction) | Server + Client | Business rules per party. Deleted and re-created on save. | Keep; add enforcement engine |
| **constraint_rules** | MySQL `constraint_rules` | None | Server (INSERT within constraint set) | Server + Client | Individual rule definitions. constraint_set_id FK. | Keep as-is |
| **party_catalog_links** | MySQL `party_catalog_links` | None | Server (INSERT within party transaction) | Server + Client | Links parties to catalog items. | Keep as-is |

## 12. Exception Management

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **exceptions** | MySQL `exceptions` | None | Server (INSERT/UPDATE /api/exceptions) | Server + Client | Status progression with workflow_step tracking. Has before_state/after_state audit in events. Closest thing to a state machine in the codebase. | Formalize status machine; add SLA enforcement |
| **exception_events** | MySQL `exception_events` | None | Server (INSERT on exception create/update) | Server + Client | Append-only audit trail with before/after state snapshots. | Keep append-only pattern |
| **exception_status** | MySQL `exception_status` (migration) | None | Seed data | Server + Client | Reference table: statusCode, displayName, isTerminal, sortOrder. | Keep as reference data |
| **exception_type** | MySQL `exception_type` (migration) | None | Seed data | Server + Client | Reference table: typeCode, displayName, dashboard card config. | Keep as reference data |
| **dashboard_card** | MySQL `dashboard_card` (migration) | None | Seed data | Server + Client | UI configuration for exception dashboard cards. | Keep as reference data |

## 13. Document Vault

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **document_vault** | MySQL `document_vault` | None | Server (INSERT /api/documents, PATCH /api/documents/:id) | Server + Client | Status + is_locked fields. Supports lock after approval. Multi-entity linking (load, driver, truck, vendor, customer). | Add document lifecycle state machine |

## 14. Integration and Sync

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **sync_qb_log** | MySQL `sync_qb_log` | None | Server (INSERT /api/integrations/bulk-import) | Server | QuickBooks sync audit log. Status tracks sync outcome. | Keep as audit log |

## 15. Work Items (Unified Triage)

| Entity | Auth. Source | Secondary Source | Write Owner | Read Consumers | Boundary Rules | Recovery Action |
| --- | --- | --- | --- | --- | --- | --- |
| **work_items** | MySQL `work_items` | localStorage `loadpilot_work_items_v1` | Server (INSERT from load save side effects) + Client (mockDataService seeds localStorage) | Server + Client | Type ENUM: QUOTE_FOLLOWUP/LOAD_EXCEPTION/APPROVAL_REQUEST/SAFETY_ALARM. Status: Open/In-Progress/Resolved. Created as side effects, not via dedicated route. | Add dedicated CRUD route; remove mock seeding |

---

## Cross-Cutting Concerns

### Dual-Write Problem (Firestore + MySQL)

The `companies` and `users` entities are written to BOTH Firestore and MySQL. The server writes to both on create/update, but reads use different sources depending on the route:

- Login reads from Firestore (users collection)
- Company detail reads from Firestore (companies collection)
- List queries read from MySQL (e.g., users by company)

**Risk**: Data divergence if one write succeeds and the other fails. No transaction spans both stores.

### localStorage as Shadow Database

storageService.ts maintains 13 localStorage keys as a parallel data store. For loads, incidents, messages, quotes, bookings, and leads, the client writes to localStorage first, then attempts API sync. Failed API calls leave localStorage as the only copy.

**Risk**: Data loss on browser clear. Stale data served to UI. Multi-tab conflicts. No tenant isolation in localStorage keys.

### Missing Tenant Isolation

Most MySQL tables have a company_id FK, but the server routes do not consistently filter by the authenticated user company. Some routes accept companyId as a query parameter from the client, trusting the client to send the correct value.

**Risk**: Cross-tenant data access if client sends wrong company_id.
