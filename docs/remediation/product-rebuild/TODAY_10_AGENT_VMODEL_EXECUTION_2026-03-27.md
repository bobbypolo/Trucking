# Today Execution Document: 10-Agent Parallel V-Model Remediation

Date: 2026-03-27
Owner: Product remediation lead
Execution mode: Same-day closeout
Delivery doctrine: V-model SDLC

## Purpose

This document is the single execution source of truth for the current remediation push.

The objective is not to produce partial fixes, placeholder screens, or deferred follow-up tasks. The objective is to close each assigned area to a production-ready state today, with verification proving that the issue is remediated and the feature is complete before the agent moves on.

All 10 agents work in parallel where possible. Parallelism is allowed only when ownership and interfaces are clear. If a lane depends on another lane's contract, the downstream lane may design and prepare tests, but it may not finalize implementation until the upstream contract is confirmed.

This document must be executed together with [CANONICAL_WORKFLOW_AND_SYSTEMS_OF_RECORD_2026-03-27.md](/F:/Trucking/DisbatchMe/docs/remediation/product-rebuild/CANONICAL_WORKFLOW_AND_SYSTEMS_OF_RECORD_2026-03-27.md), [STRICT_TERMINOLOGY_AND_DECISION_RULES_2026-03-27.md](/F:/Trucking/DisbatchMe/docs/remediation/product-rebuild/STRICT_TERMINOLOGY_AND_DECISION_RULES_2026-03-27.md), and [CONVERSATION_ISSUE_REGISTRY_2026-03-27.md](/F:/Trucking/DisbatchMe/docs/remediation/product-rebuild/CONVERSATION_ISSUE_REGISTRY_2026-03-27.md). Scope completion is not valid unless the lane also preserves the canonical workflow, strict terminology rules, and captured-issue coverage defined there.

## Baseline Already Confirmed

These items are already confirmed in the current codebase and are not open remediation lanes unless a lane uncovers a regression:

- Authentication itself is intact. The frontend/backend break was a Vite dev proxy port mismatch, and the current fix restores the proxy to backend port `5000` with dotenv-based alignment.
- `Broker Network` has already been renamed at the shell level to `Onboarding`.
- Standalone Fleet Map navigation has already been removed at the shell level. Fleet tracking is expected to remain embedded in operational surfaces, while `Telematics` is the provider setup/configuration surface.

Agents must not reopen these as design debates. They may only touch them if required to prevent regression or to complete the intended remediated end state.

## Original Issue Coverage Matrix

Every concern from the original product remediation list must be explicitly covered by an owning lane. Nothing is allowed to sit in an implied "someone will get to it" state.

- Auth proxy mismatch and preserved auth flow:
  - Baseline confirmed only. No lane reworks authentication unless a regression is introduced.
- Fleet map removal, telematics page meaning, and generic hookup for provider integrations:
  - Agent 3 owns the full remediation.
- Quotes/booking overlap with accounting and dispatcher-owned quote calculations:
  - Agent 8 owns commercial workflow boundaries.
  - Agent 4 owns the accounting-side consolidation boundary.
- Driver intake from documents to load creation to scheduling:
  - Agent 2 owns the full remediation.
- Driver Pay and Settlements duplication/missing driver-facing pay:
  - Agent 1 owns the full remediation.
  - Agent 4 must remove duplicate pay ownership from the accounting shell.
- Driver pay visibility was removed from driver-role workflow and must be restored as a real reachable experience:
  - Agent 1 owns the full remediation.
  - Agent 10 owns final shell/route integration for the experience.
- AR/AP redundancy and one accounting dashboard:
  - Agent 4 owns the full remediation.
- File Vault duplication and one master vault/document domain:
  - Agent 9 owns the canonical document model.
  - Agent 4 consumes it inside Financials.
- Maintenance as issues/alerts-driven work with accounting linkage only where appropriate:
  - Agent 6 owns the operational queue and maintenance escalation flow.
  - Agent 4 owns any financial recording boundary and must not keep maintenance as a separate accounting dashboard.
