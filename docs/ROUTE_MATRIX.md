# Route Matrix — LoadPilot API

> Generated: 2026-03-24 | Source: `server/routes/*.ts` (34 route modules)

## Summary

| Metric           | Count   |
| ---------------- | ------- |
| **Total routes** | **134** |
| Auth-protected   | 131/134 |
| Tenant-isolated  | 127/134 |
| Tier-gated       | 8/134   |
| Role-restricted  | 11/134  |
| Public (no auth) | 3/134   |

### Public Routes (intentionally unauthenticated)

| #   | Method | Path                     | Module    | Rationale                        |
| --- | ------ | ------------------------ | --------- | -------------------------------- |
| 1   | GET    | /api/health              | health.ts | Load balancer / monitoring probe |
| 2   | POST   | /api/auth/login          | users.ts  | Login endpoint (Bearer verified) |
| 3   | POST   | /api/auth/reset-password | users.ts  | Password reset (rate-limited)    |

### Tier-Gated Routes

| Module      | Tier(s) Required                          |
| ----------- | ----------------------------------------- |
| ai.ts       | Automation Pro, Fleet Core, Fleet Command |
| tracking.ts | Fleet Core, Fleet Command                 |

---

## Module: accounting.ts

Mount: direct (`app.use(accountingRouter)`)

| Method | Path                                  | Auth | Tenant | Role | Tier | UI Surface       |
| ------ | ------------------------------------- | ---- | ------ | ---- | ---- | ---------------- |
| GET    | /api/accounting/accounts              | Y    | Y      | -    | -    | AccountingPortal |
| GET    | /api/accounting/load-pl/:loadId       | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/accounting/journal               | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/accounting/invoices              | Y    | Y      | -    | -    | AccountingPortal |
| GET    | /api/accounting/invoices              | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/accounting/bills                 | Y    | Y      | -    | -    | AccountingPortal |
| GET    | /api/accounting/bills                 | Y    | Y      | -    | -    | AccountingPortal |
| GET    | /api/accounting/settlements           | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/accounting/settlements           | Y    | Y      | -    | -    | AccountingPortal |
| PATCH  | /api/accounting/settlements/batch     | Y    | Y      | -    | -    | AccountingPortal |
| GET    | /api/accounting/docs                  | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/accounting/docs                  | Y    | Y      | -    | -    | AccountingPortal |
| PATCH  | /api/accounting/docs/:id              | Y    | Y      | -    | -    | AccountingPortal |
| GET    | /api/accounting/ifta-evidence/:loadId | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/accounting/ifta-analyze          | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/accounting/ifta-audit-lock       | Y    | Y      | -    | -    | AccountingPortal |
| GET    | /api/accounting/ifta-summary          | Y    | Y      | -    | -    | AccountingPortal |
| GET    | /api/accounting/mileage               | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/accounting/mileage               | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/accounting/ifta-post             | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/accounting/adjustments           | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/accounting/batch-import          | Y    | Y      | -    | -    | AccountingPortal |

## Module: ai.ts

Mount: `/api/ai` prefix (`app.use("/api/ai", aiRouter)`)

| Method | Path                      | Auth | Tenant | Role | Tier                                      | UI Surface |
| ------ | ------------------------- | ---- | ------ | ---- | ----------------------------------------- | ---------- |
| POST   | /api/ai/extract-load      | Y    | Y      | -    | Automation Pro, Fleet Core, Fleet Command | Scanner    |
| POST   | /api/ai/extract-broker    | Y    | Y      | -    | Automation Pro, Fleet Core, Fleet Command | Scanner    |
| POST   | /api/ai/extract-equipment | Y    | Y      | -    | Automation Pro, Fleet Core, Fleet Command | Scanner    |
| POST   | /api/ai/generate-training | Y    | Y      | -    | Automation Pro, Fleet Core, Fleet Command | SafetyView |
| POST   | /api/ai/analyze-safety    | Y    | Y      | -    | Automation Pro, Fleet Core, Fleet Command | SafetyView |

## Module: bookings.ts

Mount: direct

| Method | Path              | Auth | Tenant | Role | Tier | UI Surface   |
| ------ | ----------------- | ---- | ------ | ---- | ---- | ------------ |
| GET    | /api/bookings     | Y    | Y      | -    | -    | QuoteManager |
| GET    | /api/bookings/:id | Y    | Y      | -    | -    | QuoteManager |
| POST   | /api/bookings     | Y    | Y      | -    | -    | QuoteManager |
| PATCH  | /api/bookings/:id | Y    | Y      | -    | -    | QuoteManager |

