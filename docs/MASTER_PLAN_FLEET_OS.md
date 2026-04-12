# LoadPilot Fleet OS Master Plan

Status: Draft  
Date: 2026-04-11  
Audience: product, engineering, operations, sales, QA, implementation  
Scope: web SaaS, mobile driver app, backend platform, data model, integrations, operations, launch readiness

## 1. Purpose

This document is the master end-to-end implementation plan for turning the current LoadPilot codebase into a complete, trustworthy, trip-linked operating system for trucking fleets.

This is not a greenfield roadmap. The product already has broad implementation across dispatch, documents, IFTA, accounting, settlements, CRM, safety, mobile, and tracking. The work now is to finish, harden, connect, certify, and operationalize what already exists.

This document is intentionally accuracy-first and completeness-first. It does not try to commit to a delivery calendar. Sequencing matters; exact dates do not belong in the master plan.

This plan is designed to answer five questions:

1. What does "complete" actually mean for this product?
2. What exists today versus what is partial, stubbed, or missing?
3. What work must happen first to make the system safe?
4. What must be built or integrated to support the full fleet OS claim?
5. How do we sequence, verify, and operate the platform end to end?

## 2. Executive Position

The correct long-term product claim is not:

> "We built every trucking capability ourselves."

The correct long-term product claim is:

> "LoadPilot is the trip-linked operating layer for trucking fleets. Dispatch, documents, compliance evidence, telematics events, settlements, and accounting all tie back to the same operational record."

That means:

- LoadPilot owns workflow orchestration, data lineage, and operational truth.
- LoadPilot does not need to own every hardware-heavy or regulated subsystem.
- Hardware and specialized systems are integrated through provider strategy.
- Human-in-the-loop automation is a deliberate trust and compliance feature.

## 3. Program Principles

The following principles are mandatory.

1. Hardening comes before broadening.
2. Tenant isolation is a zero-tolerance requirement.
3. Server-side authorization is required for every protected action.
4. AI-extracted fields never silently overwrite financial or regulated truth.
5. Every critical workflow ties to a trip, load, settlement, compliance period, or accounting object.
6. Every domain has a canonical API and canonical source of truth.
7. Every sales claim must map to a certified end-to-end journey.
8. External integrations are first-class product work, not placeholders.
9. Observability, support, and rollback are part of the product.
10. ADE / Ralph orchestration is a strategic execution asset and must be protected.

## 4. Product Boundary

### 4.1 LoadPilot Should Fully Own

- fleet dispatch and trip execution workflow
- quote, booking, customer, broker, and operational continuity
- document capture, OCR review, attachment, retention, and export
- issue, exception, breakdown, detention, and work-item workflows
- IFTA evidence, audit support, and filing readiness
- settlements and trucking back-office financial workflow
- trip-linked accounting lineage
- compliance reminders, status display, and supporting evidence management
- driver and dispatcher workflow surfaces
- cross-domain auditability and reporting

### 4.2 LoadPilot Should Integrate, Not Rebuild

- ELD / HOS
- telematics hardware
- fuel card systems
- card / banking / payment rails
- email and SMS delivery
- accounting sync platforms
- map / weather / routing infrastructure

### 4.3 LoadPilot Should Not Claim As Complete Until Delivered

- full HOS / ELD operating layer
- production-grade DVIR
- complete permit / filing / IRP / UCR / HVUT control center
- real-time telematics sync with at least one production provider
- complete server-side RBAC and production hardening
- certified end-to-end journeys for all critical claims

## 5. Current State Assessment

The codebase is broad and serious. It is not a fake demo. It is also not yet honest to describe as a fully complete trucking OS.

### 5.1 What Is Real Today

- multi-tenant auth shell exists
- route-rich Express backend exists
- canonical documents route exists
- OCR review-first architecture exists
- accounting, settlements, and IFTA foundations exist
- telematics provider configuration exists
- driver web and mobile surfaces exist
- operations center and exception handling exist
- quote, booking, and network domains exist
- deployment, demo, and readiness documentation exists
- large automated test inventory exists

### 5.2 What Is Still Incomplete

- protected-route hardening is not complete
- client-only permission assumptions still exist in parts of the platform
- end-to-end journey certification is incomplete
- external integrations are uneven, stubbed, or partially complete
- driver workflow closure is incomplete
- trucking-critical compliance coverage is incomplete
- mobile release, store, legal, and beta gates remain open
- observability and support operations are incomplete

### 5.3 Current State By Domain

| Domain | Current Status | Notes |
|---|---|---|
| Auth / tenancy | Partial but meaningful | Core auth exists; hardening and route completeness still required |
| RBAC / authorization | Incomplete | Some permission enforcement still depends too heavily on client behavior |
| Dispatch / load lifecycle | Strong partial | Breadth is real; full certified loop still not complete |
| Documents / OCR | Strongest domain | Canonical API plus review-first OCR is the clearest differentiator |
| Driver workflow | Partial | Real surfaces exist, but full field loop and mobile readiness are not complete |
| Telematics / GPS | Scaffolded | Provider setup exists; full production integration maturity not yet proven |
| ELD / HOS | Not complete | Must be integration-first, not custom-built |
| IFTA | Strong foundation | Audit packet and evidence capabilities are promising; quarter-close completeness still required |
| Safety / compliance | Broad but fragmented | Needs unification, provenance, and trucking-critical expansion |
| Accounting / settlements | Strong partial | Core logic is credible; operational closure and syncs still needed |
| CRM / network / booking | Real | Needs tighter continuity with loads and finance |
| Billing / subscription | Incomplete | Stripe and monetization are not complete |
| Comms | Partial | Real-time workflows exist; delivery infrastructure and guarantees need completion |
| Observability / ops | Partial | Docs exist; production-grade ownership and runbooks remain incomplete |

## 6. Definition Of Complete

The product is complete only when all of the following are true.

### 6.1 Platform Safety

- all protected routes are fully guarded
- all tenant-scoped resources are enforced server-side
- all sensitive writes are auditable
- no unauthorized cross-tenant read or write path remains
- health, rollback, and recovery are real and tested

### 6.2 Workflow Closure

- the operator can execute the main job end to end without spreadsheets or side systems for core flows
- every critical action leaves a durable audit trail
- workflows do not branch into duplicate truths

### 6.3 Integration Truth

- every external dependency is either complete, disabled, or explicitly marked partial
- no stub is presented as a live integration
- provider setup, status, sync health, and fallback behavior are visible

### 6.4 Certification Truth

- every major claim has a certified end-to-end journey
- certification covers backend, UI, data persistence, audit lineage, and failure handling

### 6.5 Operational Truth

- on-call, incident response, logging, metrics, and support playbooks exist
- pilots and production customers can be supported without ad hoc tribal knowledge

## 7. Target Operating Model

The finished system must support these personas cleanly.

### 7.1 Dispatcher

- manages quotes, bookings, loads, assignments, delays, breakdowns, and dispatch state
- sees live trip-linked documents, issues, and location context
- can coordinate with drivers, customers, brokers, and accounting without leaving the system

### 7.2 Driver / Owner-Operator

- receives assignments
- executes stop sequence
- scans and reviews documents
- reports issues
- sees compliance gaps
- sees pay / settlement state
- works offline when necessary

### 7.3 Safety / Compliance

- monitors certificates, inspections, incidents, maintenance, IFTA evidence, and filing readiness
- sees source-of-truth and verified-at metadata for every status

### 7.4 Accounting / Back Office

- generates and posts settlements
- manages AP / AR / invoice aging / export
- traces financial lines back to operational and document source records

### 7.5 Fleet Admin / Owner

- manages tenant settings, users, roles, subscriptions, provider integrations, and readiness
- sees business performance and operational risk in one system

## 8. Canonical Architecture

### 8.1 Core Entity Spine

The finished product must treat the following as canonical entities.

- company
- user
- role / permission
- driver
- equipment
- load
- trip
- stop / leg
- document
- OCR result
- issue / exception / work item
- communication thread
- tracking event
- compliance obligation
- maintenance record
- settlement
- invoice / bill / journal entry
- subscription / usage event

### 8.1.1 Explicit Ownership Ruling: Load vs Trip vs Stop

This decision is mandatory and is now fixed for the program.

- `load` is the commercial object
- `trip` is the execution object
- `stop` is the operational atom

Definitions:

- A `load` represents what the shipper, broker, or customer purchased.
- A `trip` represents a single executable movement or execution segment run by a specific driver / truck context.
- A `stop` represents a pickup, dropoff, relay, fuel, inspection, or service event within a trip.

Cardinality rules:

- one load may have one or more trips
- one trip belongs to exactly one load
- one trip has one or more stops
- one settlement line may tie to a load, a trip, or both depending on the pay model
- one document may attach to load, trip, stop, or another canonical parent where appropriate

Operational implications:

- every telemetry, HOS, and location event ties to a trip first
- every customer-facing and commercial obligation ties to a load first
- every stop-level event rolls up into a trip
- every trip rolls up into its parent load
- every financial line must be explainable by source load and, where execution-specific, source trip

Examples:

- a relay load with two drivers is one load and two trips
- a team-driving segment is one load and one trip with two driver participants if the model later supports co-driver context
- a lumper receipt may attach to a stop and roll up to the trip and load
- a detention charge attaches to the stop where it happened, the trip that incurred it, and the load that is billed

Non-negotiable rule:

- no domain may invent an alternate execution object outside load, trip, and stop without an explicit architecture change

### 8.2 Canonical Linkage Rules

1. Every document must link to one or more parent contexts:
   - load or trip
   - driver
   - equipment
   - compliance period
   - settlement
   - invoice or bill
2. Every financial line must trace to its operational source.
3. Every telematics event must be attributable to a company and a vehicle and, where possible, a trip or load.
4. Every compliance status must include:
   - source type
   - source of truth
   - verified at timestamp
   - confidence or certainty label
5. Every mutation with legal, financial, or compliance consequence must be auditable.

### 8.2.1 Attachment And Lineage Rules By Domain

These rules are now fixed.

Documents:

- BOL, POD, rate confirmation, lumper, toll, scale, repair, and receipt docs must attach to at least one canonical parent
- if a document is captured during a trip workflow, it must attach to trip
- if a document is part of customer or settlement evidence, it must also attach to load or settlement as applicable

Finance:

- invoice lines attach to load
- settlement lines attach to load and, where execution-specific, trip
- reimbursements and deductions must tie to a source document, policy, or operational event

Telemetry:

- telematics events attach to company, vehicle, and trip
- HOS events attach to company, driver, vehicle, and trip when active
- geofence events attach to stop and trip when resolvable

Compliance:

- IFTA evidence attaches to trip and compliance period
- certificate and inspection records attach to driver or equipment
- DVIR records attach to equipment, trip when relevant, and repair workflow when escalated

### 8.3 Data Provenance Rules

Every domain record should be classified as one of:

- manual
- human-reviewed AI extraction
- external provider sync
- system-generated
- derived / computed

This classification must be visible in backend lineage and, where relevant, in UI.

## 9. Program Workstreams

The program is organized into 12 workstreams. Workstream 0 must start first.

### Workstream 0: Platform Hardening And Trust

Objective:

Make the product safe to operate as a system of record.

Current state:

- many middleware and schemas already exist
- route coverage is not yet uniformly enforced
- readiness docs still call out RBAC, pagination, health, and timeout gaps

Required deliverables:

- protected-route audit of every backend router
- route classification inventory: public, authenticated, tenant-scoped, role-scoped, tier-scoped
- server-side permission framework completion
- explicit allowlist for intentionally public or specially gated routes
- pagination and filter standard for list endpoints
- health check standard with DB and dependency readiness
- request id, audit id, and correlation id coverage
- idempotency standards for repeated writes
- tenant isolation tests for routes, repositories, jobs, exports, and storage
- security regression pack and route audit in CI
- `server/index.ts` modularization into route registration, middleware registration, and bootstrap concerns

Known middleware inventory as of plan revision:

- `POST /api/demo/reset` in `demo.ts`
  - intentionally special-cased
  - must remain protected by auth, admin role, tenant check, and `ALLOW_DEMO_RESET`
  - must stay on the explicit allowlist with tests proving the controls
- `GET /api/feature-flags`
  - fixed; keep in hardening inventory until route audit is stable
- `PUT /api/feature-flags/:name`
  - fixed; keep in hardening inventory until route audit is stable
- SPA fallback `GET /*` in `server/index.ts`
  - intentionally allowlisted as a non-API route
  - must never shadow `/api/*`

`server/index.ts` modularization target:

- `server/index.ts` should contain:
  - config bootstrap
  - app creation
  - delegation to middleware and route registration
  - server listen and shutdown hooks
- extract middleware registration to `server/middleware/register.ts`
- extract route mounting to `server/routes/register.ts`
- target post-refactor size:
  - preferred: under 80 lines
  - maximum acceptable: under 100 lines
- rollback strategy:
  - modularization lands in a dedicated reversible commit
  - route mounting behavior remains byte-for-byte equivalent from the caller perspective

Primary repo areas:

- `server/index.ts`
- `server/routes/*.ts`
- `server/middleware/*.ts`
- `server/lib/*.ts`
- `server/__tests__/routes/*`
- `server/__tests__/regression/*`

Acceptance criteria:

- zero unguarded protected routes
- zero tenant-scope bypasses
- zero client-only authorization on sensitive operations
- large list endpoints paginate
- health endpoints fail correctly on broken DB state
- route audit and forbidden-pattern tests pass in CI
- `server/index.ts` delegates bootstrapping cleanly and no longer acts as a route dump

Verification methods:

- route-audit test
- endpoint-hardening and tenant-isolation tests
- CI forbidden-pattern tests
- boot smoke test proving refactor did not change runtime registration

### Workstream 1: Canonical Data Model And Trip-Linked Lineage

Objective:

Make the trip or load the primary operational spine for all downstream workflows.

Current state:

- many domains exist but are not fully closed around a single business spine
- `load_legs` already functions as the current stop layer
- a dedicated `trip` execution entity does not yet exist as a first-class table
- documents and settlements have meaningful lineage potential but not full closure

Required deliverables:

- canonical entity ownership map
- lineage matrix from quote through finance
- trip vs load ownership decision and transition rules
- document attachment rules by domain
- accounting-source linkage rules
- compliance-source linkage rules
- data provenance model
- migration and cleanup plan for duplicate shadows
- migration sequencing appendix covering schema order, backfill, orphan handling, and strictness strategy

Current foundation rule:

- do not create a brand-new redundant stops table
- treat existing `load_legs` as the current stop implementation
- if a first-class `trip` table is introduced, `load_legs` should attach to `trip_id` rather than be replaced by a parallel stop model

Lineage migration strategy:

- phase 1 migrations add nullable lineage columns and indexes
- phase 2 backfill existing rows using deterministic heuristics and operator review queues where needed
- phase 3 introduce application-level write requirements for new rows
- phase 4 tighten constraints only after backfill and repair rates are acceptable

Mandatory migration sequencing:

1. Documents lineage columns and indexes
2. OCR result to document / trip / load linkage completion
3. Settlement and settlement-line lineage columns
4. Expense and reimbursement lineage columns
5. Telematics and geofence linkage columns
6. Compliance evidence linkage columns
7. Audit / export helper indexes and rollup fields

Backfill rules:

- if parent can be inferred with high confidence, backfill automatically and record provenance as `derived`
- if parent inference is ambiguous, park the row in a review queue
- no record is deleted because lineage is missing
- pre-existing orphan rows must be classified as:
  - resolved automatically
  - pending review
  - legacy archived

Strictness rules:

- new writes should become parent-required before old rows are made non-null
- old rows may remain nullable until reviewed
- strict foreign keys should be applied only after repair windows close and production backfill reports are green

Primary repo areas:

- `server/schema.sql`
- `server/migrations/*.sql`
- `server/repositories/*.ts`
- `shared/contracts/*.ts`
- `packages/shared/src/types.ts`

Acceptance criteria:

- each major domain has one canonical source of truth
- cross-domain lineage is queryable and documented
- exports and audit packets can be traced to source records

Verification methods:

- migration tests
- backfill dry-run report
- lineage query pack for certified journeys
- orphan-row report with explicit target of zero unresolved critical records

### Workstream 2: Dispatch, Quote, Booking, And Trip Execution

Objective:

Finish the core operations loop from demand creation to completed trip.

Current state:

- quote, booking, load, dispatch, and timeline surfaces exist
- canonical end-to-end coverage remains incomplete

Required deliverables:

- quote-to-booking conversion completion
- booking-to-load conversion hardening
- full load lifecycle certification
- assignment, re-assignment, repower, and exception closure
- dispatcher calendar and timeline consistency
- customer and broker continuity across all views
- event logging for dispatch actions

Primary repo areas:

- `components/QuoteManager.tsx`
- `components/BookingPortal.tsx`
- `components/LoadBoardEnhanced.tsx`
- `components/DispatcherTimeline.tsx`
- `server/routes/quotes.ts`
- `server/routes/bookings.ts`
- `server/routes/loads.ts`
- `server/routes/dispatch.ts`

Acceptance criteria:

- one certified path from quote to completed load
- no state mismatch between UI, API, and DB
- all dispatch actions are auditable

Verification methods:

- certified quote-to-load E2E
- load-state transition integration suite
- audit-log assertions for dispatch mutations
- timeline and calendar consistency regression pack

### Workstream 3: Document Automation, OCR Review, And Evidence Layer

Objective:

Complete the platform's clearest differentiator: trusted document automation.

Current state:

- canonical document route exists
- OCR review architecture is sound
- downstream completeness, linkage, and policy closure are incomplete

Required deliverables:

- document type taxonomy completion
- duplicate detection
- document completeness rules by workflow
- OCR review UX completion
- patch-after-review mapping rules
- downstream attachment to compliance / finance / settlements
- fuel receipt, toll, scale, lumper, POD, BOL, rate-con coverage completion
- retention classes and lock rules
- trip packet, settlement packet, and audit packet exports

Primary repo areas:

- `server/routes/documents.ts`
- `server/services/ocr.service.ts`
- `server/services/gemini-ocr-adapter.ts`
- `server/repositories/document.repository.ts`
- `components/Scanner.tsx`
- `components/FileVault.tsx`
- `components/BolGenerator.tsx`
- mobile document capture code in `apps/trucker/src`

Acceptance criteria:

- all core trucking document classes flow through one canonical lifecycle
- AI output always requires explicit review before sensitive mutation
- missing documents visibly block downstream milestones when appropriate
- document exports reproduce underlying evidence accurately

Verification methods:

- document taxonomy and routing tests
- OCR review and patch authorization tests
- document completeness badge/blocker regression suite
- packet export evidence comparison against source records

### Workstream 4: Driver / Trucker Operating Layer

Objective:

Make the driver experience a complete operational workflow.

Current state:

- driver web shell exists
- mobile app exists in partial form
- release gates and field workflow closure remain open

Required deliverables:

- primary trip workspace
- stop sequence and appointment awareness
- status updates and change requests
- delay, detention, breakdown, lumper, and issue escalation
- driver messaging and read-state continuity
- document checklist by trip
- pay and settlement visibility
- offline queue and sync behavior
- release, device, store, and legal readiness for the chosen rollout path

Mobile release baseline checklist:

- iOS and Android build signing configured
- crash reporting active
- privacy policy URL published
- terms of service published
- camera permissions copy approved
- location permissions copy approved
- offline data handling documented
- background sync behavior documented
- app icon, metadata, screenshots, and store listing baseline prepared
- internal distribution path established
- beta feedback intake path established
- device matrix defined for pilot support

Primary repo areas:

- `components/DriverMobileHome.tsx`
- `components/driver/DriverLoadIntakePanel.tsx`
- `apps/trucker/src/app/*`
- `apps/trucker/src/services/*`
- `apps/trucker/src/components/*`
- `server/routes/loads-driver-intake.ts`
- `server/routes/messages.ts`

Acceptance criteria:

- a driver can complete the certified trip loop from assignment through proof submission
- field behavior is reliable offline and online
- the mobile release checklist is materially complete

Verification methods:

- mobile smoke suite
- offline / reconnect integration suite
- physical-device validation checklist
- store-readiness checklist evidence pack

### Workstream 5: Telematics, GPS, ELD, And Trip Telemetry

Objective:

Finish the provider-backed telemetry and HOS layer using integration-first execution.

Current state:

- telematics setup and tracking routes exist
- Samsara support already exists in MVP form
- generic webhook provider path already exists
- provider strategy is not yet complete
- ELD / HOS is not yet product-complete

Required deliverables:

- provider strategy and partner choice
- provider abstraction layer
- production-grade integration for one primary provider
- live sync status reporting
- vehicle and driver mapping completion
- trip-linked telemetry usage in ops and compliance domains
- HOS display and conflict handling
- sync retry / backfill / failure reporting

Primary repo areas:

- `components/TelematicsSetup.tsx`
- `server/routes/tracking.ts`
- `server/schemas/tracking.ts`
- `server/services/gps/*`
- future `server/services/eld/*`

Acceptance criteria:

- at least one provider works end to end in a production-like environment
- live tracking and configuration state are visible and reliable
- telemetry can feed both dispatch and IFTA/compliance workflows

Verification methods:

- provider setup and credential lifecycle integration tests
- telemetry ingest, replay, and outage recovery tests
- dispatch and IFTA consumer assertions against the same telemetry fixtures
- staging provider certification checklist

### Workstream 6: Compliance, IFTA, Safety, Maintenance, And DVIR

Objective:

Complete the trucking-critical compliance operating layer.

Current state:

- IFTA and safety foundations are real
- full compliance cockpit and trucking-specific operational completeness are still missing

Required deliverables:

- IFTA gap detection and quarter-close workflow
- audit packet completion and lock semantics
- IRP, UCR, HVUT / 2290, permits, annual deadlines
- compliance cockpit with source-of-truth and verified-at metadata
- maintenance schedules and certification continuity
- DVIR flow with photos, signoff, repair, and return-to-service
- incident, inspection, and certificate lifecycle completeness

Primary repo areas:

- `components/IFTAManager.tsx`
- `components/IFTAEvidenceReview.tsx`
- `components/SafetyView.tsx`
- `server/routes/ifta-audit-packets.ts`
- `server/routes/compliance.ts`
- `server/routes/safety.ts`
- `server/services/ifta-*`

Acceptance criteria:

- compliance statuses are honest, sourced, and current
- quarter-close and audit support are reproducible
- safety and maintenance workflows have field-to-office continuity

Verification methods:

- compliance-status metadata assertions for `source_type`, freshness, and verifier state
- IFTA quarter-close certification run with packet export evidence
- DVIR and maintenance lifecycle E2E suite
- safety / certificate / inspection operator checklist

### Workstream 7: Accounting, Settlements, Billing, And Financial Controls

Objective:

Finish the financial back-office operating layer.

Current state:

- settlement logic is credible
- accounting breadth is real
- QuickBooks route and service implementation already exist in partial but real form
- Stripe route and service implementation already exist in partial but real form
- operational certification and integration completion are still needed

Required deliverables:

- settlement generation, review, posting, adjustments, and immutability completion
- AP / AR / GL workflow certification
- invoice aging completion
- broker payment intelligence groundwork
- QuickBooks completion
- Stripe completion for subscription and billing
- audit events for every financially material action
- reconciliation views and exception handling

Primary repo areas:

- `components/AccountingPortal.tsx`
- `components/Settlements.tsx`
- `server/routes/accounting.ts`
- `server/routes/quickbooks.ts`
- `server/routes/stripe.ts`
- `server/services/settlement.service.ts`
- `server/services/reconciliation.service.ts`
- `server/services/quickbooks.service.ts`

Acceptance criteria:

- financial workflows no longer require side spreadsheets for core operations
- postings and adjustments are immutable and auditable
- sync and reconciliation states are visible

Verification methods:

- settlement-to-posting certified journey
- immutable-posting and adjustment authorization tests
- QuickBooks and Stripe sync contract suites
- reconciliation console checklist with seeded mismatch cases

### Workstream 8: CRM, Network, Customer, And Broker Continuity

Objective:

Tie customer, broker, and commercial workflow cleanly into operations and finance.

Current state:

- network, parties, contacts, quotes, and bookings exist
- continuity into operational and financial downstream states needs tightening

Required deliverables:

- canonical customer / broker master records
- contact and party normalization
- quote and booking continuity to load and invoice
- broker performance and payment linkage
- customer-facing artifact continuity

Primary repo areas:

- `components/NetworkPortal.tsx`
- `components/BrokerManager.tsx`
- `components/CustomerPortalView.tsx`
- `server/routes/contacts.ts`
- `server/routes/providers.ts`
- `server/routes/quotes.ts`
- `server/routes/bookings.ts`

Acceptance criteria:

- customer and broker records are not duplicated across silos
- quote, load, proof, and invoice continuity is preserved

Verification methods:

- duplicate-master-record report
- commercial lineage query pack from quote to invoice
- UI regression suite for customer / broker continuity across key surfaces

### Workstream 9: Communications, Notifications, And Operational Collaboration

Objective:

Make comms a reliable operational subsystem, not a UI accessory.

Current state:

- messaging and notifications exist
- delivery, retry, and operational guarantees need completion

Required deliverables:

- real email and SMS provider completion
- notification jobs observability
- read receipt and delivery state model
- operational alerts by domain
- escalation rules for critical events

Primary repo areas:

- `components/OperationalMessaging.tsx`
- `components/CommsOverlay.tsx`
- `server/routes/messages.ts`
- `server/routes/notification-jobs.ts`
- `server/services/notification-delivery.service.ts`

Acceptance criteria:

- important notifications are reliably delivered or visibly failed
- job states and retries are observable

Verification methods:

- email and SMS provider contract tests
- notification job retry and dead-letter integration tests
- delivery-state and acknowledgement UI regression suite
- operational alert routing drill

### Workstream 10: Observability, Support, Release Operations, And Truth Alignment

Objective:

Make the product operable, supportable, and truthfully represented.

Current state:

- substantial deployment docs exist
- operational support model is incomplete
- product messaging still outpaces real completion in places

Required deliverables:

- structured logging standard across backend, jobs, frontend, and mobile
- Sentry strategy across all runtime surfaces
- service ownership and on-call runbook
- incident response playbook
- pilot rollout playbook
- support escalation matrix
- release evidence bundle template
- product truth matrix for sales, support, and implementation
- repo hygiene cleanup plan
- deployment strategy with blue-green / rollback policy
- backup, restore, and recovery policy
- feature flag and progressive rollout policy

Primary repo areas:

- `server/lib/logger.ts`
- `server/lib/sentry.ts`
- `services/sentry.ts`
- `docs/ops/*`
- `docs/deployment/*`
- `docs/release/*`

Acceptance criteria:

- incidents can be detected and triaged quickly
- support staff can identify what is live, partial, stubbed, or integrated
- sales language matches implementation truth

Verification methods:

- runbook tabletop exercise
- rollback drill evidence
- alert routing test
- support readiness checklist

### Workstream 11: Enterprise Readiness, Public API, And Scale Path

Objective:

Close the gap between mid-market completeness and enterprise-grade fleet platform readiness.

Current state:

- current plan is strong for owner-operator and small / mid-market needs
- enterprise capabilities are not yet fully represented in the program

Required deliverables:

- SSO / SAML strategy and implementation plan
- SCIM or equivalent user provisioning strategy
- public API strategy with versioning
- tenant API key management
- webhook platform for outbound events
- developer documentation portal and sandbox model
- data export and portability model
- customer data migration toolkit
- feature flag / progressive rollout infrastructure
- enterprise audit retention policy
- backup / disaster recovery targets and evidence
- data residency strategy
- multi-region strategy
- i18n and regionalization framework
- multi-currency and unit handling strategy
- financial controls for enterprise and SOX-adjacent customers

Primary repo areas:

- `server/routes/feature-flags.ts`
- future `server/routes/public-api/*`
- future `server/routes/webhooks/*`
- future `server/routes/sso/*`
- future `server/routes/api-keys/*`
- `server/lib/*`
- `docs/ops/*`
- `docs/deployment/*`
- data import and migration tooling under `components/` and `server/scripts/`

Detailed scope:

Public API and developer platform:

- versioned REST API namespace
- API key issuance, rotation, and revocation
- rate limiting by key and tenant
- webhook subscriptions for key domain events
- sandbox or test tenant guidance
- developer docs with examples

Enterprise security and identity:

- SSO / SAML
- SCIM or bulk provisioning path
- session and identity auditability
- fine-grained admin controls

Data platform and analytics:

- reporting workload separation from OLTP
- scheduled exports
- BI-tool integration path
- historical reporting strategy

Onboarding and migration:

- CSV import wizards by entity
- field-mapping UI
- dry-run import preview
- import rollback and error queue
- white-glove migration tooling for services teams

Internationalization and regionalization:

- i18n framework
- currency handling
- unit handling
- localization of dates, addresses, and phone formats
- region-specific compliance extensibility

Enterprise controls:

- segregation of duties
- period locks
- approval chains for sensitive financial actions
- long-term audit retention
- SLA targets
- RPO / RTO targets

Acceptance criteria:

- enterprise path is explicitly defined rather than implied
- public API and webhook path is implemented for the supported scope and documented for external consumers
- migration and export tooling exists for non-trivial customer onboarding
- feature flags support kill-switches and progressive rollout
- enterprise controls are implemented for the claimed tier and backed by evidence

Verification methods:

- architecture review package
- API contract tests
- webhook contract tests
- import/export dry-run suite
- disaster-recovery tabletop and restore test evidence

## 10. Detailed Capability Completion Matrix

### 10.1 Dispatch And Trip Execution

Complete means:

- quotes convert to bookings or loads cleanly
- bookings convert to executable loads
- assignments propagate to driver surfaces
- trip state updates are consistent everywhere
- exceptions and operational interventions are attached to the same trip context
- completion triggers downstream finance and compliance steps

### 10.2 Documents

Complete means:

- every core trucking document class is supported
- all documents follow canonical ingest, OCR, review, attach, and export flow
- document completeness is visible by trip, settlement, and compliance period
- retention and lock rules exist

### 10.3 Driver Workflow

Complete means:

- today view, loads view, docs view, changes view, map, pay, and profile all work against live data
- offline capture and sync are trustworthy
- status updates and issue reporting are field-usable

### 10.4 Telematics / ELD

Complete means:

- real provider auth exists
- provider health and sync status are visible
- live location and HOS data can be used in workflow and compliance contexts

### 10.5 Compliance

Complete means:

- IFTA is quarter-close ready
- IRP / UCR / HVUT / permit statuses are represented honestly
- safety and maintenance are linked to real equipment and driver records
- DVIR exists as a complete workflow

### 10.6 Accounting

Complete means:

- settlements, invoices, bills, GL, exports, and syncs work end to end
- accounting actions do not lose operational lineage

## 11. Program Phasing

The program should execute in eight major phases.

### Phase A: Trust Spine

Workstreams:

- 0
- highest-risk pieces of 1

Exit gates:

- protected-route audit passes
- RBAC baseline passes
- tenant isolation pack passes
- pagination standard live
- health and timeout standards live

### Phase B: Trip-Linked Model Closure

Workstreams:

- 1
- enabling work from 2, 3, and 7

Exit gates:

- canonical entity ownership approved
- lineage matrix complete
- duplicate truths identified and remediation planned or complete

### Phase C: Core Loop Closure

Workstreams:

- 2
- 3
- key pieces of 7

Exit gates:

- quote-to-load-to-settlement certified
- document automation certified
- ops and finance continuity certified

### Phase D: Driver Operating Layer

Workstreams:

- 4
- key pieces of 9

Exit gates:

- driver field loop certified
- offline sync stable
- release checklist materially green for pilot channel

### Phase E: Compliance And Telemetry Completion

Workstreams:

- 5
- 6

Exit gates:

- IFTA quarter-close certified
- one provider-backed telemetry path certified
- compliance cockpit delivers honest statuses
- DVIR and maintenance core path complete

### Phase F: Financial And Commercial Completion

Workstreams:

- 7
- 8

Exit gates:

- back-office workflows certified
- customer / broker / invoice continuity certified
- billing and sync truth complete

### Phase G: Operate, Launch, And Scale

Workstreams:

- 9
- 10

Exit gates:

- observability complete
- support and on-call ready
- launch truth matrix approved
- pilot / production support model in place

### Phase H: Enterprise-Grade Expansion

Workstreams:

- 11

Exit gates:

- public API path is implemented, documented, and certified for the supported scope
- enterprise identity and control requirements are implemented for the claimed tier
- migration, export, retention, and DR capabilities are implemented and evidenced
- regionalization and enterprise-scale reporting path is implemented for the claimed scope

### 11.1 Delegation Readiness Rules

No phase is delegation-ready unless every delegated story includes:

- unique story id
- exact objective
- exact in-scope files or modules
- explicit dependency list
- interface or schema impact
- migration impact if any
- verification method
- rollback note
- unambiguous done state

Story design rules:

- one story should have one dominant concern
- schema changes and behavior changes should be split unless tightly coupled
- no story may silently redefine a canonical contract owned by another phase
- no later-phase story may assume an earlier migration landed unless that migration is an explicit dependency
- certification stories must verify prior implementation stories rather than add unrelated breadth

### 11.2 Phase Story Packs

These story packs are the minimum phase-aligned delegation structure. Each story pack may later decompose further when converted into `PLAN.md` and `prd.json`, but the work should not be delegated with less detail than this.

#### Phase A Story Pack: Trust Spine

| Story ID | Story | Primary Touch Areas | Done When |
|---|---|---|---|
| A-01 | Route inventory and allowlist | `server/routes/*`, route-audit tests | Every route is classified and the explicit allowlist is documented and tested |
| A-02 | Missing auth / tenant / validation closure | route files missing guards, validation middleware | Known gaps are closed and route audit passes |
| A-03 | Server-side RBAC completion | protected mutation routes, permission helpers | Sensitive routes enforce server-side roles and tiers |
| A-04 | Pagination and filtering standard | list-heavy routes, repositories | Large endpoints expose and honor pagination and filters |
| A-05 | Health check and dependency readiness | `server/routes/health.ts`, DB readiness logic | Health reflects DB and dependency readiness correctly |
| A-06 | Rate limiting and idempotency baseline | middleware, high-risk write routes | Repeated writes are safe and abusive traffic is constrained |
| A-07 | Tenant isolation regression pack | routes, repositories, exports, jobs | Cross-tenant regression suite passes |
| A-08 | `server/index.ts` modularization | `server/index.ts`, new registration modules | Bootstrap is delegated cleanly and route behavior is unchanged |
| A-09 | Canonical load / trip / stop ruling implementation scaffold | schema docs, shared contracts | Architecture ruling is encoded in contracts and docs |
| A-10 | Trip foundation schema | new trip table and load-to-trip linkage migrations | First-class trip entity exists without breaking current flows |
| A-11 | Stop linkage normalization | `load_legs`, stop repository, migration glue | Existing `load_legs` is linked into the new execution model |
| A-12 | Document lineage foundation | document schema and indexes | Documents can link to canonical parents under the new lineage model |