- Fuel and IFTA necessity, correctness, and database-backed behavior:
  - Agent 4 owns the full remediation.
- Hardcoded maintenance, financial, or tracking behavior that claims live truth:
  - Owning domain lane must either make it real or remove it from customer-visible workflow.
- Rules Engine uncertainty and removal if not justified by real platform needs:
  - Agent 4 owns the removal from Financials.
  - Agent 10 ensures the shell does not reintroduce it elsewhere.
- Broker/shippers/vendors/facilities/contractors and subcontractor equipment handling:
  - Agent 5 owns the canonical entity model.
- User settings pages not working and manual configuration of onboarded users/entities:
  - Agent 7 owns the user/company settings remediation.
- Final shell/product shape and retirement of duplicate surfaces:
  - Agent 10 owns the integrated end state.

## Non-Negotiable Delivery Rules

1. No agent moves from implementation to closeout without verification evidence.
2. No agent leaves behind fake actions, placeholder text, dead buttons, or "coming soon" product behavior in the assigned area.
3. No agent closes a work item if the assigned flow still depends on redundant manual re-entry caused by system gaps, silent fallback, or contradictory data models. Manual entry is acceptable only where the business explicitly allows it and automatic sourcing is not available.
4. All user-facing flows must be backed by real persisted data or an honest empty/error state.
5. All work must include tests at the level appropriate to the change:
   - unit/component tests for local logic
   - route/service tests for backend contracts
   - E2E or integration proof for the user-critical workflow
6. `App.tsx` is single-owner. No agent other than Agent 10 edits shell navigation or route wiring.
7. Shared contracts are owned centrally:
   - settlement status contract: Agent 1
   - document contract: Agent 9
   - exception-domain link contract: Agent 6
   - party DTO contract: Agent 5
8. No "we will clean this up later" debt is allowed in this sprint document.
9. Any feature listed under required binary decisions in the strict terminology document must be either made real or removed from customer-visible workflow by closeout.

## Hard Fail Conditions

Any lane is automatically rejected back to the previous V-model stage if any of the following is true:

- the lane changes labels or navigation copy without fixing the underlying ownership/model problem
- the lane leaves two primary user flows active for the same business task
- the lane relies on fallback behavior that drops fields, tags, documents, or permissions silently
- the lane claims completion without proving the original failure is no longer reproducible
- the lane leaves fake toasts, fake counts, fake posting actions, or fake status banners in production-facing UI
- the lane adds UI without backend/persistence proof for a workflow that must survive reload
- the lane adds backend behavior without integrating the corresponding user-facing workflow where the user story requires it
- the lane changes a shared contract without revalidating downstream consumers
- the lane leaves TODOs, commented-out alternates, or "temporary" duplicate routes inside the assigned scope
- the lane fixes its local surface but breaks the canonical workflow before or after its owned step
- the lane cannot state its authoritative record, derived records, and non-owned views clearly
- the lane leaves any required binary decision unresolved

## V-Model Operating Standard

Each agent must complete all five stages for its lane.

### Stage 1: Requirement Lock

The agent writes down the exact remediation target in code terms:

- what is broken now
- what the end-state behavior is
- what must be removed, not just added
- what data model or API is authoritative

Exit gate:

- the failure mode is explicitly named
- the end-state acceptance is explicit
- the owned files are known

### Stage 2: Design Lock

The agent defines the implementation shape before writing final code:

- canonical data contract
- authoritative record and derived-record statement
- UI ownership boundaries
- API ownership boundaries
- migration or compatibility plan
- test plan

Exit gate:

- interface conflicts are resolved
- no duplicate product surface remains by design
- workflow handoff to the prior and next canonical step is explicit
- tests are identified before code is finalized

### Stage 3: Implementation

The agent completes the full code path for the assigned workflow:

- frontend
- backend
- persistence
- validation
- permissions
- integration points

Exit gate:

- no fake success paths
- no unhandled partial-save corruption paths
- no stale parallel route or alternate model survives in the owned area