## Module: call-logs.ts

Mount: direct

| Method | Path           | Auth | Tenant | Role | Tier | UI Surface       |
| ------ | -------------- | ---- | ------ | ---- | ---- | ---------------- |
| POST   | /api/call-logs | Y    | Y      | -    | -    | OperationsCenter |
| GET    | /api/call-logs | Y    | Y      | -    | -    | OperationsCenter |

## Module: call-sessions.ts

Mount: direct

| Method | Path                   | Auth | Tenant | Role | Tier | UI Surface       |
| ------ | ---------------------- | ---- | ------ | ---- | ---- | ---------------- |
| GET    | /api/call-sessions     | Y    | Y      | -    | -    | OperationsCenter |
| POST   | /api/call-sessions     | Y    | Y      | -    | -    | OperationsCenter |
| PUT    | /api/call-sessions/:id | Y    | Y      | -    | -    | OperationsCenter |
| DELETE | /api/call-sessions/:id | Y    | Y      | -    | -    | OperationsCenter |

## Module: clients.ts

Mount: direct

| Method | Path                       | Auth | Tenant | Role              | Tier | UI Surface     |
| ------ | -------------------------- | ---- | ------ | ----------------- | ---- | -------------- |
| GET    | /api/clients/:companyId    | Y    | Y      | -                 | -    | BrokerNetwork  |
| PATCH  | /api/clients/:id/archive   | Y    | Y      | admin, dispatcher | -    | BrokerNetwork  |
| PATCH  | /api/clients/:id/unarchive | Y    | Y      | admin, dispatcher | -    | BrokerNetwork  |
| POST   | /api/clients               | Y    | Y      | -                 | -    | BrokerNetwork  |
| GET    | /api/companies/:id         | Y    | Y      | -                 | -    | CompanyProfile |
| POST   | /api/companies             | Y    | Y      | -                 | -    | CompanyProfile |
| GET    | /api/parties               | Y    | Y      | -                 | -    | BrokerNetwork  |
| POST   | /api/parties               | Y    | Y      | -                 | -    | BrokerNetwork  |
| GET    | /api/global-search         | Y    | Y      | -                 | -    | GlobalSearch   |

## Module: compliance.ts

Mount: direct

| Method | Path                    | Auth | Tenant | Role                                    | Tier | UI Surface |
| ------ | ----------------------- | ---- | ------ | --------------------------------------- | ---- | ---------- |
| GET    | /api/compliance/:userId | Y    | Y      | self, admin, dispatcher, safety_manager | -    | SafetyView |

## Module: contacts.ts

Mount: direct

| Method | Path                      | Auth | Tenant | Role | Tier | UI Surface    |
| ------ | ------------------------- | ---- | ------ | ---- | ---- | ------------- |
| GET    | /api/contacts             | Y    | Y      | -    | -    | BrokerNetwork |
| POST   | /api/contacts             | Y    | Y      | -    | -    | BrokerNetwork |
| PATCH  | /api/contacts/:id         | Y    | Y      | -    | -    | BrokerNetwork |
| PATCH  | /api/contacts/:id/archive | Y    | Y      | -    | -    | BrokerNetwork |

## Module: contracts.ts

Mount: direct

| Method | Path                       | Auth | Tenant | Role | Tier | UI Surface    |
| ------ | -------------------------- | ---- | ------ | ---- | ---- | ------------- |
| GET    | /api/contracts/:customerId | Y    | Y      | -    | -    | BrokerNetwork |
| POST   | /api/contracts             | Y    | Y      | -    | -    | BrokerNetwork |

## Module: crisis-actions.ts

Mount: direct

| Method | Path                    | Auth | Tenant | Role                              | Tier | UI Surface      |
| ------ | ----------------------- | ---- | ------ | --------------------------------- | ---- | --------------- |
| GET    | /api/crisis-actions     | Y    | Y      | -                                 | -    | IntelligenceHub |
| POST   | /api/crisis-actions     | Y    | Y      | -                                 | -    | IntelligenceHub |
| PATCH  | /api/crisis-actions/:id | Y    | Y      | admin, dispatcher, safety_manager | -    | IntelligenceHub |

