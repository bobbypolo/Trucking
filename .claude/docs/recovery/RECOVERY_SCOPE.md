# Recovery Scope - Release 1

> Generated: 2026-03-07 | Story: R-P0-01
> Source: Static analysis of DisbatchMe codebase at commit a159505

## Classification Legend

| Tag | Meaning |
|-----|---------|
| **IN** | In-scope for Release 1 - must work end-to-end with server-backed data |
| **OUT** | Out-of-scope - will not ship in Release 1 |
| **DEFERRED** | Acknowledged need, deferred to Release 2+ |

---

## 1. Frontend Components (components/)

| Component | File | Classification | Notes |
|-----------|------|----------------|-------|
| Auth | Auth.tsx | **IN** | Login/register flow. Currently uses localStorage session + partial Firebase Auth. Must be server-auth only. |
| Dashboard | Dashboard.tsx | **IN** | Primary dispatcher landing page. Needs server-backed data feeds. |
| LoadList | LoadList.tsx | **IN** | Core load table. Reads from storageService (localStorage). Must read from API. |
| LoadDetailView | LoadDetailView.tsx | **IN** | Single-load detail panel. |
| EditLoadForm | EditLoadForm.tsx | **IN** | Load create/edit form. |
| LoadSetupModal | LoadSetupModal.tsx | **IN** | Quick-create load modal. |
| LoadBoardEnhanced | LoadBoardEnhanced.tsx | **IN** | Kanban-style load board. |
| CalendarView | CalendarView.tsx | **IN** | Calendar-based load scheduling. |
| BrokerManager | BrokerManager.tsx | **IN** | Broker/customer CRUD. localStorage-backed, needs server migration. |
| BookingPortal | BookingPortal.tsx | **IN** | Quote-to-booking pipeline. |
| QuoteManager | QuoteManager.tsx | **IN** | Quote lifecycle management. |
| Settlements | Settlements.tsx | **IN** | Driver pay settlements. |
| CompanyProfile | CompanyProfile.tsx | **IN** | Company settings and user management. |
| SafetyView | SafetyView.tsx | **IN** | Safety compliance dashboard. Heavy localStorage dependency. |
| ExceptionConsole | ExceptionConsole.tsx | **IN** | Exception/dispute workflow. Server-backed (MySQL). |
| AccountingPortal | AccountingPortal.tsx | **IN** | Full accounting module. Partially server-backed. |
| AccountingBillForm | AccountingBillForm.tsx | **IN** | Sub-component of AccountingPortal. |
| AccountingView | AccountingView.tsx | **IN** | Accounting summary view. |
| IntelligenceHub | IntelligenceHub.tsx | **IN** | Command center / operations hub. 181KB monolith - needs decomposition. Imports seedMockData. |
| CommandCenterView | CommandCenterView.tsx | **IN** | Operational command center sub-view. |
| OperationalMessaging | OperationalMessaging.tsx | **IN** | In-app messaging. localStorage-backed threads. |
| IssueSidebar | IssueSidebar.tsx | **IN** | Issue/incident quick panel. |
| Scanner | Scanner.tsx | **IN** | Document scanner (BOL/Rate-Con). |
| DriverMobileHome | DriverMobileHome.tsx | **IN** | Driver-facing mobile view. |
| CommsOverlay | CommsOverlay.tsx | **IN** | Global communication overlay. |
| ExportModal | ExportModal.tsx | **IN** | PDF/CSV export. |
| SidebarTree | SidebarTree.tsx | **IN** | Navigation sidebar. |
| EditUserModal | EditUserModal.tsx | **IN** | User edit modal within CompanyProfile. |
| AuditLogs | AuditLogs.tsx | **IN** | Audit trail viewer. |
| BolGenerator | BolGenerator.tsx | **DEFERRED** | BOL PDF generation. Functional but not connected to real data. |
| IFTAManager | IFTAManager.tsx | **DEFERRED** | IFTA fuel tax reporting. Requires mileage data pipeline. |
| IFTAChart | IFTAChart.tsx | **DEFERRED** | IFTA chart sub-component. |
| IFTAEvidenceReview | IFTAEvidenceReview.tsx | **DEFERRED** | IFTA audit evidence review. |
| Intelligence | Intelligence.tsx | **DEFERRED** | Legacy intelligence view - superseded by IntelligenceHub. |
| AnalyticsDashboard | AnalyticsDashboard.tsx | **DEFERRED** | Analytics/reporting. Needs real data before it is useful. |
| NetworkPortal | NetworkPortal.tsx | **DEFERRED** | Carrier network/marketplace. Not needed for MVP. |
| CustomerPortalView | CustomerPortalView.tsx | **DEFERRED** | Customer-facing portal. Requires tenant isolation first. |
| DataImportWizard | DataImportWizard.tsx | **DEFERRED** | Bulk data import tool. |
| FileVault | FileVault.tsx | **DEFERRED** | Document vault. localStorage-backed. |
| GlobalMapViewEnhanced | GlobalMapViewEnhanced.tsx | **DEFERRED** | Live map view. Requires Google Maps API key and real GPS data. |
| LoadGantt | LoadGantt.tsx | **DEFERRED** | Gantt chart for load scheduling. |
| DispatcherTimeline | DispatcherTimeline.tsx | **DEFERRED** | Timeline view for dispatchers. |
| GlobalMapView | GlobalMapView.tsx | **OUT** | Superseded by GlobalMapViewEnhanced. |
| MapView | MapView.tsx | **OUT** | Legacy map component. Superseded. |
| GoogleMapsAPITester | GoogleMapsAPITester.tsx | **OUT** | Development/debug tool only. |