### Stage 4: Verification

The agent proves remediation, not just compilation:

- route tests pass
- component/unit tests pass
- integration/E2E proof exists for the workflow
- manual spot-check is documented when automated proof is insufficient
- upstream and downstream workflow step still behave correctly where this lane's changes affect the handoff

Exit gate:

- the issue is reproduced before the fix and no longer reproducible after the fix
- the new behavior matches the requirement lock
- the new behavior still honors the canonical workflow contract

### Stage 5: Closeout

The agent documents final outcome:

- files changed
- contracts changed
- tests added or updated
- residual risk, if any

Exit gate:

- there is no known remaining work inside the assigned scope
- any true dependency on another lane is explicit and verified

## Shared Ownership Matrix

### Single-file ownership

- Agent 10 exclusively owns [App.tsx](/F:/Trucking/DisbatchMe/App.tsx)
- Agent 4 exclusively owns [AccountingPortal.tsx](/F:/Trucking/DisbatchMe/components/AccountingPortal.tsx)
- Agent 9 exclusively owns the canonical document contract
- Agent 6 exclusively owns exception-domain sync semantics

### Cross-lane consumption rules

- Agent 1 may build pay-specific components and settlement UX, but must not reshape the accounting shell directly
- Agent 2 may consume the document contract, but must not invent a parallel document model
- Agent 4 must consume Agent 9's document model and Agent 1's settlement separation
- Agent 5 must not invent a second entity registry or continue silent `customers` fallback data loss
- Agent 6 must remove shadow issue state, not add another layer on top of it
- Agent 10 integrates all lanes but does not redefine their domain contracts

## Program-Level Definition of Done

The overall program is done only when all of the following are true:

- Driver intake creates a canonical load and canonical documents
- Load board and schedule render the same persisted intake truth after refresh
- Financials contains only accounting-owned surfaces
- Driver Pay exists as a real role-based pay experience, not a missing or duplicate destination
- Issues & Alerts is the operational queue for incidents, safety, maintenance escalations, and service tickets
- Onboarding is the canonical party/entity registry
- Embedded fleet tracking is truthful, provider-backed, and not a misleading standalone map product
- One canonical document domain exists across load, finance, and onboarding contexts
- Company and user settings persist and govern the above flows correctly
- No assigned area contains placeholder workflows, fake toasts, or deferred production debt
- Every issue from the original remediation list is explicitly closed by evidence or explicitly preserved as already-remediated baseline behavior
- The end-to-end trucking workflow is canonical from origin to closeout, with no orphan step and no duplicate primary path

## Agent 1: Driver Pay Consolidation

### Requirement Lock

Problem:

- Driver-facing pay as a real product destination has been effectively removed.
- Actual settlements exist in the accounting domain, but the driver sees only limited per-load pay visibility.
- Driver-role routing currently does not expose a real pay workspace at all.
- Financials access for `payroll_manager` and driver-role pay visibility must be corrected so required roles can reach their required workflows.
- Settlement status vocabulary and finalize flow are inconsistent.
- Settlement routes are not strongly permission-gated for view, edit, and approval operations.
- Current payroll actions collapse draft/review/approve into an immediate paid path.

End state:

- Driver Pay is a real role-based experience within the Financials domain.
- Drivers can view only their own settlement history and statements.
- Payroll/admin users can operate settlement approval/finalization workflows.
- Accounting retains its own overview/dashboard surface and does not become the driver-facing pay portal.
- Settlement IDs, statuses, and permissions are consistent end to end.

### Owned Files

- [components/Settlements.tsx](/F:/Trucking/DisbatchMe/components/Settlements.tsx)
- pay-specific portion of [components/DriverMobileHome.tsx](/F:/Trucking/DisbatchMe/components/DriverMobileHome.tsx)
- [services/financialService.ts](/F:/Trucking/DisbatchMe/services/financialService.ts)
- [server/routes/accounting.ts](/F:/Trucking/DisbatchMe/server/routes/accounting.ts)
- [services/authService.ts](/F:/Trucking/DisbatchMe/services/authService.ts)
- settlement-related schemas and types

