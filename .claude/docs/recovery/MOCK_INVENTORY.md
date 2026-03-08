# Mock Inventory

> Generated: 2026-03-07 | Story: R-P0-01
> Source: Static analysis of DisbatchMe codebase at commit a159505

This document maps every localStorage key, every mockDataService function, and every hardcoded
data array to the component/service that consumes it, with exact file paths and line numbers.

---

## 1. localStorage Keys

### 1.1 storageService.ts Keys

All defined in `services/storageService.ts` lines 21-36:

| Key | Constant | Line | Data Type | Consumers |
|-----|----------|------|-----------|-----------|
| `loadpilot_loads_v1` | STORAGE_KEY | 21 | LoadData[] | storageService (lines 41,56,162,167,185,295,422,785,837,1637,1669), App.tsx (via getLoads/saveLoad) |
| `loadpilot_incidents_v1` | STORAGE_KEY_INCIDENTS | 22 | Incident[] | storageService (lines 80,594,673,708,717,752) |
| `loadpilot_messages_v1` | STORAGE_KEY_MESSAGES | 23 | Message[] | storageService (lines 854,863,879), OperationalMessaging.tsx |
| `loadpilot_requests_v1` | STORAGE_KEY_REQUESTS | 24 | KCIRequest[] | storageService (lines 1090,1112,1141), IntelligenceHub.tsx |
| `loadpilot_calls_v1` | STORAGE_KEY_CALLS | 25 | CallSession[] | storageService (lines 190,204,1053,1065,1082,1430), IntelligenceHub.tsx |
| `loadpilot_providers_v1` | STORAGE_KEY_PROVIDERS | 26 | Provider[] | storageService (lines 1483,1493,1544), IntelligenceHub.tsx |
| `loadpilot_contacts_v1` | STORAGE_KEY_CONTACTS | 27 | Contact[] | storageService (lines 1499,1506,1559), IntelligenceHub.tsx |
| `loadpilot_tasks_v1` | STORAGE_KEY_TASKS | 28 | OperationalTask[] | storageService (lines 1565,1575), IntelligenceHub.tsx |
| `loadpilot_crisis_v1` | STORAGE_KEY_CRISIS | 29 | CrisisAction[] | storageService (lines 1581,1591), IntelligenceHub.tsx (line 1970) |
| `loadpilot_service_tickets_v1` | STORAGE_KEY_SERVICE_TICKETS | 30 | ServiceTicket[] | storageService (lines 1704,1714), CommandCenterView.tsx |
| `loadpilot_notification_jobs_v1` | STORAGE_KEY_NOTIFICATION_JOBS | 31 | NotificationJob[] | storageService (lines 1730,1740) |
| `loadpilot_quotes_v1` | STORAGE_KEY_QUOTES | 32 | Quote[] | storageService (lines 316,322,327), QuoteManager.tsx |
| `loadpilot_bookings_v1` | STORAGE_KEY_BOOKINGS | 33 | Booking[] | storageService (lines 331,337,342), QuoteManager.tsx, BookingPortal.tsx |
| `loadpilot_leads_v1` | STORAGE_KEY_LEADS | 34 | Lead[] | storageService (lines 302,312), QuoteManager.tsx, BookingPortal.tsx |
| `loadpilot_work_items_v1` | STORAGE_KEY_WORK_ITEMS | 35 | WorkItem[] | storageService (lines 1461,1682,1698), mockDataService.ts (line 161), IntelligenceHub.tsx (lines 1973,1979) |
| `loadpilot_vault_docs_v1` | STORAGE_KEY_VAULT_DOCS | 36 | VaultDoc[] | storageService (lines 1758,1768) |
| `trucklogix_threads_v1` | STORAGE_KEY_THREADS | 893 | OperationalThread[] | storageService (lines 897,912), OperationalMessaging.tsx |

### 1.2 authService.ts Keys

Defined in `services/authService.ts` lines 14-16:

| Key | Constant | Line | Data Type | Consumers |
|-----|----------|------|-----------|-----------|
| `loadpilot_users_v1` | USERS_KEY | 14 | User[] | authService (lines 201,209,258), App.tsx (via getCompanyUsers) |
| `loadpilot_companies_v1` | COMPANIES_KEY | 15 | Company[] | authService (lines 201,210,235,238) |
| `loadpilot_session_v1` | SESSION_KEY | 16 | User (single) | authService (lines 58,64,262,284,290,299,309), CompanyProfile.tsx, LoadList.tsx, LoadDetailView.tsx |

### 1.3 brokerService.ts Keys

Defined in `services/brokerService.ts` line 4:

| Key | Constant | Line | Data Type | Consumers |
|-----|----------|------|-----------|-----------|
| `loadpilot_brokers_v1` | BROKERS_KEY | 4 | Broker[] | brokerService (lines 10,21,75), BrokerManager.tsx, BookingPortal.tsx, EditLoadForm.tsx, LoadSetupModal.tsx |

### 1.4 safetyService.ts Keys

Defined in `services/safetyService.ts` lines 7-12:

| Key | Constant | Line | Data Type | Consumers |
|-----|----------|------|-----------|-----------|
| `trucklogix_quizzes_v1` | QUIZZES_KEY | 7 | SafetyQuiz[] | safetyService (lines 16,24,89,225,289), SafetyView.tsx |
| `trucklogix_quiz_results_v1` | QUIZ_RESULTS_KEY | 8 | QuizResult[] | safetyService (lines 16,25,97,100,295), SafetyView.tsx |
| `trucklogix_maintenance_v2` | MAINTENANCE_KEY | 9 | MaintenanceRecord[] | safetyService (lines 16,27,55,58), SafetyView.tsx |
| `trucklogix_service_tickets_v1` | TICKETS_KEY | 10 | ServiceTicket[] | safetyService (lines 16,28,61,66,325), SafetyView.tsx, CommandCenterView.tsx |
| `trucklogix_vendors_v1` | VENDORS_KEY | 11 | Provider[] | safetyService (lines 16,29,69,74,261), SafetyView.tsx, IntelligenceHub.tsx |
| `trucklogix_safety_activity_v1` | SAFETY_ACTIVITY_KEY | 12 | ActivityLogEntry[] | safetyService (lines 16,26,77,86), SafetyView.tsx |

### 1.5 Direct localStorage Access in Components

| Key | File | Line | Usage |
|-----|------|------|-------|
| `token` | services/safetyService.ts | 34,46 | Auth token in header (`Bearer ${localStorage.getItem('token')}`) |
| `token` | components/IntelligenceHub.tsx | 428 | Auth token in header |
| `loadpilot_crisis_v1` | components/IntelligenceHub.tsx | 1970 | Direct write of crisis incident array |
| `loadpilot_work_items_v1` | components/IntelligenceHub.tsx | 1973,1979 | Direct read/write of work items |

**Total unique localStorage keys: 24** (17 in storageService, 3 in authService, 1 in brokerService, 6 in safetyService, minus 3 overlapping via direct access)

---

## 2. mockDataService Functions

File: `services/mockDataService.ts` (179 lines)

| Function | Line | Description | Consumers |
|----------|------|-------------|-----------|
| `seedMockData(user: User)` | 13 | Master seed function. Creates providers, contacts, drivers, equipment, loads, incidents, requests, service tickets, tasks, work items, and call sessions. Writes directly to localStorage and calls storageService save functions. | IntelligenceHub.tsx (line 14 import, line 798 call) |

### Data Created by seedMockData

| Variable | Line | Type | Count | Description |
|----------|------|------|-------|-------------|
| mockProviders | 18 | Provider[] | 3 | Titan Logistics, Swift-Link, Rapid Rescue |
| mockContacts | 24 | Contact[] | 1 | Sarah Miller (broker contact) |
| mockDrivers | 33 | User[] | 2 | Tom Thompson (DRV-7001), Elena Petrova (DRV-7003) |
| mockEquipment | 40 | FleetEquipment[] | 3 | TRK-501, TRL-401, TRL-405 |
| mockLoads | 47 | LoadData[] | 1 | LD-8801 (In-Transit, Chicago to Denver) |
| mockIncidentState | 74 | Incident | 1 | INC-7701 (Breakdown on I-80) |
| mockRequests | 92 | KCIRequest[] | 1 | REQ-5501 (Tow request, $1,450) |
| mockTicket | 114 | ServiceTicket | 1 | TKT-9901 (Brake drum replacement) |
| mockTasks | 129 | OperationalTask[] | 1 | TSK-2201 (Verify HOS compliance) |
| mockWorkItems | 147 | WorkItem[] | 1 | WI-7001 (Detention review) |
| mockSessions | 164 | CallSession[] | 1 | CS-4401 (Active call with Tom Thompson) |