## Module: dispatch.ts

Mount: direct

| Method | Path                              | Auth | Tenant | Role                    | Tier | UI Surface       |
| ------ | --------------------------------- | ---- | ------ | ----------------------- | ---- | ---------------- |
| POST   | /api/time-logs                    | Y    | Y      | self, admin, dispatcher | -    | OperationsCenter |
| GET    | /api/time-logs/:userId            | Y    | Y      | non-driver or self      | -    | OperationsCenter |
| GET    | /api/time-logs/company/:companyId | Y    | Y      | -                       | -    | OperationsCenter |
| GET    | /api/dispatch-events/:companyId   | Y    | Y      | -                       | -    | OperationsCenter |
| GET    | /api/dispatch/events              | Y    | Y      | -                       | -    | OperationsCenter |
| POST   | /api/dispatch-events              | Y    | Y      | -                       | -    | OperationsCenter |
| GET    | /api/audit                        | Y    | Y      | -                       | -    | AuditLogs        |
| GET    | /api/dashboard/cards              | Y    | Y      | -                       | -    | Dashboard        |
| POST   | /api/dispatch/best-matches        | Y    | Y      | -                       | -    | OperationsCenter |

## Module: documents.ts

Mount: direct

| Method | Path                        | Auth | Tenant | Role | Tier | UI Surface     |
| ------ | --------------------------- | ---- | ------ | ---- | ---- | -------------- |
| GET    | /api/documents              | Y    | Y      | -    | -    | LoadDetailView |
| POST   | /api/documents              | Y    | Y      | -    | -    | LoadDetailView |
| GET    | /api/documents/:id/download | Y    | Y      | -    | -    | LoadDetailView |

## Module: equipment.ts

Mount: direct

| Method | Path                      | Auth | Tenant | Role                              | Tier | UI Surface |
| ------ | ------------------------- | ---- | ------ | --------------------------------- | ---- | ---------- |
| GET    | /api/equipment            | Y    | Y      | -                                 | -    | SafetyView |
| GET    | /api/equipment/:companyId | Y    | Y      | -                                 | -    | SafetyView |
| POST   | /api/equipment            | Y    | Y      | -                                 | -    | SafetyView |
| PATCH  | /api/equipment/:id        | Y    | Y      | admin, dispatcher, safety_manager | -    | SafetyView |

## Module: exceptions.ts

Mount: direct

| Method | Path                       | Auth | Tenant | Role | Tier | UI Surface      |
| ------ | -------------------------- | ---- | ------ | ---- | ---- | --------------- |
| GET    | /api/exceptions            | Y    | Y      | -    | -    | IntelligenceHub |
| POST   | /api/exceptions            | Y    | Y      | -    | -    | IntelligenceHub |
| PATCH  | /api/exceptions/:id        | Y    | Y      | -    | -    | IntelligenceHub |
| GET    | /api/exceptions/:id/events | Y    | Y      | -    | -    | IntelligenceHub |
| GET    | /api/exception-types       | Y    | Y      | -    | -    | IntelligenceHub |

## Module: geofence.ts

Mount: direct

| Method | Path                     | Auth | Tenant | Role | Tier | UI Surface       |
| ------ | ------------------------ | ---- | ------ | ---- | ---- | ---------------- |
| POST   | /api/geofence-events     | Y    | Y      | -    | -    | OperationsCenter |
| GET    | /api/geofence-events     | Y    | Y      | -    | -    | OperationsCenter |
| POST   | /api/detention/calculate | Y    | Y      | -    | -    | OperationsCenter |

## Module: health.ts

Mount: direct (before other routes)

| Method | Path        | Auth | Tenant | Role | Tier | UI Surface     |
| ------ | ----------- | ---- | ------ | ---- | ---- | -------------- |
| GET    | /api/health | N    | N      | -    | -    | Ops/Monitoring |

## Module: incidents.ts

Mount: direct

| Method | Path                       | Auth | Tenant | Role | Tier | UI Surface      |
| ------ | -------------------------- | ---- | ------ | ---- | ---- | --------------- |
| GET    | /api/incidents             | Y    | Y      | -    | -    | IntelligenceHub |
| POST   | /api/incidents             | Y    | Y      | -    | -    | IntelligenceHub |
| POST   | /api/incidents/:id/actions | Y    | Y      | -    | -    | IntelligenceHub |
| POST   | /api/incidents/:id/charges | Y    | Y      | -    | -    | IntelligenceHub |