### Design Lock

- Define the canonical settlement status set and normalize frontend/backend naming.
- Enforce driver self-scope on the server, not by trusting `driverId` query alone.
- Enforce role/capability checks on settlement read, edit, approve, and pay operations.
- Separate self-service pay view from payroll approval actions.
- Reuse settlement and document endpoints where they already support driver filtering.
- Make a binary decision on settlement statements:
  - make them real with a persisted statement artifact and verified linkage model
  - or remove statement generation/download from customer-visible workflow entirely

### Implementation Requirements

- add driver-facing pay history UI
- expose that pay workspace to driver-role routing in a real, reachable path
- if settlement statements are kept, expose only real linked statement artifacts
- fix `payroll_manager` Financials access
- fix finalize flow to operate on settlement IDs
- remove any raw fetch usage from pay path
- ensure drivers can understand how pay was derived without exposing accounting-only controls
- remove any local-only finalized/paid UI state that can claim success without persisted settlement changes
- restore a real settlement lifecycle instead of single-step "authorize and pay" shortcuts unless the backend lifecycle is explicitly redesigned and verified end to end

### Verification Gates

- route tests prove drivers cannot see other drivers' settlements
- route tests prove settlement permissions for driver, payroll, and admin roles
- settlement finalize path updates real settlement records
- settlement finalize/pay actions fail visibly when persistence fails
- component tests prove driver self-view and payroll operator view diverge correctly
- E2E proof: driver opens pay, sees only own data, payroll/admin sees management actions

### Completion Criteria

- no duplicate Driver Pay destination remains
- no missing driver pay experience remains
- no unresolved settlement status drift remains
- no fake statement artifact or false-success finalize state remains

## Agent 2: Canonical Driver Intake

### Requirement Lock

Problem:

- Driver intake currently creates a load shape that is not the same canonical persisted shape the app consumes after refresh.
- Intake metadata is collected but not reliably persisted.
- Document linkage and later save paths can erase attachments or lose context.

End state:

- Driver intake creates the same canonical persisted load truth used by load board and schedule.
- Intake documents are linked to the created load and survive refresh.
- Product-critical intake metadata survives reload.
- Manual field entry remains allowed where document extraction cannot source required values, but once submitted the intake result becomes canonical.

### Owned Files

- [components/DriverMobileHome.tsx](/F:/Trucking/DisbatchMe/components/DriverMobileHome.tsx)
- [services/loadService.ts](/F:/Trucking/DisbatchMe/services/loadService.ts)
- [services/storageService.ts](/F:/Trucking/DisbatchMe/services/storageService.ts)
- [server/routes/loads.ts](/F:/Trucking/DisbatchMe/server/routes/loads.ts)
- [server/routes/documents.ts](/F:/Trucking/DisbatchMe/server/routes/documents.ts)

### Design Lock

- canonical source of route/location truth is `legs`
- canonical source of intake documents is the document domain owned by Agent 9
- standard refresh path remains the propagation mechanism
- no synthetic client-only insertion is allowed as the source of truth

### Implementation Requirements

- replace or rewire current intake save path to canonical intake contract
- preserve load metadata the product actually needs
- stop wiping `podUrls` or equivalent doc references on generic save
- ensure `pickupDate` and leg dates cannot drift silently
- ensure driver-uploaded paperwork is sufficient to create the load without dispatcher re-entry

### Verification Gates

- route tests for intake write contract
- document route tests for `load_id` linkage
- component/integration tests for intake submission
- E2E proof: intake creates load, refreshes, appears on board and calendar

### Completion Criteria

- no refresh-induced route/location loss
- no document detachment on later edit
- no second intake path remains in parallel

## Agent 3: Telematics and Embedded Fleet Tracking

### Requirement Lock

Problem:

- Provider hookup is incomplete and misleading in places.
- Webhook test flow is broken.
- Live tracking can report misleading states through env/mock fallback.
- Embedded map still behaves like a full standalone control surface.