#### Phase B Story Pack: Trip-Linked Model Closure

| Story ID | Story | Primary Touch Areas | Done When |
|---|---|---|---|
| B-01 | Lineage matrix and ownership enforcement | contracts, repositories, docs | Canonical ownership map is implemented, not just documented |
| B-02 | OCR result lineage completion | OCR tables, repositories, services | OCR results can be traced to document and business context |
| B-03 | Settlement lineage schema | settlement tables and repositories | Settlement records and lines trace to load and trip correctly |
| B-04 | Expense and reimbursement lineage | financial tables and services | Expenses tie to source trip, stop, document, or policy |
| B-05 | Telematics lineage schema | tracking tables and repositories | Telemetry can attach to trip and vehicle consistently |
| B-06 | Compliance evidence lineage | IFTA and compliance tables | Evidence ties to compliance period and trip/load context |
| B-07 | Orphan-row backfill engine | migrations, repair scripts, reports | Existing records are classified, backfilled, or queued for review |
| B-08 | Duplicate-truth reconciliation | reconciliation service, reports | Duplicate parentage and shadow models are surfaced and reduced |
| B-09 | Lineage query pack for certified journeys | SQL/reporting utilities | Each certified journey has reproducible lineage output |
| B-10 | Strictness hardening for new writes | validators, repositories, routes | New writes require canonical parent linkage where mandated |

#### Phase C Story Pack: Core Loop Closure

| Story ID | Story | Primary Touch Areas | Done When |
|---|---|---|---|
| C-01 | Quote model normalization | quote schema, repo, UI | Quotes carry the fields needed for full downstream continuity |
| C-02 | Booking-to-load conversion hardening | booking repo, load creation paths | Bookings convert cleanly with no data loss |
| C-03 | Load lifecycle state certification | load routes, services, UI | Full valid and invalid state transitions are verified |
| C-04 | Assignment and repower closure | dispatch routes, assignment UI | Reassignment and repower keep continuity and audit trail |
| C-05 | Dispatcher timeline and calendar truth | timeline and calendar components | Timeline and calendar reflect canonical load/trip state |
| C-06 | Exception and work-item continuity | exception console, crisis / triage flows | Operational exceptions remain tied to the same business context |
| C-07 | Customer and broker continuity | network, booking, load detail views | Customer / broker identity is preserved across execution views |
| C-08 | Document completeness by trip and load | docs routes, Scanner, FileVault, UI badges | Missing artifacts are visible and block downstream steps where required |
| C-09 | OCR review-to-apply pipeline closure | OCR review UI, patch logic, audit events | Human-reviewed extraction can safely update target records |
| C-10 | Quote-to-load-to-settlement certification | cross-domain tests and runbooks | Full core loop journey is certified end to end |

#### Phase D Story Pack: Driver Operating Layer

| Story ID | Story | Primary Touch Areas | Done When |
|---|---|---|---|
| D-01 | Driver trip workspace canonicalization | `apps/trucker/src/app/*`, `components/DriverMobileHome.tsx`, driver-facing APIs | Driver sees one canonical trip workspace with the same execution truth used by dispatch |
| D-02 | Stop sequence, appointment, and next-action truth | mobile trip views, `load_legs`, stop APIs | Driver UI reflects ordered stops, appointments, next required action, and stop-level state correctly |
| D-03 | Driver status update contract completion | mobile actions, status routes, timeline services | Departed, arrived, loaded, unloaded, delivered, and exception statuses map cleanly to backend state transitions |
| D-04 | Delay, detention, lumper, and breakdown workflow closure | issue routes, exception console, mobile forms | Field-reported operational events create traceable office-side work items and downstream impacts |
| D-05 | Driver messaging and read-state continuity | `server/routes/messages.ts`, mobile messaging UI, notification state | Driver and dispatcher messaging shares one thread model with visible read and delivery state |
| D-06 | Document checklist and mobile scan flow | scanner UI, document checklist, upload routes | Required documents are visible by trip and can be captured from the field into the canonical document lifecycle |
| D-07 | Driver pay and settlement visibility | mobile pay UI, settlement APIs, permissions | Driver can see allowed settlement and pay details without exposing back-office-only controls |
| D-08 | Offline queue, sync, and conflict handling | mobile storage/services, sync engine, retry logic | Core field actions queue offline, replay safely, and surface conflicts deterministically |
| D-09 | Mobile auth, session, and device hardening | mobile auth flows, token/session handling, error states | Authentication, re-auth, session expiry, and lost-connectivity behavior are safe and predictable in field conditions |
| D-10 | Push, alert, and acknowledgement path | notification services, mobile alert UX, acknowledgement model | Critical operational alerts reach the driver and capture acknowledgement or visible failure |
| D-11 | Pilot-channel release and legal readiness | build config, store metadata, privacy/legal docs, crash reporting | Pilot build is signable, distributable, policy-complete, and crash-observable on the supported device matrix |
| D-12 | Driver field-loop certification | certified mobile journey tests, operator checklist, release evidence pack | Assignment-through-proof mobile loop is certified end to end in staging and pilot conditions |

#### Phase E Story Pack: Compliance And Telemetry Completion

| Story ID | Story | Primary Touch Areas | Done When |
|---|---|---|---|
| E-01 | Provider abstraction hardening | `server/services/gps/*`, provider contracts, config model | Telematics providers share a stable abstraction for auth, ingest, health, retry, and mapping |
| E-02 | Primary provider production path | Samsara adapter, provider setup UI, provider credential flows | One named provider works end to end with production-grade setup, sync, and visible failure states |
| E-03 | Vehicle, trailer, driver, and asset mapping closure | telematics mapping UI, equipment records, provider sync | Provider entities map cleanly to internal drivers, vehicles, and equipment with conflict handling |
| E-04 | Live telemetry ingest, health, and replay | webhook/sync routes, tracking services, job runners | Telemetry events ingest reliably, expose health state, and can replay or backfill after outage |
| E-05 | Trip-linked telemetry consumer layer | dispatch views, trip timeline, stop state consumers, IFTA hooks | Telemetry flows into dispatch, trip history, and compliance consumers from one canonical event stream |
| E-06 | HOS display and conflict handling | future ELD/HOS services, mobile/office HOS views, conflict logic | HOS data is visible, stale or conflicting states are surfaced, and unsupported cases are represented honestly |
| E-07 | IFTA evidence ingestion and gap detection | IFTA services, review UI, mileage/fuel evidence paths | Mileage and fuel evidence ingest consistently and gap detection surfaces actionable missing evidence |
| E-08 | Quarter-close lock, review, and audit export | IFTA close workflows, packet generation, lock semantics | IFTA quarter close produces a locked, reproducible packet with traceable evidence |
| E-09 | Compliance cockpit truth model | compliance routes/UI, status metadata, source-of-truth fields | Every compliance status shows source, freshness, verifier state, and whether it is manual, derived, or synced |
| E-10 | Permits, deadlines, and annual filing continuity | compliance scheduler, permit records, reminder logic | IRP, UCR, HVUT/2290, permits, and annual deadlines are tracked with reminders and evidence continuity |
| E-11 | Maintenance scheduling and return-to-service continuity | maintenance UI, repair records, inspection workflows | Maintenance and inspection actions connect equipment status, repair records, and return-to-service state |
| E-12 | DVIR defect, repair signoff, and photo flow | DVIR UI/routes, attachment model, repair workflow | DVIR supports field submission, photo evidence, defect escalation, repair signoff, and return-to-service |
| E-13 | Safety, incident, certificate, and inspection lifecycle | safety routes/UI, certificate records, incident workflows | Safety-critical records maintain field-to-office continuity and auditability across the full lifecycle |
| E-14 | Telematics-to-compliance certification | cross-domain tests, telemetry fixture packs, audit exports | Provider-backed telemetry path and compliance workflows are certified together, not as separate demos |

#### Phase F Story Pack: Financial And Commercial Completion