## Module: kci-requests.ts

Mount: direct

| Method | Path                  | Auth | Tenant | Role                                  | Tier | UI Surface      |
| ------ | --------------------- | ---- | ------ | ------------------------------------- | ---- | --------------- |
| GET    | /api/kci-requests     | Y    | Y      | -                                     | -    | IntelligenceHub |
| POST   | /api/kci-requests     | Y    | Y      | -                                     | -    | IntelligenceHub |
| PATCH  | /api/kci-requests/:id | Y    | Y      | admin, dispatcher, payroll_manager \* | -    | IntelligenceHub |

\* Role check applies only to approval fields.

## Module: leads.ts

Mount: direct

| Method | Path           | Auth | Tenant | Role  | Tier | UI Surface   |
| ------ | -------------- | ---- | ------ | ----- | ---- | ------------ |
| GET    | /api/leads     | Y    | Y      | -     | -    | QuoteManager |
| GET    | /api/leads/:id | Y    | Y      | -     | -    | QuoteManager |
| POST   | /api/leads     | Y    | Y      | -     | -    | QuoteManager |
| PATCH  | /api/leads/:id | Y    | Y      | -     | -    | QuoteManager |
| DELETE | /api/leads/:id | Y    | Y      | admin | -    | QuoteManager |

## Module: loads.ts

Mount: direct

| Method | Path                           | Auth | Tenant | Role | Tier | UI Surface     |
| ------ | ------------------------------ | ---- | ------ | ---- | ---- | -------------- |
| GET    | /api/loads                     | Y    | Y      | -    | -    | LoadManagement |
| POST   | /api/loads                     | Y    | Y      | -    | -    | LoadManagement |
| GET    | /api/loads/counts              | Y    | Y      | -    | -    | Dashboard      |
| PATCH  | /api/loads/:id/status          | Y    | Y      | -    | -    | LoadManagement |
| DELETE | /api/loads/:id                 | Y    | Y      | -    | -    | LoadManagement |
| POST   | /api/loads/:id/change-requests | Y    | Y      | -    | -    | LoadDetailView |
| GET    | /api/loads/:id/change-requests | Y    | Y      | -    | -    | LoadDetailView |

## Module: messages.ts

Mount: direct

| Method | Path              | Auth | Tenant | Role | Tier | UI Surface |
| ------ | ----------------- | ---- | ------ | ---- | ---- | ---------- |
| GET    | /api/messages     | Y    | Y      | -    | -    | Messaging  |
| POST   | /api/messages     | Y    | Y      | -    | -    | Messaging  |
| DELETE | /api/messages/:id | Y    | Y      | -    | -    | Messaging  |

## Module: metrics.ts

Mount: direct

| Method | Path         | Auth | Tenant | Role                                      | Tier | UI Surface |
| ------ | ------------ | ---- | ------ | ----------------------------------------- | ---- | ---------- |
| GET    | /api/metrics | Y    | N      | admin, ORG_OWNER_SUPER_ADMIN, OWNER_ADMIN | -    | Admin      |

## Module: notification-jobs.ts

Mount: direct

| Method | Path                       | Auth | Tenant | Role | Tier | UI Surface       |
| ------ | -------------------------- | ---- | ------ | ---- | ---- | ---------------- |
| GET    | /api/notification-jobs     | Y    | Y      | -    | -    | SafetyView       |
| GET    | /api/notification-jobs/:id | Y    | Y      | -    | -    | SafetyView       |
| POST   | /api/notification-jobs     | Y    | Y      | -    | -    | OperationsCenter |
| PATCH  | /api/notification-jobs/:id | Y    | Y      | -    | -    | OperationsCenter |

## Module: providers.ts

Mount: direct

| Method | Path                       | Auth | Tenant | Role | Tier | UI Surface    |
| ------ | -------------------------- | ---- | ------ | ---- | ---- | ------------- |
| GET    | /api/providers             | Y    | Y      | -    | -    | BrokerNetwork |
| POST   | /api/providers             | Y    | Y      | -    | -    | BrokerNetwork |
| PATCH  | /api/providers/:id         | Y    | Y      | -    | -    | BrokerNetwork |
| PATCH  | /api/providers/:id/archive | Y    | Y      | -    | -    | BrokerNetwork |

## Module: quickbooks.ts