End state:

- one truthful embedded fleet tracking capability
- one active provider per tenant
- live state reflects real telemetry, not inferred load activity or mock fallback
- embedded map mode is compact and not duplicated by shell overlays
- `Telematics` is clearly provider setup/configuration, not a second map product

### Owned Files

- [components/TelematicsSetup.tsx](/F:/Trucking/DisbatchMe/components/TelematicsSetup.tsx)
- [components/GlobalMapViewEnhanced.tsx](/F:/Trucking/DisbatchMe/components/GlobalMapViewEnhanced.tsx)
- [components/CommandCenterView.tsx](/F:/Trucking/DisbatchMe/components/CommandCenterView.tsx)
- [server/routes/tracking.ts](/F:/Trucking/DisbatchMe/server/routes/tracking.ts)
- [server/services/gps/index.ts](/F:/Trucking/DisbatchMe/server/services/gps/index.ts)
- [server/services/gps/samsara.adapter.ts](/F:/Trucking/DisbatchMe/server/services/gps/samsara.adapter.ts)
- [docs/telematics-setup-guide.md](/F:/Trucking/DisbatchMe/docs/telematics-setup-guide.md)

### Design Lock

- webhook provider reads persisted positions, not env fallback
- vehicle mappings must be applied to live output
- active provider semantics must be enforced in backend and UI
- embedded map must expose a compact mode separate from full control mode

### Implementation Requirements

- fix Generic Webhook test path
- remove misleading webhook URL UX if the endpoint is fixed server-side
- make tracking state truthful
- suppress duplicate static/live markers
- remove hardcoded command-center tracking strip unless it is backed by real summary data

### Verification Gates

- route tests for webhook state, mapping, and no-mock truthfulness
- component tests for banner states and compact mode
- integration proof: admin configures provider and map reflects the real state

### Completion Criteria

- no `configured-live` from mock fallback
- no duplicate status surfaces
- no broken or misleading embedded tracking UX remains

## Agent 4: Financials Core IA

### Requirement Lock

Problem:

- Financials still mixes accounting-owned surfaces with driver pay, placeholder maintenance, a fake rules engine, and a weak audit surface.
- AR/AP are real-backed but key actions remain simulated.
- IFTA remains broader and riskier than the actual product should expose.

End state:

- one accounting dashboard containing only AR, AP, ledger/audit, docs, and Fuel/IFTA compliance
- no driver pay inside the accounting shell
- no maintenance or rules engine inside accounting
- no fake accounting actions or fake accounting copy
- incoming/outgoing financial obligations are labeled unambiguously so accounting is not split across redundant dashboards

### Owned Files

- [components/AccountingPortal.tsx](/F:/Trucking/DisbatchMe/components/AccountingPortal.tsx)
- [components/IFTAManager.tsx](/F:/Trucking/DisbatchMe/components/IFTAManager.tsx)
- [services/financialService.ts](/F:/Trucking/DisbatchMe/services/financialService.ts)
- [server/routes/accounting.ts](/F:/Trucking/DisbatchMe/server/routes/accounting.ts)
- any disposition or release note doc required to explain a binary feature removal or retention decision

### Design Lock

- AR and AP remain distinct objects inside one dashboard
- documents are filtered views over Agent 9's canonical document system
- settlements move out of the accounting shell
- audit/ledger must be either real and verified or removed from customer-visible workflow
- IFTA/Fuel must be either real and verified or removed from customer-visible workflow
- maintenance costs may link into accounting records, but maintenance work itself stays in the operational exception flow

### Implementation Requirements

- remove settlements tab from accounting shell
- remove maintenance tab from accounting shell
- remove rules engine tab from accounting shell
- make audit/ledger real and verified or remove the tab entirely
- replace fake AR/AP actions with real reachable workflows
- harden IFTA period scoping and posting safety
- fix any existing Fuel/IFTA database-backed failures before declaring completion
- remove raw unauthenticated-style fetch usage inside Financials-owned workflows

