# Trucker App Feature Research

Date: 2026-04-08

## Goal

Define the trucker-specific product surface for a dedicated trucker app while keeping the main SaaS positioned as a trucking CRM/operations platform for full companies.

This memo combines:

- local product audit of the current `DisbatchMe` codebase
- current market review of driver-facing trucking apps
- current compliance/recordkeeping review for US owner-operators and drivers

## Executive Summary

The current product already contains a meaningful trucker-facing layer:

- driver mobile app shell
- document scanning and upload
- AI-assisted extraction
- driver intake workflow
- load updates and change requests
- driver settlements/pay view
- IFTA mileage, fuel, and evidence workflows
- compliance and maintenance hooks
- GPS, geofence, and BOL-scan event pipelines

The opportunity is not that no one in the market has document capture, compliance, IFTA, or mobile driver workflows. Those already exist in parts of the market. The real opportunity is tighter consolidation for owner-operators and drivers:

- one trip record
- one document packet
- one compliance timeline
- one financial trail
- one audit/export surface

That is a stronger and more defensible claim than saying the category does not exist.

## What Already Exists In This SaaS

### Driver mobile product surface

- Role-gated driver app shell routes `driver` users into `DriverMobileHome`.
- Driver mobile tabs already include `today`, `loads`, `documents`, `changes`, `map`, `pay`, and `profile`.
- The app already supports driver messaging entry points, status updates, change requests, and breakdown escalation.

### Document and OCR flow

- Driver-side scan/upload is wired to the canonical `/api/documents` domain.
- Scanner supports camera or file upload.
- AI extraction endpoints exist for load, broker, and equipment documents.
- Pickup/BOL scan results can patch load fields such as reference numbers, commodity, weight, and pickup data.

### Driver intake flow

- Driver-first intake exists as a multi-document scan and review flow.
- Intake can create a draft load and upload supporting documents tied to that load.
- This is close to the differentiated workflow you described, but it is not yet positioned as a complete owner-operator operating system.

### Financial and settlement surface

- Driver settlements are implemented and scoped to the authenticated driver.
- The product already includes accounting, fuel ledger, mileage, and IFTA posting flows.

### IFTA and trip evidence

- IFTA summary, mileage entry, evidence review, tax posting, and audit-lock flows are present.
- Supporting tables and routes exist for mileage jurisdiction, fuel ledger, `ifta_trip_evidence`, and `ifta_trips_audit`.

### Safety and compliance

- Compliance records are exposed with self-access for drivers and broader access for admin/dispatcher/safety users.
- Safety domain includes maintenance records, expiring certificate alerts, and FMCSA lookup support.

### GPS, geofence, and trip eventing

- GPS tracking routes exist.
- Geofence event recording exists.
- BOL scan can trigger detention and discrepancy logic.

## Current Gaps In The Existing Product

These are the largest gaps between the current product and a best-in-class trucker app.

### 1. Compliance is present, but not yet unified into a driver compliance OS

The repo has IFTA, maintenance, certificate warnings, and FMCSA hooks, but not a unified owner-operator compliance cockpit that combines:

- IFTA
- IRP
- UCR
- HVUT / Form 2290
- permit lifecycle
- Clearinghouse/C-TPA reminders
- document retention by record class
- annual inspection evidence

### 2. ELD/HOS/DVIR is not the center of the driver app

The current system has GPS and operational tracking hooks, but not a full driver-native HOS/ELD and DVIR operating layer. In market terms, this is table stakes for a serious driver app.

### 3. The product is strong on document intake but weaker on audit packaging

The product can collect documents, but the differentiator should be:

- auto-link every document to trip, vehicle, jurisdiction, quarter, and settlement
- retain by rule
- flag missing evidence before filing or settlement close
- export complete audit packets

### 4. Owner-operator administration is implied, but not fully consolidated

The codebase and PRD support owner-operators, but the app is not yet clearly structured around the independent operator's daily control center:

- load intake
- trip compliance
- expense capture
- settlement visibility
- deadlines
- truck health
- filing readiness

### 5. Market messaging currently overstates whitespace

The combination is differentiated, but the claim that it "does not exist in the world yet" is too broad. Competitors already cover major pieces:

- Motive: driver workflows, custom DVIR, docs, messaging, IFTA
- Samsara: maintenance, workflows, navigation, qualifications, compliance
- TruckLogics: owner-operator dispatch, expenses, IFTA, maintenance, docs
- Geotab/Verizon/Trimble: strong compliance, tracking, workflow, or route execution slices

## What The Trucker App Should Own

This is the recommended trucker-app boundary.

### A. Trip Workspace

This should be the primary home screen.

Core functions:

- today’s active trip
- stop sequence
- pickup/dropoff appointment windows
- navigation handoff
- scan BOL/POD/receipts
- report delay, issue, lumper, detention, or breakdown
- quick status updates
- load-required document checklist

### B. Smart Document Intake

This is the product’s strongest candidate differentiator.

Core functions:

- camera-first upload for BOL, POD, fuel, toll, scale, lumper, permit, repair docs
- OCR extraction
- document classification
- field auto-fill
- attach to load, truck, driver, trip, or compliance bucket
- missing-field review
- duplicate detection
- audit completeness warnings

### C. Driver Compliance Hub

This should be explicitly driver-facing, not just safety/backoffice-facing.

Core functions:

- IFTA quarter status
- missing fuel receipt warnings
- missing mileage/jurisdiction gaps
- IRP mileage record status
- annual inspection countdown
- expiring CDL/medical/permits/insurance reminders
- UCR status
- HVUT/Form 2290 status
- drug/alcohol consortium and Clearinghouse reminders
- retention and audit notices

### D. Expense and Cashflow Capture

This is essential for owner-operators.

Core functions:

- fuel receipt capture
- toll capture
- lumper capture
- scale tickets
- advances and reimbursements
- trip-level and truck-level expenses
- settlement-ready categorization

### E. Truck Health

Core functions:

- maintenance due reminders
- defects and repair notes
- annual inspection evidence
- service history
- out-of-service and return-to-service tracking

### F. Pay and Settlement View

Core functions:

- current settlement status
- expected pay
- deductions
- reimbursements
- accessorial visibility
- missing-document blockers before settlement finalization

## What Should Stay In The Company CRM

This is the recommended CRM/platform boundary.

### Sales and customer operations

- lead management
- customer CRM
- broker and shipper relationship management
- quote pipeline
- contract management
- customer communications
- invoicing and collections at company level

### Dispatch and control tower

- multi-driver dispatch board
- load planning across fleet
- repower management
- operations center
- company-wide exception management
- company-wide analytics
- fleet-wide telematics administration

### Back-office accounting

- full AR/AP/GL
- company ledger close
- company-level reconciliation
- payroll approval workflows
- QuickBooks integration
- multi-user permissions and approvals

### Admin and governance

- tenant setup
- roles and permissions
- tier management
- provider configuration
- entity master data
- company policy settings

## What You Are Missing

These are the main missing trucker-specific features if the goal is a serious dedicated trucker app.

### High priority missing items

- HOS/ELD integration or clear partner strategy
- DVIR workflows with photos, signoff, and repair certification
- IRP distance and apportioned-registration view
- permit manager with state trip/fuel permit support
- UCR annual tracker
- HVUT / Form 2290 tracker
- Clearinghouse / C-TPA reminder system for owner-operators
- lumper and toll-specific expense flows
- retention rules by document type
- audit packet export by quarter, trip, truck, and filing type

### Important workflow gaps

- commercial truck navigation integration
- offline-first driver document capture
- trip closeout checklist
- exemption handling for paper-log/ELD exception cases
- pre-settlement missing-proof alerts
- one-screen trip profitability for owner-operators

### Product clarity gaps

- explicit separation between driver app and company CRM
- clear owner-operator package narrative
- clear distinction between what is implemented versus planned

## Recommended Product Positioning

Use this positioning instead of a hard novelty claim:

> A trucker app that combines smart document intake, compliance tracking, IFTA evidence, trip expenses, maintenance reminders, and settlement readiness in one driver-first workflow.

Stronger version for owner-operators:

> One app for the trip, the paperwork, the compliance trail, and the money.

Avoid:

- "no one does this"
- "this does not exist anywhere"

Prefer:

- "most tools split freight, compliance, and back office into separate apps"
- "we unify driver paperwork, compliance evidence, and settlement readiness around the trip itself"

## Suggested Product Architecture

### Trucker app

Primary entities:

- trip
- load
- stop
- document
- expense
- compliance obligation
- filing period
- truck
- settlement

Primary principle:

- every scan and every mile should attach to a trip context and then feed multiple downstream uses

Derived outputs:

- IFTA
- IRP mileage
- settlement backup
- audit exports
- maintenance context
- company visibility

### Company CRM

Primary role:

- supervision, planning, sales, accounting, and exception control across many drivers and trucks

## Suggested Roadmap

### Phase 1: Package What Already Exists

- formalize dedicated trucker app scope
- tighten owner-operator onboarding
- unify driver mobile UI around trip workspace
- harden document-to-load and document-to-settlement linking
- expose compliance hub from existing data

### Phase 2: Fill Critical Compliance Gaps

- IRP
- UCR
- HVUT/Form 2290
- permit manager
- document retention engine
- audit packet export

### Phase 3: Operational Depth

- HOS/ELD integration
- DVIR
- navigation
- deeper maintenance
- bank/card reconciliation
- higher-confidence OCR classification and auto-posting

## Competitive Read

### What the market already has

- document upload/scanning
- compliance workflows
- driver messaging
- dispatch tasks
- IFTA in some products
- maintenance in some products

### What is still weak in the market

- one app covering dispatch paperwork, compliance evidence, expenses, maintenance, and settlement readiness together
- owner-operator-first compliance and business administration in one mobile flow
- high-quality audit packaging tied to the actual trip record

## Source Set

### Local product evidence

- `components/DriverMobileHome.tsx`
- `components/Scanner.tsx`
- `components/IFTAManager.tsx`
- `components/SafetyView.tsx`
- `server/routes/documents.ts`
- `server/routes/compliance.ts`
- `server/routes/loads.ts`
- `server/routes/accounting.ts`
- `server/routes/tracking.ts`
- `server/routes/safety.ts`
- `docs/PRD_Independent_Owner_Operator.md`
- `docs/Fleet_Driver_Field_Visibility_Checklist.md`

### Market sources

- Motive driver experience: https://gomotive.com/products/driver-experience/
- Samsara fleet application suite: https://www.samsara.com/pages/fleet-application-suite
- TruckLogics driver mobility: https://www.trucklogics.com/solutions/driver-mobility-solutions
- Geotab Drive: https://marketplace.geotab.com/solutions/geotab-drive/
- Verizon Connect ELD: https://www.verizonconnect.com/solutions/eld-compliance-management-software/
- Truckstop mobile: https://truckstop.com/mobile/
- Trimble workflow/navigation surfaces: https://transportation.trimble.com/en/solutions/mapping-and-routing/trimble-smartworkflow

### Compliance and regulatory sources

- FMCSA owner-operator Clearinghouse guidance: https://www.fmcsa.dot.gov/regulations/drug-alcohol-testing/how-do-owner-operators-meet-their-clearinghouse-obligations
- IRS trucking tax center: https://www.irs.gov/businesses/small-businesses-self-employed/trucking-tax-center
- UCR plan: https://plan.ucr.gov/
- Arizona IFTA recordkeeping guidance: https://azdot.gov/mvd/services/motor-carrier-services/ifta-record-keeping-requirements
- North Dakota IRP/IFTA/UCR page: https://www.dot.nd.gov/motor-vehicle/international-registration-plans-ifta-irp-and-ucr
- Washington IRP recordkeeping guidance: https://dol.wa.gov/vehicles-and-boats/prorate-and-fuel-tax/international-registration-plan-prorate/recordkeeping-requirements-irp-prorate

## Bottom Line

You are not missing a trucker product concept. You are missing a tighter boundary and a stronger trucker-specific operating model.

The trucker app should be:

- trip-first
- camera-first
- compliance-aware
- expense-aware
- settlement-aware
- audit-ready

The company SaaS should remain:

- CRM
- dispatch command center
- accounting and admin back office
- company-wide control tower