Mount: direct

| Method | Path                         | Auth | Tenant | Role | Tier | UI Surface       |
| ------ | ---------------------------- | ---- | ------ | ---- | ---- | ---------------- |
| GET    | /api/quickbooks/auth-url     | Y    | Y      | -    | -    | CompanyProfile   |
| GET    | /api/quickbooks/callback     | Y    | Y      | -    | -    | CompanyProfile   |
| POST   | /api/quickbooks/sync-invoice | Y    | Y      | -    | -    | AccountingPortal |
| POST   | /api/quickbooks/sync-bill    | Y    | Y      | -    | -    | AccountingPortal |
| GET    | /api/quickbooks/status       | Y    | Y      | -    | -    | CompanyProfile   |

## Module: quotes.ts

Mount: direct

| Method | Path                    | Auth | Tenant | Role | Tier | UI Surface   |
| ------ | ----------------------- | ---- | ------ | ---- | ---- | ------------ |
| GET    | /api/quotes             | Y    | Y      | -    | -    | QuoteManager |
| GET    | /api/quotes/:id         | Y    | Y      | -    | -    | QuoteManager |
| POST   | /api/quotes             | Y    | Y      | -    | -    | QuoteManager |
| PATCH  | /api/quotes/:id         | Y    | Y      | -    | -    | QuoteManager |
| PATCH  | /api/quotes/:id/archive | Y    | Y      | -    | -    | QuoteManager |

## Module: safety.ts

Mount: direct

| Method | Path                         | Auth | Tenant | Role | Tier | UI Surface |
| ------ | ---------------------------- | ---- | ------ | ---- | ---- | ---------- |
| GET    | /api/safety/quizzes          | Y    | Y      | -    | -    | SafetyView |
| GET    | /api/safety/quizzes/:id      | Y    | Y      | -    | -    | SafetyView |
| POST   | /api/safety/quizzes          | Y    | Y      | -    | -    | SafetyView |
| GET    | /api/safety/quiz-results     | Y    | Y      | -    | -    | SafetyView |
| POST   | /api/safety/quiz-results     | Y    | Y      | -    | -    | SafetyView |
| GET    | /api/safety/maintenance      | Y    | Y      | -    | -    | SafetyView |
| GET    | /api/safety/maintenance/:id  | Y    | Y      | -    | -    | SafetyView |
| POST   | /api/safety/maintenance      | Y    | Y      | -    | -    | SafetyView |
| GET    | /api/safety/vendors          | Y    | Y      | -    | -    | SafetyView |
| GET    | /api/safety/vendors/:id      | Y    | Y      | -    | -    | SafetyView |
| POST   | /api/safety/vendors          | Y    | Y      | -    | -    | SafetyView |
| GET    | /api/safety/activity         | Y    | Y      | -    | -    | SafetyView |
| POST   | /api/safety/activity         | Y    | Y      | -    | -    | SafetyView |
| GET    | /api/safety/expiring-certs   | Y    | Y      | -    | -    | SafetyView |
| GET    | /api/safety/fmcsa/:dotNumber | Y    | Y      | -    | -    | SafetyView |

## Module: service-tickets.ts

Mount: direct

| Method | Path                     | Auth | Tenant | Role | Tier | UI Surface |
| ------ | ------------------------ | ---- | ------ | ---- | ---- | ---------- |
| GET    | /api/service-tickets     | Y    | Y      | -    | -    | SafetyView |
| POST   | /api/service-tickets     | Y    | Y      | -    | -    | SafetyView |
| PATCH  | /api/service-tickets/:id | Y    | Y      | -    | -    | SafetyView |

## Module: stripe.ts

Mount: direct

| Method | Path                                | Auth | Tenant | Role | Tier | UI Surface      |
| ------ | ----------------------------------- | ---- | ------ | ---- | ---- | --------------- |
| POST   | /api/stripe/webhook                 | N\*  | N      | -    | -    | External/Stripe |
| POST   | /api/stripe/create-checkout-session | Y    | Y      | -    | -    | CompanyProfile  |
| POST   | /api/stripe/create-billing-portal   | Y    | Y      | -    | -    | CompanyProfile  |

\* Webhook uses Stripe signature verification (`stripe-signature` header), not Firebase auth.

## Module: tasks.ts

Mount: direct