### Verification Gates

- component tests prove retained tabs only
- route tests cover audit/ledger when the feature is kept; otherwise the absence of the tab/route is verified
- route/service tests cover IFTA period correctness and posting safeguards
- integration proof: accounting user can complete retained finance flows without placeholder actions

### Completion Criteria

- no accounting-owned fake surfaces remain
- no driver pay duplication remains in this shell
- no placeholder maintenance/rules UX remains
- no ambiguous retained-vs-removed finance feature remains

## Agent 5: Universal Onboarding / Party Registry

### Requirement Lock

Problem:

- The onboarding UI is broader, but the DTO and persistence model are still inconsistent.
- Legacy and new entity classes are both present.
- Important party fields are not fully persisted.
- Fallback mode silently loses important data.

End state:

- one canonical party/entity registry for customer, broker, vendor, facility, contractor
- explicit alias policy for `Shipper` vs `Customer`
- no silent field loss in fallback mode
- subcontracted drivers/owner-operators and their equipment can be represented without inventing a second entity model

### Owned Files

- [components/NetworkPortal.tsx](/F:/Trucking/DisbatchMe/components/NetworkPortal.tsx)
- [services/networkService.ts](/F:/Trucking/DisbatchMe/services/networkService.ts)
- [server/routes/clients.ts](/F:/Trucking/DisbatchMe/server/routes/clients.ts)
- [server/schemas/parties.ts](/F:/Trucking/DisbatchMe/server/schemas/parties.ts)
- [types.ts](/F:/Trucking/DisbatchMe/types.ts)
- related migrations and schema snapshots

### Design Lock

- define canonical party DTO and field casing
- define alias policy for legacy types
- define fallback support policy explicitly
- define compatibility strategy for legacy `customers` consumers

### Implementation Requirements

- normalize snake_case/camelCase drift
- persist contractor/vendor/facility profile fields
- persist contacts, docs, tags, rates, constraints consistently
- update schema snapshot and migration path
- persist bring-your-own-equipment and relationship metadata where the business model requires it

### Verification Gates

- route tests for each entity class
- fallback-mode tests proving either safe support or explicit rejection
- E2E proof covering create, edit, and status update for party records

### Completion Criteria

- no lossy silent fallback remains
- no unresolved legacy type confusion remains
- no party profile data disappears after save/reload

## Agent 6: Issues & Alerts Canonical Queue

### Requirement Lock

Problem:

- Incidents, maintenance, service tickets, and safety escalations create links into exceptions only on create, not across lifecycle changes.
- Safety UI still writes shadow issue state.
- Exception drilldown is not domain-aware enough.

End state:

- `exceptions` is the operational queue
- domain records remain specialist detail records
- create, status, closure, and workflow sync works bidirectionally
- owner/assignment sync is deferred: exceptions carry their own owner field independently of domain records. This is a non-blocking gap — exception ownership is set at creation and updated through the exception UI, not inherited from the domain record. Amendment rationale: domain records (incidents, service tickets, maintenance) do not have a consistent owner/assignee field structure, making bidirectional owner sync architecturally premature without a cross-domain assignment model.

### Owned Files

- [components/ExceptionConsole.tsx](/F:/Trucking/DisbatchMe/components/ExceptionConsole.tsx)
- [components/SafetyView.tsx](/F:/Trucking/DisbatchMe/components/SafetyView.tsx)
- [server/routes/exceptions.ts](/F:/Trucking/DisbatchMe/server/routes/exceptions.ts)
- [server/routes/incidents.ts](/F:/Trucking/DisbatchMe/server/routes/incidents.ts)
- [server/routes/service-tickets.ts](/F:/Trucking/DisbatchMe/server/routes/service-tickets.ts)
- [server/routes/safety.ts](/F:/Trucking/DisbatchMe/server/routes/safety.ts)

### Design Lock

- define canonical exception-to-domain link contract
- define shared status mapping
- define shared category mapping source
- define linked-record drilldown contract