## 2. Services (services/)

| Service | File | Classification | Notes |
|---------|------|----------------|-------|
| storageService | storageService.ts | **IN** - **REPLACE** | 1,796 lines. Primary data layer using localStorage. Must be replaced with API client. |
| authService | authService.ts | **IN** - **REPLACE** | localStorage session management + partial Firebase. Must use server JWT only. |
| mockDataService | mockDataService.ts | **IN** - **DELETE** | Pure mock data seeder. Must be removed entirely. |
| safetyService | safetyService.ts | **IN** - **REPLACE** | localStorage-backed safety data. Must migrate to server. |
| brokerService | brokerService.ts | **IN** - **REPLACE** | localStorage-backed broker CRUD. Must migrate to server. |
| firebase | firebase.ts | **IN** | Firebase client initialization. Keep for Auth provider. |
| api | api.ts | **IN** | API base URL config. Foundation for new API client. |
| dispatchIntelligence | dispatchIntelligence.ts | **IN** | Pure logic (no localStorage). Keep and expand. |
| geminiService | geminiService.ts | **IN** | AI document parsing. Server-side only. |
| ocrService | ocrService.ts | **IN** - **REPLACE** | Currently returns hardcoded mock data. Must call real AI service. |
| financialService | financialService.ts | **IN** | Financial calculations. Needs server backing. |
| detentionService | detentionService.ts | **IN** | Detention fee calculations. |
| exceptionService | exceptionService.ts | **IN** | Exception workflow client. Already uses API calls. |
| exportService | exportService.ts | **IN** | PDF/CSV export helpers. |
| rulesEngineService | rulesEngineService.ts | **DEFERRED** | Automation rules engine. Not connected. |
| fuelService | fuelService.ts | **DEFERRED** | Fuel card integration. Contains mock automation rule. |
| syncService | syncService.ts | **DEFERRED** | Firebase Realtime DB sync. |
| networkService | networkService.ts | **DEFERRED** | Carrier network API client. |
| weatherService | weatherService.ts | **DEFERRED** | Azure Maps / OpenWeather integration. |
| directionsService | directionsService.ts | **DEFERRED** | Google Maps Directions API. |
| distanceMatrixService | distanceMatrixService.ts | **DEFERRED** | Google Maps Distance Matrix. |
| geocodingService | geocodingService.ts | **DEFERRED** | Google Maps Geocoding. |
| geoService | geoService.ts | **DEFERRED** | Geometry helpers. |
| roadsService | roadsService.ts | **DEFERRED** | Google Roads API. |
| driverSafeService | driverSafeService.ts | **DEFERRED** | Driver safety scoring API. |

## 3. Server (server/)

| Module | File | Classification | Notes |
|--------|------|----------------|-------|
| API Server | index.ts | **IN** - **REFACTOR** | 1,762-line monolith with 61+ routes. Must be decomposed into route modules. |
| Auth Middleware | auth.ts | **IN** | JWT authentication middleware. |
| Database Pool | db.ts | **IN** | MySQL2 connection pool. |
| Firestore Admin | firestore.ts | **IN** | Firebase Admin SDK. |
| Geo Utilities | geoUtils.ts | **IN** | Server-side geolocation helpers. |
| Local DB | local_db.ts | **OUT** | SQLite fallback - not production-grade. |
| Schema | schema.sql | **IN** | MySQL schema definition. 20+ tables. |
| Migrations | migrations/ | **IN** | Database migration scripts. |

