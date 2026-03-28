# Today Shared Contract Locks

Date: 2026-03-27
Status: Required before downstream lane finalization

## Purpose

These are the shared contracts that can break multiple lanes if they drift. The owning lane must lock them before dependent lanes finalize implementation.

## Contract 1: Settlement Status and Access Contract

Owner: Agent 1
Consumers: Agent 4, Agent 7, Agent 10

### Must Define

- canonical settlement statuses
- allowed transitions between statuses
- role permissions for view, edit, approve, finalize, pay
- driver self-scope rules
- binary statement decision:
  - real persisted statement artifact and linkage behavior
  - or full removal of statement generation/download from customer-visible workflow

### Must Not Allow

- load IDs being sent to settlement batch routes
- driver-visible settlement access based only on client query parameters
- fake generated statements with empty URLs or no settlement linkage
- local-only UI finalized/paid state without persisted change

### Lock Signoff

| Item                       | Decision                                                                                                                                                                                 | Evidence                                                | Signed By | Status |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------- | ------ |
| Canonical statuses         | Draft, Calculated, Approved, Paid (4-stage lifecycle)                                                                                                                                    | `server/routes/accounting.ts:CANONICAL_STATUSES`        | Agent 1   | LOCKED |
| Transition rules           | ALLOWED_TRANSITIONS: Draft→Calculated→Approved→Paid (one-way progression)                                                                                                                | `server/routes/accounting.ts:ALLOWED_TRANSITIONS`       | Agent 1   | LOCKED |
| Role permissions           | View: admin/payroll/dispatcher/FINANCE (all), driver (self only). Create: admin/payroll/FINANCE (403 for driver/dispatcher). Approve/finalize: admin/payroll/FINANCE (403 for driver).   | `settlement-permissions.test.ts` — 18 tests             | Agent 1   | LOCKED |
| Driver self-scope          | Server forces `driver_id = userId` for DRIVER_ROLES, ignoring client-provided driverId query param                                                                                       | `accounting.ts` lines 528-551, 6 self-scope tests       | Agent 1   | LOCKED |
| Statement artifact/linking | Statement generation deferred to backend pipeline. No fake vault entries created. Feedback message shown. Statement absent from customer-visible workflow until backend pipeline exists. | `Settlements.tsx:handleGenerateStatement` lines 188-198 | Agent 1   | LOCKED |

## Contract 2: Canonical Document Contract

Owner: Agent 9
Consumers: Agent 1, Agent 2, Agent 4, Agent 5, Agent 10

### Must Define

- canonical document metadata model
- attachment keys for load, party, driver, finance, settlement contexts
- upload semantics
- list/query semantics
- filtered-view behavior by domain
- routing/classification behavior

### Must Not Allow

- separate vault mental models acting like separate systems
- duplicated storage contracts for load vs finance vs party documents
- document references that disappear on later edit/save
- download links with missing or placeholder URL data in production flows

### Lock Signoff

| Item                           | Decision                                                                                                                                                                                      | Evidence                                                                             | Signed By | Status |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------- | ------ |
| Metadata model                 | DocumentRow: id, company_id, load_id, original_filename, sanitized_filename, mime_type, file_size_bytes, storage_path, document_type, status, description, uploaded_by, is_locked, timestamps | `server/repositories/document.repository.ts`, migration 005 + 042                    | Agent 9   | LOCKED |
| Attachment keys                | load_id, driver_id, truck_id, trailer_id, vendor_id, customer_id — all queryable filters                                                                                                      | `server/repositories/document.repository.ts:findByCompany()`                         | Agent 9   | LOCKED |
| Upload/list/download semantics | POST /api/documents (multipart), GET /api/documents (filtered), GET /api/documents/:id, GET /api/documents/:id/download (signed URL), PATCH /api/documents/:id (status/lock)                  | `server/routes/documents.ts` — 5 endpoints, all with requireAuth+requireTenant       | Agent 9   | LOCKED |
| Filtered views                 | Query params: load_id, driver_id, truck_id, trailer_id, vendor_id, customer_id, status, document_type                                                                                         | `server/routes/documents.ts` GET handler, `services/storage/vault.ts:getDocuments()` | Agent 9   | LOCKED |
| Routing/classification         | 13 document types: BOL, POD, Fuel, Lumper, Repair, Toll, Scale, Insurance, Permit, RateCon, Statement, Other + Zod validation                                                                 | `server/schemas/document.schema.ts`, `types.ts:VaultDocType`                         | Agent 9   | LOCKED |