### Implementation Requirements

- add lifecycle sync on update/closure, not just create
- remove `load.issues` shadow writes
- rewire service-ticket flow to canonical route and queue
- make ExceptionConsole drill into linked records by `links.*Id`

### Verification Gates

- route tests for create, update, close, and tenant isolation
- component tests for queue filtering and linked drilldown
- integration proof: incident/service-ticket appears in Issues & Alerts and stays synced through closure

### Completion Criteria

- no orphaned or stale linked exceptions remain
- no second operational issue queue remains

## Agent 7: Company and User Settings

### Requirement Lock

Problem:

- Settings persistence exists but must become the authoritative admin control surface for the remediated workflows.
- Visibility, permissions, and governance defaults are still inconsistent in places.

End state:

- company and user settings fully govern the remediated flows
- admin edits persist and survive reload
- non-admin restrictions remain enforced

### Owned Files

- [components/CompanyProfile.tsx](/F:/Trucking/DisbatchMe/components/CompanyProfile.tsx)
- [components/EditUserModal.tsx](/F:/Trucking/DisbatchMe/components/EditUserModal.tsx)
- [services/authService.ts](/F:/Trucking/DisbatchMe/services/authService.ts)
- [server/routes/users.ts](/F:/Trucking/DisbatchMe/server/routes/users.ts)

### Design Lock

- align driver visibility settings with actual pay and portal behavior
- align role/capability settings with Financials, Issues, and onboarding workflows

### Implementation Requirements

- persist user edits cleanly
- normalize settings defaults and capability mappings
- remove contradictory permissions around settlements and driver pay visibility

### Verification Gates

- component and E2E tests for save/reload
- permission tests for admin vs non-admin behavior

### Completion Criteria

- settings are authoritative for the new flows
- no contradictory settings behavior remains

## Agent 8: Quotes and Commercial Boundary

### Requirement Lock

Problem:

- Quotes still exist as a separate workspace, but product ownership between commercial and accounting must be made explicit.
- Quote-to-load handoff must be real and operational, not a second finance workflow.

End state:

- quotes remain commercial-owned
- quote/booking conversion creates real operational load truth
- estimated pay in quoting never masquerades as settlement truth
- dispatcher-owned quote calculations stay in the commercial workflow and do not turn into accounting authority

### Owned Files

- [components/QuoteManager.tsx](/F:/Trucking/DisbatchMe/components/QuoteManager.tsx)
- [components/BookingPortal.tsx](/F:/Trucking/DisbatchMe/components/BookingPortal.tsx)
- [server/routes/quotes.ts](/F:/Trucking/DisbatchMe/server/routes/quotes.ts)
- [server/routes/bookings.ts](/F:/Trucking/DisbatchMe/server/routes/bookings.ts)

### Design Lock

- define explicit quote-to-load handoff contract
- define what commercial data becomes operational truth and what remains estimate-only

### Implementation Requirements

- remove any lingering accounting-like ownership from quote workflows
- ensure quote/booking conversion reaches canonical load creation flow
- ensure booking/quote UI does not duplicate accounting invoice/bill responsibilities

### Verification Gates

- route tests for quote and booking flow
- integration/E2E proof for quote-to-load conversion

### Completion Criteria

- no quote/accounting ownership confusion remains

## Agent 9: Canonical Document System

### Requirement Lock

Problem:

- The product still behaves like it has separate accounting docs, load docs, and party docs.
- Different endpoints and mental models overlap.

End state:

- one canonical document domain
- filtered views for accounting, loads, and onboarding
- consistent upload, query, and download contract
- the product may expose multiple filtered views, but users are not dealing with separate vault systems

### Owned Files

- [server/routes/documents.ts](/F:/Trucking/DisbatchMe/server/routes/documents.ts)
- document portions of [server/routes/accounting.ts](/F:/Trucking/DisbatchMe/server/routes/accounting.ts)
- document portions of [server/routes/clients.ts](/F:/Trucking/DisbatchMe/server/routes/clients.ts)
- [components/FileVault.tsx](/F:/Trucking/DisbatchMe/components/FileVault.tsx)