## 4. Server API Route Groups (within server/index.ts)

| Route Group | Lines | Classification | Notes |
|-------------|-------|----------------|-------|
| Health | 72 | **IN** | /api/health |
| Auth (register/login) | 147-309 | **IN** | /api/auth/* |
| Companies | 119-146 | **IN** | /api/companies/* |
| Users | 176-316 | **IN** | /api/users/* |
| Equipment | 317-358 | **IN** | /api/equipment/* |
| Clients (Customers) | 359-400 | **IN** | /api/clients/* |
| Loads | 401-524 | **IN** | /api/loads/* |
| Contracts | 525-551 | **IN** | /api/contracts/* |
| Time Logs | 552-602 | **IN** | /api/time-logs/* |
| Dispatch Events | 603-661 | **IN** | /api/dispatch-events/* |
| Compliance | 620-633 | **IN** | /api/compliance/* |
| Load Status | 662-686 | **IN** | /api/loads/:id/status |
| Messages | 687-711 | **IN** | /api/messages/* |
| Incidents | 712-786 | **IN** | /api/incidents/* |
| Parties (Accounting) | 788-971 | **IN** | /api/parties/* |
| Accounting | 972-1566 | **IN** | /api/accounting/* - Journals, invoices, bills, settlements, IFTA, mileage |
| Exceptions | 1568-1666 | **IN** | /api/exceptions/* |
| Dashboard Cards | 1667-1677 | **IN** | /api/dashboard/cards |
| Global Search | 1678+ | **IN** | /api/global-search |

## 5. Shared Types

| File | Classification | Notes |
|------|----------------|-------|
| types.ts | **IN** - **REFACTOR** | 1,611 lines, 42,749 bytes. Contains all TypeScript interfaces. LoadStatus has 15 values in type vs 12 in DB schema - mismatch must be resolved. |
| vite-env.d.ts | **IN** | Vite type declarations. |

## 6. Configuration and Build

| File | Classification | Notes |
|------|----------------|-------|
| App.tsx | **IN** - **REFACTOR** | 31KB root component. Seeds mock data on every login. Must remove seed calls. |
| index.tsx | **IN** | React entry point. |
| index.html | **IN** | HTML shell. |
| index.css | **IN** | Global styles. |
| package.json | **IN** | Frontend dependencies. |
| tsconfig.json | **IN** | TypeScript config. |
| vite.config.ts | **IN** | Vite build config. |
| firebase.json | **IN** | Firebase hosting config. |
| .firebaserc | **IN** | Firebase project alias. |
| server/package.json | **IN** | Server dependencies. |
| server/tsconfig.json | **IN** | Server TypeScript config. |

## 7. Database Tables (MySQL - server/schema.sql)

All 21 tables are **IN** scope:

1. companies - Multi-tenant root
2. users - Auth and roles
3. customers - Brokers and direct clients
4. customer_contracts - Rate agreements
5. equipment - Fleet registry
6. loads - Core dispatch entity
7. load_legs - Multi-stop routing
8. expenses - Load-level costs
9. issues - Maintenance/quality issues
10. incidents - Emergency events
11. incident_actions - Incident timeline
12. emergency_charges - Incident billing
13. compliance_records - Driver compliance
14. training_courses - Safety training
15. driver_time_logs - HOS and time tracking
16. dispatch_events - Dispatch audit log
17. messages - Operational chat
18. leads - Sales intake
19. quotes - Pricing proposals
20. bookings - Confirmed bookings
21. work_items - Unified triage queue

## Summary

| Category | IN | OUT | DEFERRED | Total |
|----------|-----|-----|----------|-------|
| Components | 30 | 3 | 12 | 45 |
| Services | 14 | 0 | 12 | 26 |
| Server modules | 6 | 1 | 0 | 7 |
| DB tables | 21 | 0 | 0 | 21 |

### Critical Path for Release 1

1. Replace storageService.ts localStorage with API client (biggest risk)
2. Replace authService.ts localStorage session with server JWT
3. Remove mockDataService.ts and all seed calls from App.tsx
4. Decompose server/index.ts into route modules
5. Resolve types.ts LoadStatus mismatch between frontend and DB schema
6. Add tenant isolation (company_id enforcement) to all server routes