---

## 3. Seed Functions (Other Files)

### 3.1 authService.seedDatabase()

File: `services/authService.ts`, line 537

| Variable | Line | Type | Count | Description |
|----------|------|------|-------|-------------|
| (admin user) | 542 | User | 1 | admin@loadpilot.com, calls registerCompany then seedDemoLoads |
| (hardcoded users) | 555-574 | User | 10 | dispatch@, opsmanager@, ar@, ap@, payroll@, safety@, maint@, smallbiz@, fused_ops@, fused_finance@ |
| (fleet owner + ops) | 568-574 | User | 3 | fleetowner@kci.com, operator1@gmail.com, operator2@gmail.com |
| mockDrivers | 577 | { email, name, state, password }[] | 5 | Marcus Rodriguez, Sarah Chen, David Thompson, Elena Garcia, James Wilson |

**Consumers**: App.tsx (line 80: `await seedDatabase()`)

### 3.2 storageService.seedDemoLoads(user)

File: `services/storageService.ts`, line 381

| Variable | Line | Type | Count | Description |
|----------|------|------|-------|-------------|
| demoLoads | 385 | LoadData[] | 2 | LD-1001 (Chicago to Detroit, Delivered), LD-1002 (Indianapolis to Columbus, Settled) |

**Consumers**: authService.ts (line 543, called from seedDatabase)

### 3.3 storageService.seedIncidents(loads)

File: `services/storageService.ts`, line 603

| Variable | Line | Type | Count | Description |
|----------|------|------|-------|-------------|
| incidents | 608 | Incident[] | 2 | inc-desc-001 (Motor Breakdown, Critical), inc-desc-002 (HOS Risk, High) |

**Consumers**: App.tsx (line 90), SafetyView.tsx (line 70)

### 3.4 safetyService.seedSafetyData(force)

File: `services/safetyService.ts`, line 224

| Variable | Line | Type | Count | Description |
|----------|------|------|-------|-------------|
| initialVendors | 228 | Provider[] | 3 | Elite Truck Repair (v-101), Roadside Recovery Pros (v-102), Salina Heavy Towing (v-103) |
| initialQuizzes | 264 | SafetyQuiz[] | 2 | Winter Operations 2025 (quiz-winter-2025), HOS Compliance Refresher (quiz-hos-refresher) |
| initialResults | 292 | QuizResult[] | 1 | Quiz result for drv-001 on quiz-winter-2025 |
| initialTickets | 298 | ServiceTicket[] | 2 | Engine derate (TR-101), Flat tire (Trailer 5001) |

**Consumers**: App.tsx (line 81: `seedSafetyData(true)`)

### 3.5 storageService.getTriageQueues() - Inline Seeds

File: `services/storageService.ts`, line 1412

| Variable | Line | Type | Count | Description |
|----------|------|------|-------|-------------|
| seedCalls | 1420 | CallSession[] | 1 | CALL-INT-101 (Robert Miller, WAITING) |
| seedWorkItems | 1435 | WorkItem[] | 2 | WI-5001 (Detention review), WI-5002 (Missing BOL) |

**Consumers**: IntelligenceHub.tsx (via getTriageQueues), CommandCenterView.tsx

### 3.6 storageService.getRawContacts() - Inline Seed

File: `services/storageService.ts`, line 1497

| Variable | Line | Type | Count | Description |
|----------|------|------|-------|-------------|
| seed (contacts) | 1502 | Contact[] | 2 | John Dispatcher (c1), Sarah Broker (c2) |

**Consumers**: IntelligenceHub.tsx (via getContacts)

### 3.7 storageService.getProviders() - Inline Seed

File: `services/storageService.ts`, line 1513