| Method | Path                | Auth | Tenant | Role | Tier | UI Surface       |
| ------ | ------------------- | ---- | ------ | ---- | ---- | ---------------- |
| GET    | /api/tasks          | Y    | Y      | -    | -    | OperationsCenter |
| POST   | /api/tasks          | Y    | Y      | -    | -    | OperationsCenter |
| PATCH  | /api/tasks/:id      | Y    | Y      | -    | -    | OperationsCenter |
| GET    | /api/work-items     | Y    | Y      | -    | -    | IntelligenceHub  |
| POST   | /api/work-items     | Y    | Y      | -    | -    | IntelligenceHub  |
| PATCH  | /api/work-items/:id | Y    | Y      | -    | -    | IntelligenceHub  |

## Module: tracking.ts

Mount: direct

| Method | Path                    | Auth | Tenant | Role | Tier                      | UI Surface       |
| ------ | ----------------------- | ---- | ------ | ---- | ------------------------- | ---------------- |
| GET    | /api/loads/tracking     | Y    | Y      | -    | Fleet Core, Fleet Command | GlobalMapView    |
| GET    | /api/loads/:id/tracking | Y    | Y      | -    | Fleet Core, Fleet Command | LoadDetailView   |
| GET    | /api/tracking/live      | Y    | Y      | -    | Fleet Core, Fleet Command | GlobalMapView    |
| POST   | /api/tracking/webhook   | N\*  | N      | -    | -                         | External/ELD/GPS |

\* Webhook uses `X-GPS-API-Key` header verified against `GPS_WEBHOOK_SECRET` env var (not Firebase auth).

## Module: users.ts

Mount: direct

| Method | Path                     | Auth | Tenant | Role          | Tier | UI Surface  |
| ------ | ------------------------ | ---- | ------ | ------------- | ---- | ----------- |
| POST   | /api/auth/register       | Y    | Y      | admin         | -    | Auth/Signup |
| POST   | /api/users               | Y    | Y      | admin or self | -    | Auth/Signup |
| POST   | /api/auth/login          | N\*  | N      | -             | -    | Auth        |
| POST   | /api/auth/reset-password | N    | N      | -             | -    | Auth        |
| GET    | /api/users/me            | Y    | N      | -             | -    | All         |
| GET    | /api/users/:companyId    | Y    | Y      | -             | -    | Auth/Signup |

\* Login requires a Bearer token (Firebase ID token) but does not use the requireAuth middleware. The token is verified inside the handler.

## Module: vault-docs.ts

Mount: direct

| Method | Path                | Auth | Tenant | Role | Tier | UI Surface     |
| ------ | ------------------- | ---- | ------ | ---- | ---- | -------------- |
| GET    | /api/vault-docs     | Y    | Y      | -    | -    | LoadDetailView |
| POST   | /api/vault-docs     | Y    | Y      | -    | -    | LoadDetailView |
| GET    | /api/vault-docs/:id | Y    | Y      | -    | -    | LoadDetailView |

## Module: weather.ts

Mount: direct

| Method | Path         | Auth | Tenant | Role | Tier | UI Surface    |
| ------ | ------------ | ---- | ------ | ---- | ---- | ------------- |
| GET    | /api/weather | Y    | Y      | -    | -    | GlobalMapView |

---

## Frontend Raw Fetch Audit (CORE-04)

The following files bypass the centralized API client (`services/api.ts`) and use raw `fetch()` calls directly. These lack the global 401 interceptor and automatic auth header injection.

### Components (UI layer)

| File                                   | Fetch Count | Routes Called                                                                                                                                 | Team Owner |
| -------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `components/AccountingPortal.tsx`      | 1           | POST /api/accounting/batch-import                                                                                                             | Team 1     |
| `components/AuditLogs.tsx`             | 1           | GET /api/audit                                                                                                                                | Team 1     |
| `components/Auth.tsx`                  | 2           | POST /api/auth/reset-password, POST /api/auth/login                                                                                           | Team 1     |
| `components/CompanyProfile.tsx`        | 3           | GET /api/quickbooks/status, POST /api/stripe/create-billing-portal, GET /api/quickbooks/auth-url                                              | Team 1     |
| `components/GlobalMapViewEnhanced.tsx` | 2           | GET /api/tracking/live, GET /api/loads/:id/tracking                                                                                           | Team 1     |
| `components/IntelligenceHub.tsx`       | 2           | POST /api/incidents/:id/actions, POST /api/incidents/:id/charges                                                                              | Team 1     |
| `components/LoadDetailView.tsx`        | 1           | GET /api/documents                                                                                                                            | Team 1     |
| `components/SafetyView.tsx`            | 5           | GET /api/safety/fmcsa/:dotNumber, GET /api/notification-jobs, GET /api/safety/quizzes, GET /api/safety/quiz-results, GET /api/safety/settings | Team 1     |
| `components/Scanner.tsx`               | 1           | POST /api/ai/\*                                                                                                                               | Team 1     |
| `components/ui/CertExpiryWarnings.tsx` | 1           | GET /api/safety/expiring-certs                                                                                                                | Team 1     |