| Story ID | Story | Primary Touch Areas | Done When |
|---|---|---|---|
| F-01 | Settlement rule engine completion | settlement services, schema, review UI | Settlement generation covers core trip/load cases with explicit rate, deduction, reimbursement, and provenance logic |
| F-02 | Settlement review, posting, and immutability | settlement posting flows, audit events, permissions | Posted settlements are immutable except through explicit adjustment workflows with audit trail |
| F-03 | AP workflow certification | AP routes, bill entry, approvals, payment state | Accounts payable can move from evidence to payable state without spreadsheet side-processes for core cases |
| F-04 | AR, invoicing, and aging completion | invoice routes, customer invoice UI, aging views | Accounts receivable, invoice issuance, status, and aging operate end to end from canonical load/commercial data |
| F-05 | GL, journal, and close baseline | accounting services, journal entry flows, close-state controls | Financial events land in consistent ledger structures and support core close activities without data drift |
| F-06 | Reconciliation and exception handling | reconciliation services/views, sync exceptions, audit reports | Sync mismatches, payment mismatches, and missing postings surface in an actionable reconciliation console |
| F-07 | QuickBooks sync completion | `server/routes/quickbooks.ts`, QuickBooks service, mapping UI | QuickBooks supports connect, sync, retry, visible error states, and reconciliation for the supported entities |
| F-08 | Stripe subscription and billing completion | `server/routes/stripe.ts`, billing services, tenant billing UI | Stripe supports subscription/billing lifecycle, webhook handling, failure visibility, and tenant billing truth |
| F-09 | Customer and broker master normalization | contacts, providers, network records, master-data services | Customer and broker identities no longer fork across quotes, loads, settlements, and invoices |
| F-10 | Quote, load, proof, invoice, and payment continuity | quote/bookings, loads, documents, AR/AP views | Commercial lineage from quote through proof and invoice/payment is queryable and operator-visible |
| F-11 | Broker payment intelligence groundwork | broker performance/payment views, source linkage, exception reporting | Broker payment status and performance metrics derive from canonical financial and operational records |
| F-12 | Financial controls and approval baseline | permissions, approvals, adjustment flows, audit events | Financially material actions require the correct approvals and leave a durable audit trail |
| F-13 | Back-office workflow certification | cross-domain tests, finance runbooks, reconciliation evidence | Finance and commercial workflows are certified end to end for supported fleet operating cases |

#### Phase G Story Pack: Operate, Launch, And Scale

| Story ID | Story | Primary Touch Areas | Done When |
|---|---|---|---|
| G-01 | Real email provider completion | email services, templates, provider credentials, bounce handling | Email delivery is no longer stubbed and exposes success, retry, and failure state |
| G-02 | Real SMS provider completion | SMS services, Twilio integration, provider status, retry flows | SMS delivery is real, observable, and policy-compliant for the supported use cases |
| G-03 | Notification delivery and acknowledgement model | message/notification jobs, delivery state schema, read state | Notifications have canonical queued, sent, delivered, failed, and acknowledged states where applicable |
| G-04 | Operational alerts and escalation rules | alerting config, critical-event routing, escalation flows | Critical domain events create the right alerts and escalations for operations and support |
| G-05 | Notification and job observability | job dashboards, retry controls, dead-letter visibility, support tooling | Operators can see notification/job health, backlogs, retries, and failures without digging through logs |
| G-06 | Structured logging and correlation standard | backend/frontend/mobile logging, request ids, correlation ids | Logs across services and clients are structured and correlate a workflow across route, job, and UI layers |
| G-07 | Sentry and runtime error strategy completion | Sentry client/server wiring, release/env tagging, alert routing | All major runtime surfaces emit actionable error telemetry with environment and release context |
| G-08 | Service ownership, on-call, and runbook completion | docs, ownership map, incident templates, escalation matrix | Every production-critical subsystem has an owner, on-call path, and usable runbook |
| G-09 | Deployment, rollback, and recovery drills | deployment scripts/docs, rollback flows, backup restore evidence | Blue-green or equivalent rollout, rollback, and restore procedures are proven in drills |
| G-10 | Feature flags and progressive rollout controls | feature-flag routes/services, rollout policy, kill-switch tooling | New capabilities can be gated by tenant/tier and disabled safely during incidents |
| G-11 | Release evidence bundle and launch checklist | release docs, verification pack templates, launch signoff | Every release can produce a repeatable evidence bundle showing what changed and how it was verified |
| G-12 | Product truth matrix and customer-facing alignment | sales/support docs, implementation status matrix, release notes | Sales, support, implementation, and product all speak from the same truth table for live vs partial vs planned |
| G-13 | Repo and environment hygiene cleanup | stale directories, environment docs, config sprawl, secrets handling | Repo hygiene issues and environment inconsistencies that undermine trust are removed or documented with controls |
| G-14 | Pilot and production support model | support playbooks, escalation ownership, pilot ops dashboards | Pilot fleets and production fleets have an explicit support and escalation operating model |
| G-15 | Operate-and-launch certification | runbook drills, alert tests, support checklist, release evidence | The product can be operated, supported, rolled back, and truthfully launched without hidden manual heroics |

#### Phase H Story Pack: Enterprise-Grade Expansion

| Story ID | Story | Primary Touch Areas | Done When |
|---|---|---|---|
| H-01 | Versioned public API contract | future `server/routes/public-api/*`, contracts, auth model | A versioned API namespace exists with explicit resource contracts and deprecation policy |
| H-02 | Tenant API keys, scopes, and rate limits | API key routes/services, rate limiting middleware, audit events | API keys can be issued, rotated, revoked, scoped, and rate-limited per tenant |
| H-03 | Outbound webhook platform | future webhook routes/services, event subscriptions, signing | Tenants can subscribe to supported domain events and receive signed, retryable outbound webhooks |
| H-04 | Developer docs and sandbox path | developer docs portal, examples, sandbox guidance, test tenants | External developers have documentation and a safe path to integrate without production guesswork |
| H-05 | SSO / SAML identity path | future SSO routes/services, auth config, tenant settings | Enterprise tenants can authenticate through supported SSO/SAML flows with correct tenant boundaries |
| H-06 | SCIM or bulk provisioning path | provisioning services, admin UI, identity contracts | Enterprise user provisioning can be automated or bulk-managed with auditability |
| H-07 | Customer onboarding and migration toolkit | import UI, mapping flows, server scripts, dry-run/reporting | Existing fleet data can be imported through guided mapping, validation, preview, and rollback-capable tooling |
| H-08 | Data export, portability, retention, and legal holds | export services, retention policy, archive tooling, admin controls | Customers can export their data, retention rules are explicit, and legal-hold style requirements are supportable |
| H-09 | Data residency and multi-region control path | deployment architecture docs, infra config, tenant data policy | Regional storage/processing constraints and future multi-region strategy are explicit and technically grounded |
| H-10 | Internationalization, multi-currency, and unit framework | shared formatting utilities, currency/unit model, localization framework | Currency, unit, locale, and cross-border presentation rules are supported without ad hoc duplication |
| H-11 | Reporting scale and analytical workload separation | reporting services, export jobs, warehouse/mart design, BI integration hooks | Historical analytics and reporting no longer depend solely on the OLTP path and can scale separately |
| H-12 | Enterprise financial controls and period governance | approval controls, period locks, adjustment journals, audit retention | Enterprise-grade financial controls exist for approvals, period locks, retention, and adjustment governance |
| H-13 | Enterprise DR, SLA, and audit-evidence path | DR docs, backup evidence, uptime/error budgets, audit bundles | Recovery targets, availability expectations, and audit evidence for enterprise customers are explicit and testable |
| H-14 | Enterprise-grade certification and truth update | enterprise readiness checklist, sales truth matrix, support docs | Enterprise claims are only enabled for capabilities that have evidence-backed completion, not roadmap intent |

### 11.3 Feature Coverage Crosswalk

No capability area should appear only in a workstream narrative without a matching delegated story. This crosswalk is the integrity check for that rule.

| Capability Area | Phase Story Coverage |
|---|---|
| route hardening, RBAC, pagination, health, rate limiting, idempotency | A-01 through A-08 |
| canonical load / trip / stop architecture and lineage foundation | A-09 through B-10 |
| quote, booking, load, dispatch, exception, document core loop | C-01 through C-10 |
| driver mobile, offline, messaging, alerts, release readiness | D-01 through D-12 |
| telematics, provider health, HOS visibility, IFTA, compliance, DVIR, maintenance | E-01 through E-14 |
| settlements, AP, AR, GL baseline, QuickBooks, Stripe, commercial continuity | F-01 through F-13 |
| messaging providers, notifications, observability, runbooks, rollout, launch truth | G-01 through G-15 |
| public API, enterprise identity, migration tooling, export, residency, i18n, enterprise controls | H-01 through H-14 |

Integrity rule:

- if a feature cannot be pointed to in this crosswalk, it is not planned deeply enough to delegate
- if a delegated story touches an area not represented in the crosswalk, the crosswalk must be updated before delegation
- no feature may be marketed as complete until its owning stories and its certification story are both complete

### 11.4 Dependency Alignment Rules

These rules keep delegated stories from drifting out of order or silently creating duplicate implementations.

Phase dependency rules:

- no Phase B lineage strictness story should enforce non-null parentage until Phase A schema foundations are landed and backfill paths exist
- no Phase C dispatch or document closure story may invent a second execution model outside the canonical `load` / `trip` / `stop` rules established in Phase A and Phase B
- no Phase D mobile story may create driver-only status semantics that diverge from the canonical dispatch and trip state machine from Phase C
- no Phase E telemetry or compliance story may create a second source of trip truth; telemetry enriches trip execution and compliance evidence, it does not redefine them
- no Phase F financial story may post, settle, invoice, or reconcile against records that are not lineage-linked according to Phase B
- no Phase G launch or truth-alignment story may mark a capability as production-ready if its owning implementation and certification stories in earlier phases are incomplete
- no Phase H enterprise claim may be enabled by documentation alone; enterprise-facing stories require implementation evidence, operational controls, and updated truth-matrix language

Cross-phase contract rules:

- `load` remains the commercial object across all phases
- `trip` remains the execution object across all phases
- `load_legs` remains the stop layer unless deliberately evolved in place; no parallel stop model may be introduced
- document mutation remains human-reviewed before sensitive writes across all phases
- integrations enrich or synchronize canonical records; they do not become silent alternate systems of record
- all certification stories validate existing feature stories; they must not hide unresolved implementation under a broad "test stabilization" label

Delegation stop conditions:

- if a delegated story needs to change a canonical contract owned by an earlier phase, the plan must be amended before the story starts
- if a delegated story touches more than one phase's ownership boundary, it must be split unless the shared contract change is explicit
- if verification cannot prove the story without manual interpretation, the story is under-specified and must be rewritten before delegation

## 12. End-To-End Certification Journeys

These are the minimum certified journeys required before claiming a full operating system.

### Journey 1: Quote To Cash

Path:

- quote created
- quote approved
- booking created
- load created
- load dispatched
- delivery completed
- proof received
- settlement generated
- invoice issued
- AR tracked

Evidence required:

- route tests
- service tests
- UI tests
- E2E run
- data lineage report

### Journey 2: Driver Trip Execution

Path:

- driver receives assignment
- trip appears in mobile
- driver updates statuses
- driver scans docs
- driver reports issue
- trip completes
- final packet visible
- pay visibility updates

### Journey 3: Document Automation

Path:

- upload or scan
- OCR extraction
- review
- patch / apply
- attach to domain objects
- export in packet

### Journey 4: IFTA Quarter Close

Path:

- mileage and fuel evidence ingested
- gaps detected
- exceptions resolved
- evidence locked
- packet exported

### Journey 5: Telematics To Compliance

Path:

- provider configured
- live sync active
- trip telemetry recorded
- telemetry contributes to ops and compliance views

### Journey 6: Breakdown / Exception Management

Path:

- field report created
- dispatcher sees issue
- work item or escalation created
- operational resolution recorded
- downstream financial or compliance action linked if needed

### Journey 7: Tenant Admin And Access

Path:

- tenant setup
- users invited
- roles assigned
- feature access enforced
- first operational workflow completed

### Journey 8: Safety / Maintenance / DVIR

Path:

- inspection due
- DVIR submitted
- defect escalated
- repair recorded
- return-to-service logged

## 13. Testing And Verification Strategy

### 13.1 Verification Layers

- unit tests for domain logic
- integration tests for repository and route contracts
- E2E tests for canonical journeys
- regression tests for security and tenant isolation
- migration tests for schema changes
- performance tests for critical endpoints and uploads
- mobile offline / reconnect tests

### 13.2 Required Quality Bars

- every protected route has auth and tenant tests
- every state machine has positive and negative path coverage
- every financial mutation has audit assertions
- every integration has happy path, expired credential, timeout, and provider-error tests
- every certified journey has staging-grade evidence

### 13.3 CI Gates

- route audit
- forbidden patterns
- frontend and backend tests
- migration validation
- critical E2E journey subset
- coverage trend checks

### 13.4 Acceptance Criteria Testability Rule

No workstream acceptance criterion is considered valid unless it can be verified by one or more of the following:

- automated test
- reproducible operator checklist
- generated report or SQL query
- staging evidence run
- runbook drill
- explicit data quality report

Examples:

- "zero unguarded protected routes"
  - verified by automated route-audit test
- "no duplicate truths across lineage-critical domains"
  - verified by orphan-row and duplicate-parent SQL reports
- "compliance statuses are honest, sourced, and current"
  - verified by non-null `source_type`, `source_of_truth`, and `verified_at` checks plus UI rendering tests
- "driver can complete the field loop end to end"
  - verified by certified mobile E2E and operator runbook execution
- "financial workflows no longer require side spreadsheets"
  - verified by certified journey coverage plus pilot implementation checklist showing no external manual dependency for core cases

Every future PLAN and PRD derived from this master plan must include a "how this is verified" field per acceptance criterion.

## 14. Integration Strategy

### 14.1 Priority Integration Partners

Tier 1:

- Motive or Samsara for telematics / ELD pilot
- QuickBooks for accounting sync
- Stripe for billing
- Twilio for SMS
- production email provider

Tier 2:

- fuel card providers
- secondary telematics / ELD providers
- banking / card reconciliation data sources

### 14.2 Integration Rules

- no "complete" status without production-grade credential, sync, and error handling support
- every integration has a health state
- every integration has a visible setup path
- every integration has an operator-facing failure mode

## 15. Operational Readiness

The product is not production-ready until these are complete.

### 15.1 Support And On-Call

- service ownership map
- on-call primary and backup
- incident severity framework
- escalation matrix
- customer communication templates

### 15.2 Runbooks

- auth outage
- DB degradation
- OCR provider degradation
- telematics provider outage
- job backlog and retry failures
- deployment rollback
- corrupted or missing evidence investigation

### 15.2.1 Deployment, Blue-Green, And Rollback Policy

The platform must follow a deployment model that assumes schema migrations and multi-tenant risk.

Required policy:

- prefer additive migrations first, destructive migrations later
- all migrations must be reversible in plan, even if not mechanically reversible in one command
- blue-green or equivalent staged deployment is required for application code where feasible
- feature-flag rollout is preferred for high-risk workflow changes

Mandatory deployment artifacts:

- pre-deploy backup confirmation
- migration execution plan
- rollback decision point
- post-deploy smoke checklist
- rollback smoke checklist

Rollback model:

- app rollback must be possible independent of data rollback when schema changes are additive
- data rollback must use restore / repair playbooks rather than ad hoc SQL
- any non-additive migration requires a documented contingency plan before deploy

Recovery targets must be explicitly documented:

- target RPO
- target RTO
- restore verification checklist

### 15.2.2 Backup And Recovery Requirements

- scheduled backups documented and monitored
- restore test performed on a cadence
- evidence of successful restore retained
- customer-impacting data repair playbook exists for corrupted lineage, documents, and financial records

### 15.3 Observability

- structured logs
- request correlation
- background job metrics
- provider sync metrics
- mobile error capture
- core business KPI dashboard

### 15.4 Feature Flags And Progressive Rollout

Feature flag infrastructure is part of operational readiness, not optional product garnish.

Required capabilities:

- per-tenant feature gating
- kill switch for newly launched workflows
- staged rollout path
- production incident rollback via flags where feasible
- tier-based access control support
- visibility into flag state by tenant and environment

## 16. Legal, Compliance, And Commercial Truth

### 16.1 Legal And Regulatory Requirements

- privacy policy updated for location, camera, documents, and messaging
- terms of service updated for SaaS and mobile
- data retention policy documented
- billing and payment responsibilities clarified
- compliance disclaimers reviewed by counsel

### 16.2 Truth Matrix

Every externally visible feature must be labeled internally as:

- complete
- pilot
- partial
- integrated
- stub
- planned

This matrix should drive:

- sales demos
- implementation playbooks
- support playbooks
- release notes

## 17. Staffing And Governance

Suggested ownership model:

- platform hardening lead
- data model and migrations lead
- dispatch and operations lead
- document automation lead
- mobile / driver lead
- compliance and safety lead
- integrations lead
- accounting and finance lead
- observability and release lead

Governance rules:

1. No new breadth while a critical trust gap remains open in the same domain.
2. Every domain has one owner for final acceptance.
3. Every phase has an evidence bundle, not just merged code.
4. ADE / Ralph outputs must feed the truth matrix and certification artifacts.

### 17.1 ADE / Ralph Execution Mapping

This master plan is not the executable sprint plan. It is the parent program document.

Execution rules:

- each workstream is decomposed into one or more `PLAN.md` + `prd.json` sprint plans
- each sprint gets its own `plan_hash`
- each sprint gets its own scoped branch and evidence bundle
- no sprint should mix unrelated workstreams unless explicitly intended for a certification or cutover objective

Recommended requirement namespace:

- `R-FLEET-W0-XX` for Workstream 0
- `R-FLEET-W1-XX` for Workstream 1
- ...
- `R-FLEET-W11-XX` for Workstream 11

Recommended sprint structure:

- Workstream 0 breaks into:
  - route hardening
  - auth / tenant regression closure
  - pagination / health / timeout hardening
  - `server/index.ts` modularization
- Workstream 1 breaks into:
  - canonical model decisions
  - lineage migrations
  - backfill and orphan handling
  - lineage verification reporting
- Each remaining workstream should split into discovery, implementation, certification, and hardening sprints as needed

Parallelism rules:

- Workstream 0 hardening should not run in parallel with risky broad feature sprints in the same routes
- Workstream 3 document completion can overlap with Workstream 7 finance closure if lineage contracts are stable
- Workstream 4 driver work can overlap with Workstream 5 provider integration if the API contracts are frozen
- Workstream 11 enterprise path should generally start after small / mid-market critical loops are stable

### 17.2 Required Sprint Artifacts

Every sprint derived from this plan should include:

- exact requirement markers
- exact affected file inventory
- explicit verification commands
- rollback note
- certification evidence targets
- truth-matrix impact

## 18. Success Metrics

### Product Metrics

- percentage of core workflows completed without external spreadsheet / email dependency
- percentage of trips with complete document packets
- percentage of settlements generated without manual source reconstruction
- percentage of compliance statuses with verified source metadata

### Reliability Metrics

- zero tenant-isolation regressions
- zero unguarded protected routes
- p95 latency on critical APIs
- upload success rate
- background job success rate
- integration sync health

### Adoption Metrics

- dispatcher weekly active usage across core loop
- driver trip completion using in-app workflow
- document automation adoption rate
- IFTA packet export usage

## 19. Immediate Priorities

The next execution block should focus on the smallest set of work that materially changes trust and completeness.

Priority order:

1. Complete Workstream 0 hardening.
2. Produce the canonical entity and lineage map from Workstream 1.
3. Certify quote-to-load-to-settlement and document automation journeys.
4. Complete driver field loop and mobile readiness gap review.
5. Lock provider strategy for telemetry / ELD and finish one real partner path.
6. Build operational readiness baseline and truth matrix.

## 20. Detailed Execution Checklist

This section converts the workstreams into concrete execution items.

### 20.1 Platform Hardening Checklist

- inventory every route under `server/routes/`
- verify the known allowlist and known findings:
  - `POST /api/demo/reset`
  - `GET /api/feature-flags`
  - `PUT /api/feature-flags/:name`
  - SPA fallback `GET /*`
- mark every route as public, authenticated, tenant-scoped, role-scoped, tier-scoped, or internal
- add missing `requireAuth`
- add missing `requireTenant`
- add missing request validation
- remove client-only enforcement for sensitive actions
- add pagination to list-heavy routes
- add rate limiting and idempotency where required
- add regression tests for every fixed route-hardening defect
- make route audit a required CI gate
- audit exports, downloads, and file serving paths for tenant isolation
- audit background jobs for tenant-aware data access
- verify no legacy bypass remains on admin-only or support-only code paths
- refactor `server/index.ts` into bootstrapping delegates
- verify post-refactor runtime route registration equivalence

### 20.2 Trip-Linked Data Model Checklist

- define canonical ownership for trip versus load
- enforce the explicit ruling:
  - load = commercial object
  - trip = execution object
  - stop = operational atom
- document the lifecycle relationship between quote, booking, load, trip, stop, settlement, and invoice
- define required foreign-key links for documents
- define required foreign-key links for financial events
- define required foreign-key links for telematics and compliance events
- add missing columns or join tables needed for lineage
- produce a lineage query or report for each certified journey
- remove duplicate shadow models or stale aliases where possible
- sequence migrations in dependency order
- define orphan handling review queues
- define nullable-to-strict transition rules

### 20.3 Dispatch And Load Loop Checklist

- certify quote creation and approval path
- certify booking conversion path
- certify load creation path
- certify assignment path
- certify dispatch path
- certify en route status path
- certify arrival and delivered path
- certify completed path
- verify every transition has valid and invalid-path tests
- verify the UI renders the same state model as the API and DB
- verify exceptions, notes, and communications attach to the same trip / load

### 20.4 Document Automation Checklist

- finalize document taxonomy
- standardize OCR result schema by document class
- standardize review UI by document class
- add duplicate detection by content hash and metadata
- add completeness rules by trip
- add completeness rules by settlement
- add completeness rules by compliance period
- add lock semantics for reviewed / finalized evidence
- add downstream patch rules with audit logging
- add packet exports by trip, settlement, and IFTA period

### 20.5 Driver Operating Layer Checklist

- finalize mobile IA and trip-first home screen
- complete stop sequence and appointment display
- complete status update controls
- complete issue and breakdown reporting
- complete document checklist and required-document prompts
- complete offline capture queue and sync retry
- complete pay / settlement view
- complete messaging read-state and notification handoff
- complete mobile auth, session persistence, and logout
- complete store, legal, and device baseline
- complete build signing and internal distribution
- complete privacy policy and permission copy approval
- complete crash reporting activation
- complete pilot device matrix and beta feedback intake

### 20.6 Telematics And ELD Checklist

- select pilot provider
- define adapter interface
- implement credential flow
- implement config validation flow
- implement sync health reporting
- implement live-status display
- implement vehicle / driver mapping integrity
- implement error and retry strategy
- feed telemetry into trip, map, and IFTA evidence surfaces
- define HOS display contract and fallback behavior

### 20.7 Compliance And Safety Checklist

- finish IFTA evidence closure and packet workflow
- define honest status framework: integrated, manual, document-backed, unknown
- add verified-at timestamps and source labels
- add IRP, UCR, HVUT / 2290, permit, and deadline surfaces
- complete certificate and inspection alerting
- complete maintenance schedule workflow
- complete DVIR workflow
- complete return-to-service workflow
- ensure no compliance status shows false green on missing data

### 20.8 Accounting And Finance Checklist

- complete settlement generation flow
- complete settlement review / post / adjustment flow
- complete AP / AR CRUD and approvals
- complete invoice aging and tracking
- complete QuickBooks sync
- complete Stripe billing and subscription
- complete financial audit log coverage
- complete reconciliation and exception views
- tie every material financial event to a source operational event

### 20.9 CRM And Commercial Continuity Checklist

- normalize party and contact records
- clean broker / customer master data ownership
- tie quotes and bookings to final loads
- tie loads to invoices and customer artifacts
- expose broker payment and performance signals where supported by data

### 20.10 Ops And Support Checklist

- define service ownership
- define alert routing
- define incident severity levels
- define rollback criteria
- define support escalation paths
- define customer communication templates
- define release evidence package
- define truth matrix review before every major demo or launch

### 20.11 Enterprise Readiness Checklist

- define SSO / SAML target architecture
- define SCIM or equivalent provisioning path
- define public API versioning policy
- implement tenant API key lifecycle
- define webhook event model
- define developer documentation strategy
- define data export / portability package
- build CSV import and migration tooling
- define feature-flag kill-switch and progressive rollout rules
- define long-term audit retention policy
- define RPO / RTO targets
- define restore-test cadence
- define data residency and regionalization strategy
- define multi-currency and unit-handling strategy
- define segregation-of-duties and period-lock requirements

## 21. First 90 Days

The first 90 days should be run as three execution waves.

### Days 1-30

- complete route and tenant hardening
- close server-side RBAC gaps
- define canonical entity ownership
- define lineage matrix
- certify quote-to-load path
- certify load-to-settlement path
- produce truth matrix v1

### Days 31-60

- complete document completeness and export rules
- complete driver field loop closure
- complete offline queue stabilization
- choose and implement one provider-backed telemetry path
- complete IFTA quarter-close workflow

### Days 61-90

- complete DVIR and maintenance core workflow
- complete accounting sync priorities
- complete support and observability baseline
- complete pilot rollout playbooks
- certify the top 8 end-to-end journeys in staging-grade environments

## 22. Commercial Readiness By Customer Segment

### Owner-Operator / Small Fleet

Target outcome from Workstreams 0-10:

- fully credible and supportable target segment
- complete trip-linked workflow achievable
- strongest product-market fit for current program scope

### Mid-Market Fleet

Target outcome from Workstreams 0-10 plus selected Workstream 11 items:

- credible target segment if migration, feature flags, reporting, and integration reliability are completed
- requires stronger onboarding and operational rigor than owner-operator launch

### Enterprise Fleet

Target outcome requires meaningful Workstream 11 completion:

- not implied by the small / mid-market completion path
- requires identity, controls, API, DR, retention, regionalization, and scale architecture to be explicitly delivered

## 23. Final Program Verdict

LoadPilot does not need a new product vision. It needs disciplined completion.

The real path to a full trucking fleet operating system is:

- secure the platform
- formalize the trip-linked data spine
- close the loops already started
- integrate the systems that should not be built from scratch
- certify every claim with end-to-end evidence
- operate the product like real infrastructure

When those conditions are met, the "fleet operating system" claim becomes true instead of aspirational.
