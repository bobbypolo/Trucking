# LoadPilot Trucker App Master Program Plan

This document is the master program plan for the LoadPilot trucker app buildout. It tracks all sprints from the shipped SaaS baseline through general availability of the mobile-first owner-operator product.

---

## Shipped Baseline (Sprint A)

Commit: `dd8a8f4`

Sprint A delivered the bulletproof sales-demo SaaS platform. All 10 stories passed V-Model verification. The following capabilities shipped:

- Authentication and multi-tenant onboarding
- Load management with 8-state lifecycle
- Accounting portal with GL double-entry and 22 endpoints
- Safety and compliance (6 tabs, quiz-results API)
- Operations center (command center, triage)
- Broker network management
- Driver pay and settlements
- Quotes and booking with hybrid load workflow
- BOL generator
- IFTA manager
- Exception management
- Messaging system
- Data import/export
- File upload (Multer + documents route)
- Fleet map with Google Maps integration
- Intelligence hub

The SaaS baseline is the foundation upon which all trucker-app sprints build.

---

## Sprint B1

**Theme**: Infrastructure hardening and first trucker-app feature

**Goal**: Ship the IFTA audit packet export MVP, stand up Sentry error tracking, create program documentation, establish the feature-flag framework, and capture the baseline debt register.

Key deliverables:
- IFTA audit packet generate/list/verify/download flow
- Invoice aging bucket migration and nightly job
- Sentry server-side integration (gated on SENTRY_DSN)
- External scheduler wrapper (Windows-safe .cjs)
- Master program documentation (this file), release checklist, sprint history
- Environment matrix, feature flags doc, migration numbering rules
- Baseline debt register with real entries
- Feature flags DB table and read/write endpoint
- SaaS non-regression verification

---

## Sprint B2

**Theme**: Mobile app bootstrap and monorepo migration

**Goal**: Establish the Expo + React Native project structure within a Turborepo monorepo layout. Move shared types and utilities into `packages/shared/`. Stand up the mobile navigation shell and authentication flow.

Key deliverables:
- Turborepo monorepo restructure (apps/web, apps/trucker, packages/shared)
- Expo SDK initialization with EAS Build configuration
- Mobile authentication screens (login, signup)
- Shared type extraction from existing SaaS code
- CI pipeline update for monorepo

---

## Sprint C

**Theme**: Mobile document intake and camera integration

**Goal**: Build the mobile document capture pipeline. Drivers can photograph BOLs, rate confirmations, and fuel receipts using the device camera, with on-device image processing and server-side AI parsing.

Key deliverables:
- Camera capture component with image quality validation
- On-device image preprocessing (crop, rotate, enhance)
- Server-side Gemini AI document parsing integration
- Document upload queue with offline support
- Parsed document review and correction UI

---

## Sprint D

**Theme**: ELD/telematics integration

**Goal**: Integrate Motive ELD data for automatic mileage tracking and HOS compliance. Enable real-time vehicle location and driver status.

Key deliverables:
- Motive API integration service
- Automatic mileage jurisdiction tracking from ELD data
- HOS status display on mobile
- Real-time vehicle location polling
- ELD data sync and conflict resolution

---

## Sprint E

**Theme**: IFTA automation and fuel management

**Goal**: Complete the IFTA workflow from manual audit packets to fully automated quarterly filing preparation using ELD mileage data and fuel card integration.

Key deliverables:
- Fuel card API integration (Comdata, EFS, WEX)
- Automated jurisdiction mileage from ELD data
- IFTA quarterly calculation engine
- Filing preparation export (PDF + CSV)
- Fuel purchase receipt matching

---

## Sprint F

**Theme**: Broker credit scoring and receivables

**Goal**: Build the broker credit intelligence module. Score brokers on payment history, detect slow-pay patterns, and provide actionable credit recommendations.

Key deliverables:
- Broker payment history aggregation
- Credit score calculation engine
- Slow-pay detection and alerts
- Broker credit dashboard
- Invoice aging analytics (using B1 aging data)

---

## Sprint G

**Theme**: Settlement automation

**Goal**: Automate driver settlement calculations, including per-mile pay, accessorial charges, deductions, and direct deposit integration.

Key deliverables:
- Settlement calculation engine (per-mile, percentage, flat)
- Accessorial charge configuration
- Deduction management (advances, fuel, insurance)
- Settlement statement generation (PDF)
- Payment processing integration prep

---

## Sprint H

**Theme**: Facility dwell time and detention billing

**Goal**: Track facility dwell time using geofencing and ELD data. Automatically generate detention invoices when dwell exceeds contracted free time.

Key deliverables:
- Geofence-based facility arrival/departure detection
- Dwell time calculation engine
- Detention billing rule configuration
- Automated detention invoice generation
- Facility performance scorecards

---

## Sprint I

**Theme**: Maintenance and compliance management

**Goal**: Build preventive maintenance scheduling, DVIR integration, and compliance calendar for driver qualifications and equipment certifications.

Key deliverables:
- Preventive maintenance schedule engine
- DVIR submission and tracking (mobile)
- Compliance calendar with expiration alerts
- Equipment certification tracking
- Maintenance cost tracking and reporting

---

## Sprint J

**Theme**: Route optimization and trip planning

**Goal**: Intelligent trip planning that considers fuel costs, HOS constraints, facility dwell history, and weather conditions.

Key deliverables:
- Multi-stop route optimization
- HOS-aware trip planning
- Fuel cost optimization (cheapest fuel stops)
- Weather-informed routing
- Trip profitability estimation

---

## Sprint K

**Theme**: Freemium tier and self-service onboarding

**Goal**: Implement the freemium business model. Allow owner-operators to self-register, use limited features free, and upgrade to paid tiers.

Key deliverables:
- Self-service registration flow
- Freemium feature gating
- Subscription management (Stripe integration)
- Usage quotas and metering
- Upgrade prompt UX

---

## Sprint L

**Theme**: Analytics dashboard and business intelligence

**Goal**: Comprehensive analytics for owner-operators covering revenue per mile, cost per mile, deadhead percentage, and fleet utilization.

Key deliverables:
- Revenue analytics (per mile, per load, per lane)
- Cost analytics (fuel, maintenance, insurance, tolls)
- Utilization metrics (loaded vs empty miles)
- Trend visualization and period comparison
- Exportable reports (PDF, CSV)

---

## Sprint M

**Theme**: General availability preparation and hardening

**Goal**: Final hardening sprint before public launch. Performance optimization, security audit, accessibility compliance, and production monitoring.

Key deliverables:
- Performance audit and optimization (bundle size, API latency)
- Security penetration testing and remediation
- WCAG 2.1 AA accessibility compliance
- Production monitoring and alerting setup
- App store submission preparation (iOS, Android)
- Launch checklist completion