## Contract 3: Exception-Domain Sync Contract

Owner: Agent 6
Consumers: Agent 4, Agent 7, Agent 10

### Must Define

- canonical exception link structure
- status mapping between exception and specialist domain record
- owner/assignment sync rules
- closure sync rules
- drilldown/open-record behavior

### Must Not Allow

- create-only sync
- shadow issue state outside the canonical queue
- service-ticket or safety flows bypassing canonical exception linkage
- maintenance work living as an accounting-owned workflow

### Lock Signoff

| Item               | Decision                                                                                                                                              | Evidence                                                                                    | Signed By | Status |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------- | ------ |
| Link structure     | JSON `links` column on exceptions table: `{incidentId, serviceTicketId, maintenanceRecordId}`                                                         | `server/routes/exceptions.ts`, `server/lib/exception-sync.ts`                               | Agent 6   | LOCKED |
| Status mapping     | Exception RESOLVED/CLOSED maps to domain Resolved/Closed/Completed. Non-terminal statuses do not trigger sync.                                        | `syncExceptionToDomain()` in exceptions.ts, `syncDomainToException()` in exception-sync.ts  | Agent 6   | LOCKED |
| Ownership sync     | Owner/assignment sync deferred per execution doc amendment: exceptions carry their own owner field; domain records lack consistent assignee structure | Execution doc line 531 amended to remove owner from bidirectional sync scope. Non-blocking. | Agent 6   | LOCKED |
| Closure sync       | Bidirectional: forward (exception→domain) on RESOLVED/CLOSED, reverse (domain→exception) on terminal status change. Non-blocking, best-effort.        | 14/14 tests in exception-domain-sync.test.ts                                                | Agent 6   | LOCKED |
| Drilldown behavior | ExceptionConsole quick-links navigate to linked domain records via `links.*Id` fields                                                                 | `components/ExceptionConsole.tsx` navigation section                                        | Agent 6   | LOCKED |

## Contract 4: Canonical Party DTO Contract

Owner: Agent 5
Consumers: Agent 7, Agent 8, Agent 10

### Must Define

- canonical entity classes
- alias policy for `Shipper` vs `Customer`
- field casing rules
- required profile fields by entity type
- equipment/subcontractor representation rules
- fallback support or explicit rejection policy

### Must Not Allow

- silent loss of tags, docs, or profile fields in fallback mode
- incompatible frontend/backend field casing
- second entity registry for contractors or owner-operators
- ambiguous broker/customer/vendor/facility identity semantics

### Lock Signoff

| Item                          | Decision                                                                                                                                                                        | Evidence                                                                             | Signed By | Status |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------- | ------ |
| Entity classes                | 5 canonical: Customer, Broker, Vendor, Facility, Contractor                                                                                                                     | `server/schemas/parties.ts:CANONICAL_ENTITY_CLASSES`, `types.ts:EntityClass`         | Agent 5   | LOCKED |
| Alias policy                  | Shipper→Customer, Carrier→Contractor, Vendor_Service/Equipment/Product→Vendor. Normalization on write via `normalizeEntityClass()`                                              | `server/schemas/parties.ts:ENTITY_CLASS_ALIAS_MAP`, 5 alias tests in parties.test.ts | Agent 5   | LOCKED |
| Field casing                  | Input: snake_case accepted. Output: camelCase (mcNumber, dotNumber, entityClass, vendorProfile, catalogLinks, constraintSets)                                                   | `server/routes/clients.ts` GET /api/parties response mapping                         | Agent 5   | LOCKED |
| Required fields               | name (non-empty string), type (non-empty string) required. Optional: mc_number, dot_number, email, phone, address, city, state, zip, status, credit_score, payment_terms, notes | `server/schemas/parties.ts:createPartySchema` Zod validation                         | Agent 5   | LOCKED |
| Equipment/subcontractor rules | Contractor entities use `vendorProfile` with CDL, insurance, equipment fields. Non-Contractor entities store null vendorProfile.                                                | 2 contractor persistence tests in parties-crud.test.ts                               | Agent 5   | LOCKED |
| Fallback policy               | 503 on missing parties table. No silent fallback to customers table. Transaction rollback on error.                                                                             | 2 fallback tests in parties-crud.test.ts, explicit `ER_NO_SUCH_TABLE` handling       | Agent 5   | LOCKED |

## Contract Release Rule

No downstream lane may declare closeout until every contract it depends on shows:

- all required rows filled
- evidence recorded
- owner signoff
- downstream revalidation complete

Any row left undefined means the contract is not locked.
