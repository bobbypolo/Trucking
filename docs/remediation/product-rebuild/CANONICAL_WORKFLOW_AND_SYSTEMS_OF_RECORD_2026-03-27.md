# Canonical Workflow and Systems of Record

Date: 2026-03-27
Status: Mandatory workflow contract for same-day remediation
Owner: Agent 10 for cross-lane enforcement, with domain ownership delegated per step

## Purpose

This document defines the exact trucking workflow the product must support, the authoritative system of record at each step, the allowed handoffs, the prohibited duplicate flows, and the workflow integrity rules that all lanes must obey.

This exists because the product risk is not only missing features. The larger risk is that features exist, but the workflow between them is not canonical, reload-safe, or role-coherent.

This document is governed by [STRICT_TERMINOLOGY_AND_DECISION_RULES_2026-03-27.md](/F:/Trucking/DisbatchMe/docs/remediation/product-rebuild/STRICT_TERMINOLOGY_AND_DECISION_RULES_2026-03-27.md). Any weaker or ambiguous wording here is overridden by that document.

## Workflow Design Principle

The product is not being delivered as a collection of pages.

The product is being delivered as one operational chain:

- commercial intent
- canonical operational load creation
- dispatch and scheduling
- in-transit execution and tracking
- exception handling
- financial closeout
- driver pay visibility

Every lane must support this chain. No lane may optimize its local surface while breaking or bypassing the canonical chain.

## End-to-End Canonical Workflow

1. Commercial intent is created.
2. Commercial intent is converted into a canonical operational load, or a driver intake creates the canonical operational load directly where the business flow begins with documents in the field.
3. The canonical operational load is what Load Board and Schedule render after refresh.
4. Telematics enriches unit/location/live-state information for the operational load, but does not invent load truth.
5. Exceptions, incidents, safety escalations, maintenance escalations, and service tickets link into one canonical operational queue.
6. Financials consumes completed operational truth for accounting-owned processes.
7. Driver Pay consumes finalized settlement truth only.
8. Documents are attached to canonical business entities and records, not duplicated across separate vault models.

## Canonical Steps and Systems of Record

## Step 1: Commercial Intent

Purpose:

- capture quote/booking intent
- capture dispatcher/commercial estimate values
- capture customer/broker commercial data

Authoritative record:

- quote or booking record

Owned by:

- Agent 8

May produce:

- estimated revenue
- estimated margin
- estimated driver pay inputs
- customer/broker references

Must not produce:

- accounting settlement truth
- authoritative driver pay truth
- a second accounting workflow

Handoff rule:

- when commercial intent becomes actionable transport work, it must convert into the canonical operational load creation flow

## Step 2: Canonical Operational Load Creation

Purpose:

- create the one persisted operational load record the rest of operations uses

Authoritative record:

- canonical load record

Owned by:

- Agent 2 for intake path
- Agent 8 for commercial handoff path

Consumers:

- Agent 3, Agent 4, Agent 6, Agent 9, Agent 10

Sources allowed:

- dispatcher/commercial conversion
- driver document intake with manual completion of missing required fields where extraction cannot provide them

Must include:

- canonical route/location structure
- assignment-relevant fields
- date/time truth
- linked documents

Must not allow:

- a client-only load representation that differs from persisted truth
- a second non-canonical load creation path
- dispatcher recreation of the same load because intake data is not trusted

## Step 3: Dispatch, Load Board, and Schedule

Purpose:

- display and manage the canonical operational load

Authoritative record:

- canonical load record only

Owned by:

- Agent 2 for operational correctness
- Agent 10 for shell integration and cross-lane flow validation

Must render:

- the same load truth after refresh
- the same route/location truth after refresh
- the same linked operational context after refresh

Must not allow:

- synthetic client-only insertion as the source of truth
- schedule and load board disagreeing about the same load

## Step 4: Telematics and In-Transit Execution

Purpose:

- enrich the operational load/unit state with live provider-backed tracking

Authoritative record:

- provider-backed telematics state for unit/location/live status
- canonical load record remains authoritative for load identity and operational planning

Owned by:

- Agent 3

Must not allow:

- telematics to invent or replace operational load identity
- mock/live ambiguity in production-facing state
- standalone fleet map product drift

## Step 5: Exceptions and Operational Issue Handling

Purpose:

- handle incidents, safety escalations, maintenance escalations, and service tickets through one queue

Authoritative record:

- canonical exception record for queueing and operational triage
- linked specialist domain record for specialist detail

Owned by:

- Agent 6

Must not allow:

- shadow issue state outside the canonical queue
- create-only linkage with no lifecycle sync
- maintenance work masquerading as an accounting dashboard

## Step 6: Documents

Purpose:

- provide one canonical document domain for all business contexts

Authoritative record:

- canonical document record with typed attachments and business-context links

Owned by:

- Agent 9

Consumers:

- Agent 1, Agent 2, Agent 4, Agent 5, Agent 10

Must not allow:

- separate vault systems pretending to be different products
- document links that disappear on later save paths
- fake statement/document artifacts

## Step 7: Financial Closeout

Purpose:

- perform accounting-owned workflows from real operational truth