| Variable | Line | Type | Count | Description |
|----------|------|------|-------|-------------|
| seed (providers) | 1516 | Provider[] | 2 | Titan Recovery Specialists (p1), Rapid Tire & Service (p2) |

**Consumers**: IntelligenceHub.tsx (via getProviders)

---

## 4. Hardcoded Data Arrays in Components

### 4.1 IntelligenceHub.tsx - mockCallers

File: `components/IntelligenceHub.tsx`, line 1231

| Variable | Line | Type | Count | Description |
|----------|------|------|-------|-------------|
| mockCallers | 1231 | { id, name, role, team }[] | 3 | Mike Thompson (D-5501, DRIVER), Choptank Logistics (B-2209, BROKER), Blue Star Towing (P-9901, PROVIDER) |

**Usage**: Random caller selection for simulated inbound calls (line 1236)

---

## 5. Hardcoded Mock Returns in Services

### 5.1 ocrService.ts - Mock OCR Extraction

File: `services/ocrService.ts`, line 22

| Variable | Line | Type | Description |
|----------|------|------|-------------|
| mockLoad | 22 | Partial<LoadData> | Hardcoded load data returned instead of real OCR: load number LD-XXXX, rate $1850, container SZLU 928374, APM Terminals LA to KCI Riverside CA |

**Consumers**: Scanner.tsx (via extractLoadFromDocument)

### 5.2 fuelService.ts - Mock Automation Rule

File: `services/fuelService.ts`, line 37

| Variable | Line | Type | Description |
|----------|------|------|-------------|
| mockRule | 37 | AutomationRule | Hardcoded fuel matching rule: auto-fuel-match, 2% tolerance, 3-day lookback |

**Consumers**: fuelService internal (line 46, executeFuelMatchingRule)

---

## 6. Seed Call Chain (App Startup)

When a user logs in, `App.tsx` triggers the following seed chain:

```
App.tsx line 80: await seedDatabase()
  -> authService.seedDatabase() line 537
    -> registerCompany() -> creates admin user
    -> seedDemoLoads(user) line 543
      -> storageService.seedDemoLoads() line 381
        -> writes 2 demo loads to localStorage
    -> creates 18 hardcoded users (lines 555-596)

App.tsx line 81: seedSafetyData(true)
  -> safetyService.seedSafetyData() line 224
    -> writes 3 vendors to localStorage
    -> writes 2 quizzes to localStorage
    -> writes 1 quiz result to localStorage
    -> writes 2 service tickets to localStorage

App.tsx line 90: seedIncidents(loads)
  -> storageService.seedIncidents() line 603
    -> POSTs 2 incidents to server API
    -> Falls back to localStorage on failure
```

Additionally, IntelligenceHub triggers:
```
IntelligenceHub.tsx line 798: await seedMockData(user)
  -> mockDataService.seedMockData() line 13
    -> writes 3 providers, 1 contact, 1 load, 1 incident,
       1 request, 1 service ticket, 1 task, 1 work item,
       1 call session to localStorage/storageService
```

---

## 7. Summary Statistics

| Category | Count |
|----------|-------|
| Unique localStorage keys | 24 |
| Seed functions | 7 (seedDatabase, seedDemoLoads, seedIncidents, seedSafetyData, seedMockData, getTriageQueues inline, getRawContacts/getProviders inline) |
| Hardcoded data arrays | 22 (across all seed functions + component mocks) |
| Total mock entities seeded | ~50+ (18 users, 2 loads, 2 incidents, 3+2 providers, 2+1 contacts, 2 quizzes, 1 quiz result, 2+1 service tickets, 3 vendors, 1 request, 1 task, 1+2 work items, 1+1 call sessions, 1 mock load from OCR) |
| Files containing localStorage.setItem | 4 (storageService.ts, authService.ts, safetyService.ts, IntelligenceHub.tsx) + mockDataService.ts |
| Files containing localStorage.getItem | 4 (storageService.ts, authService.ts, safetyService.ts, IntelligenceHub.tsx) + brokerService.ts |
| Components directly accessing localStorage | 1 (IntelligenceHub.tsx lines 428, 1970, 1973, 1979) |