### Services (data layer)

| File                                | Fetch Count | Routes Called                                                                                                                                            | Team Owner |
| ----------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `services/api.ts`                   | 2           | (This IS the centralized client)                                                                                                                         | Team 1     |
| `services/authService.ts`           | 2           | GET /api/users/me, POST /api/auth/login                                                                                                                  | Team 1     |
| `services/apiHealth.ts`             | 2           | GET /api/health                                                                                                                                          | Team 1     |
| `services/brokerService.ts`         | 4           | GET /api/clients, POST /api/clients, GET /api/contracts, POST /api/contracts                                                                             | Team 1     |
| `services/exceptionService.ts`      | 6           | GET /api/exceptions, POST /api/exceptions, PATCH /api/exceptions/:id, GET /api/exceptions/:id/events, GET /api/exception-types, GET /api/dashboard/cards | Team 1     |
| `services/fuelService.ts`           | 1           | POST /api/accounting/fuel/batch                                                                                                                          | Team 1     |
| `services/networkService.ts`        | 2           | GET /api/parties, POST /api/parties                                                                                                                      | Team 1     |
| `services/safetyService.ts`         | 16          | All /api/safety/\* CRUD, /api/equipment, /api/compliance                                                                                                 | Team 1     |
| `services/weatherService.ts`        | 2           | Azure Maps (external, not server routes)                                                                                                                 | Team 1     |
| `services/geocodingService.ts`      | 2           | Google Maps (external, not server routes)                                                                                                                | Team 1     |
| `services/directionsService.ts`     | 2           | Google Maps (external, not server routes)                                                                                                                | Team 1     |
| `services/distanceMatrixService.ts` | 1           | Google Maps (external, not server routes)                                                                                                                | Team 1     |
| `services/roadsService.ts`          | 2           | Google Maps (external, not server routes)                                                                                                                | Team 1     |

### Remediation Plan

**Priority 1 (Security):** All 19 component-level raw `fetch()` calls should be migrated to the centralized `services/api.ts` client. This ensures:

- Automatic Bearer token injection via `getIdToken()`
- Global 401 interceptor (auto-redirect to login on expired tokens)
- Consistent error handling
- Single place for retry logic

**Priority 2 (Consistency):** The 31 service-layer raw `fetch()` calls (excluding external APIs) should be migrated to the api client. The `brokerService`, `exceptionService`, `safetyService`, and `networkService` files are the primary targets.

**Out of scope:** External API calls (Google Maps, Azure Maps) that do not hit our server are correctly using raw `fetch()` — no migration needed (7 files, ~11 calls).

**Estimated effort:** ~4 hours (mechanical migration, no logic changes).

---

## Notes

1. **Authentication model:** Firebase Auth via Bearer token. `requireAuth` middleware verifies the ID token with Firebase Admin SDK and populates `req.user`.
2. **Tenant isolation:** `requireTenant` middleware verifies the user belongs to the tenant scoped in the request. Routes additionally scope SQL queries by `company_id = req.user.tenantId`.
3. **Tier gating:** `requireTier(...)` middleware checks the company's subscription tier. Only `ai.ts` and `tracking.ts` use tier gating.
4. **Webhook routes:** Two webhook routes (`/api/stripe/webhook` and `/api/tracking/webhook`) use non-Firebase auth (Stripe signature, GPS API key respectively). These are intentionally outside the Firebase auth flow.
5. **Metrics:** The `/api/metrics` route uses a custom `requireAdmin` check (not `requireTenant`). It verifies the user has admin/ORG_OWNER_SUPER_ADMIN/OWNER_ADMIN role.
6. **Route count note:** The 134 total includes all individual HTTP method+path combinations across all 34 route modules.