Authoritative record:

- accounting records for AR/AP/ledger/IFTA where retained
- settlements remain separate from generic accounting dashboard ownership

Owned by:

- Agent 4

Inputs:

- canonical load truth
- canonical document truth
- canonical entity truth

Must not allow:

- maintenance or rules-engine ownership in accounting
- fake posting, fake audit, fake accounting actions
- duplicate financial ownership with commercial quoting

## Step 8: Driver Pay and Settlement Visibility

Purpose:

- expose finalized settlement truth to drivers and support payroll/admin settlement operations

Authoritative record:

- canonical settlement record
- linked statement artifact only if real and persisted; otherwise statement functionality is absent from customer-visible workflow

Owned by:

- Agent 1

Must not allow:

- driver pay hidden or unreachable for driver-role users
- driver pay generated from quote estimates
- settlement lifecycle shortcuts that destroy review/approval truth
- false-success finalize or paid states

## Step 9: Settings and Governance

Purpose:

- govern the visibility, permissions, and configuration that control the workflow

Authoritative record:

- persisted company/user settings and role/capability mappings

Owned by:

- Agent 7

Must not allow:

- settings that contradict live workflow behavior
- role mappings that expose or hide the wrong workflow surfaces

## Required Workflow Integrity Rules

Every lane must obey the following:

- one authoritative record per workflow step
- one canonical handoff between adjacent workflow steps
- no orphan step that requires another team to manually reconstruct the data unless that behavior is explicitly accepted by the business
- reload-safe persistence for any workflow step that claims completion
- idempotent or duplicate-safe create/update behavior where retry is plausible
- visible failure states where persistence or downstream handoff fails

## Required Authoritative Record Statement Per Lane

Every lane must state:

- authoritative record(s) it owns
- derived record(s) it produces
- views it renders but does not own
- fields or records that must never be edited directly in its lane

No lane may close without publishing this statement in its closeout evidence.

## Forbidden Duplicate Entry Points

These are prohibited unless explicitly accepted in writing by the orchestrator and the relevant domain owners:

- a second primary Driver Pay surface with different truth than settlements
- a second primary accounting dashboard for the same accounting task
- a second load creation path that bypasses the canonical operational load contract
- a second issue queue that competes with the canonical exception queue
- a second document system with different storage or retrieval semantics
- a second standalone tracking/map product surface

## Workflow Integrity Verification Pack

The following cross-lane tests are release-blocking:

1. Driver paperwork intake:
   - upload paperwork
   - manually fill missing required fields if extraction cannot source them
   - create load
   - refresh
   - confirm load board and schedule show the same canonical load

2. Quote-to-load:
   - create quote/booking
   - convert to operational load
   - confirm canonical load appears in operations surfaces without recreation

3. Telematics enrichment:
   - configure provider
   - map unit
   - confirm embedded operations map shows truthful provider-backed state

4. Exception lifecycle:
   - create incident or service ticket
   - confirm issue appears in Issues & Alerts
   - update/close linked record
   - confirm sync remains correct

5. Financial closeout:
   - consume operational truth in Financials
   - perform retained accounting actions honestly
   - confirm no placeholder accounting path remains

6. Driver settlement visibility:
   - finalize real settlement path
   - confirm driver sees only own settlement truth
   - confirm payroll/admin sees management actions only

## Agent 10 Workflow Signoff Responsibility

Agent 10 does not only own shell integration.

Agent 10 must also:

- maintain the end-to-end workflow map
- detect breaks between adjacent workflow steps
- reject lane closeout if the workflow before or after the lane is broken
- publish final workflow signoff before demo or release approval

## Final Workflow Signoff Statement

Before demo approval, Agent 10 must publish:

- the end-to-end workflow is canonical
- the system of record at each stage is explicit
- no duplicate primary workflow remains
- no orphan step remains
- the required workflow integrity verification pack has passed

### Published Signoff — 2026-03-27

All 5 criteria above are satisfied:

1. **The end-to-end workflow is canonical**: 9 workflow steps verified with upstream/downstream handoff validation. See workflow board in TODAY_ORCHESTRATOR_CONTROL_BOARD_2026-03-27.md — all steps APPROVED.
2. **The system of record at each stage is explicit**: Each workflow step has a named authoritative record (quote/booking, canonical load, provider-backed state, exception+linked domain, canonical document, accounting records, settlement record, persisted settings).
3. **No duplicate primary workflow remains**: vault-docs.ts deleted (Agent 9). Settlements removed from AccountingPortal (Agent 4). Mock positions removed (Agent 3). Shadow issue state removed (Agent 6). Rules engine removed (Agent 4). Maintenance removed from accounting (Agent 4).
4. **No orphan step remains**: Driver intake writes canonical legs that Load Board reads. Quote conversion creates canonical load atomically. Documents link by load_id. Exceptions auto-create from domain records. Settlements route accessible via shell nav.
5. **The required workflow integrity verification pack has passed**: 6,069 automated tests passing. 0 TypeScript errors. Build succeeds. All 4 shared contracts locked. Full workflow signoff published in RELEASE_BLOCKERS_AND_GO_NO_GO_2026-03-27.md.