### Design Lock

- define canonical document metadata model
- define attachment keys for load, party, driver, finance, and settlement contexts
- define filtered-view strategy for domain consumers
- define routing rules so uploaded documents are classified to the right business context without duplicating storage models

### Implementation Requirements

- remove duplicate document-domain mental models in UI copy and routing
- standardize upload/download/list semantics
- ensure downstream consumers use the shared model

### Verification Gates

- route tests for canonical document CRUD/query
- component tests for filtered views
- integration proof: document uploaded in one context is visible in the correct filtered views

### Completion Criteria

- no parallel document system remains in the product model

## Agent 10: Shell, Navigation, Integration, and Release

### Requirement Lock

Problem:

- The final product shape can easily regress if every domain lane edits shell navigation independently.

End state:

- one coherent top-level IA
- only intentional destinations remain
- all merged lanes land without reintroducing removed surfaces
- the full trucking workflow is verified across lane boundaries, not only the shell wiring

### Owned Files

- [App.tsx](/F:/Trucking/DisbatchMe/App.tsx)
- navigation tests
- integration and release docs required to document final shell, workflow signoff, and any binary feature removal/retention decisions

### Design Lock

- top-level destinations remain:
  - Operations Center
  - Load Board
  - Schedule
  - Onboarding
  - Telematics
  - Financials
  - Issues & Alerts
  - Company Settings
- all removed/legacy surfaces remain aliases or are retired deliberately, not accidentally reintroduced
- maintain a workflow map that shows the authoritative record and handoff at each major step

### Implementation Requirements

- integrate all lane outcomes into the final shell
- maintain route alias safety during transition
- remove stale shell paths when lanes are complete
- validate that adjacent workflow steps still hand off canonically after each integration

### Verification Gates

- navigation tests
- end-to-end smoke across all critical workflows
- release checklist proving no dead primary surfaces remain
- workflow integrity verification pack from the canonical workflow document passes

### Completion Criteria

- shell reflects final product shape only
- no reintroduced duplicate destinations
- workflow signoff is published with no broken canonical handoff remaining

## Parallel Execution Rules

The following lanes can work fully in parallel once shared contract locks are published:

- Agent 2
- Agent 3
- Agent 5
- Agent 6
- Agent 7
- Agent 8
- Agent 9

The following lanes may begin immediately but must not finalize until dependencies are confirmed:

- Agent 1 depends on Agent 10 for shell placement and on Agent 9 for document access semantics
- Agent 4 depends on Agent 1 for settlement separation and Agent 9 for document contract
- Agent 10 depends on all lanes for final shell integration

## Workflow Integrity Rule

Every agent must prove not only that its own area works, but that the workflow handoff into and out of its area is still correct. A lane is not complete if:

- it receives non-canonical input and silently tolerates it
- it produces output another lane must manually reconstruct
- it forces users to re-enter authoritative data already collected upstream
- it changes a handoff contract without downstream revalidation

## Mandatory Verification Pack Per Agent

Each agent must provide the following before closeout:

1. Requirement summary
2. Conversation issue(s) closed from the issue registry
3. Original failure reproduction steps
4. Files changed
5. Contract changes
6. Tests added or updated
7. Verification evidence:
   - exact automated test command(s)
   - exact manual verification step(s)
   - before/after result summary
8. Authoritative record statement:
   - authoritative record(s)
   - derived record(s)
   - rendered views not owned by the lane
   - records or fields that must never be edited directly in the lane
9. Explicit statement that no known work remains inside the assigned scope

## Final Same-Day Closeout Gate

The whole remediation push closes only when:

- all 10 agents report scope complete
- all mandatory verification packs are present
- all automated tests for touched areas pass
- the integrated shell passes critical workflow smoke tests
- there is no documented leftover work deferred to a later sprint

If any assigned flow still requires later cleanup, the lane is not complete and the program is not closed.
