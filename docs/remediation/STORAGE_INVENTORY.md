# Source-of-Truth Inventory & localStorage Audit

**Created**: 2026-03-16
**Approver**: Operator

## Entity Storage Map

| #   | Entity            | Current Key            | Current Pattern                              | Target Pattern | Cutover Phase | Migration Decision                     | Owner Story |
| --- | ----------------- | ---------------------- | -------------------------------------------- | -------------- | ------------- | -------------------------------------- | ----------- |
| 1   | Quotes            | `quotes_v1`            | localStorage-only                            | API-only       | A→D           | User-triggered import                  | STORY-012   |
| 2   | Leads             | `leads_v1`             | localStorage-only                            | API-only       | A→D           | User-triggered import                  | STORY-013   |
| 3   | Bookings          | `bookings_v1`          | localStorage-only                            | API-only       | A→D           | User-triggered import                  | STORY-014   |
| 4   | Messages          | `messages_v1`          | localStorage-first, fire-and-forget API sync | API-only       | A→D           | User-triggered import                  | STORY-015   |
| 5   | Threads           | `threads_v1`           | localStorage-only                            | API-only       | A→D           | User-triggered import                  | STORY-015   |
| 6   | Call Sessions     | `calls_v1`             | localStorage-only                            | API-only       | A→D           | Operator confirm: import or discard    | STORY-016   |
| 7   | Operational Tasks | `tasks_v1`             | localStorage-only                            | API-only       | A→D           | Operator confirm: import or discard    | STORY-016   |
| 8   | Work Items        | `work_items_v1`        | localStorage-only                            | API-only       | A→D           | Operator confirm: import or discard    | STORY-016   |
| 9   | Crisis Actions    | `crisis_v1`            | localStorage-only                            | API-only       | A→D           | Operator confirm: import or discard    | STORY-017   |
| 10  | KCI Requests      | `requests_v1`          | localStorage-only                            | API-only       | A→D           | User-triggered import                  | STORY-017   |
| 11  | Service Tickets   | `service_tickets_v1`   | localStorage-first, API sync                 | API-only       | A→D           | Operator confirm: import or discard    | STORY-017   |
| 12  | Contacts          | `contacts_v1`          | localStorage-only                            | API-only       | A→D           | Operator confirm: import or discard    | STORY-018   |
| 13  | Providers         | `providers_v1`         | localStorage-only                            | API-only       | A→D           | Operator confirm: import or discard    | STORY-018   |
| 14  | Incidents         | `incidents_v1`         | API-fallback to localStorage                 | API-only       | B→D           | Already server-backed; remove fallback | STORY-019   |
| 15  | Notification Jobs | `notification_jobs_v1` | localStorage-first, API sync                 | API-only       | A→D           | Abandon (transient)                    | STORY-016   |
| 16  | Vault Documents   | `vault_docs_v1`        | localStorage-only                            | API-only       | A→D           | Operator confirm: import or discard    | STORY-018   |

**Note**: Loads use in-memory cache (`_cachedLoads`) with API as primary — already server-backed, no localStorage key.

## All localStorage Keys (Tenant-Scoped)

Key format: `loadpilot_{companyId}_{baseName}`

| #   | Base Key               | Function Constant                 | getter                     | setter                  |
| --- | ---------------------- | --------------------------------- | -------------------------- | ----------------------- |
| 1   | `quotes_v1`            | `STORAGE_KEY_QUOTES()`            | `getQuotes()`              | `saveQuote()`           |
| 2   | `leads_v1`             | `STORAGE_KEY_LEADS()`             | `getLeads()`               | `saveLead()`            |
| 3   | `bookings_v1`          | `STORAGE_KEY_BOOKINGS()`          | `getBookings()`            | `saveBooking()`         |
| 4   | `messages_v1`          | `STORAGE_KEY_MESSAGES()`          | `getMessages()`            | `saveMessage()`         |
| 5   | `threads_v1`           | `STORAGE_KEY_THREADS()`           | `getThreads()`             | `saveThread()`          |
| 6   | `calls_v1`             | `STORAGE_KEY_CALLS()`             | `getRawCalls()`            | `saveCallSession()`     |
| 7   | `tasks_v1`             | `STORAGE_KEY_TASKS()`             | `getRawTasks()`            | `saveTask()`            |
| 8   | `work_items_v1`        | `STORAGE_KEY_WORK_ITEMS()`        | `getRawWorkItems()`        | `saveWorkItem()`        |
| 9   | `crisis_v1`            | `STORAGE_KEY_CRISIS()`            | `getRawCrisisActions()`    | `saveCrisisAction()`    |
| 10  | `requests_v1`          | `STORAGE_KEY_REQUESTS()`          | `getRawRequests()`         | `saveRequest()`         |
| 11  | `service_tickets_v1`   | `STORAGE_KEY_SERVICE_TICKETS()`   | `getRawServiceTickets()`   | `saveServiceTicket()`   |
| 12  | `contacts_v1`          | `STORAGE_KEY_CONTACTS()`          | `getRawContacts()`         | `saveContact()`         |
| 13  | `providers_v1`         | `STORAGE_KEY_PROVIDERS()`         | `getRawProviders()`        | `saveProvider()`        |
| 14  | `incidents_v1`         | `STORAGE_KEY_INCIDENTS()`         | `getRawIncidents()`        | `saveIncident()`        |
| 15  | `notification_jobs_v1` | `STORAGE_KEY_NOTIFICATION_JOBS()` | `getRawNotificationJobs()` | `saveNotificationJob()` |
| 16  | `vault_docs_v1`        | `STORAGE_KEY_VAULT_DOCS()`        | `getRawVaultDocs()`        | `saveVaultDoc()`        |

## DEMO_MODE Seed Data Locations

| #   | Domain        | Location                      | Seed Content                                         |
| --- | ------------- | ----------------------------- | ---------------------------------------------------- |
| 1   | Incidents     | `storageService.ts:679-767`   | `seedIncidents()` — 2 fake incidents                 |
| 2   | Messages      | `storageService.ts:1001-1021` | 2 fake messages when list empty                      |
| 3   | Call Sessions | `storageService.ts:1835-1855` | 1 fake call in `getTriageQueues()`                   |
| 4   | Work Items    | `storageService.ts:1859-1891` | 2 fake work items in `getTriageQueues()`             |
| 5   | Providers     | `storageService.ts:1973-2019` | "Titan Recovery Specialists", "Rapid Tire & Service" |
| 6   | Contacts      | `storageService.ts:1938-1961` | "John Dispatcher", "Sarah Broker"                    |
| 7   | Trends        | `storageService.ts:973-993`   | 2 synthetic operational trends                       |

## API Fallback Patterns

| Pattern                                 | Domains                                                                                                | Behavior                                                 | Risk                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------- |
| API-first, localStorage fallback        | Incidents, Loads                                                                                       | Try API → on error return localStorage data silently     | Silent data staleness               |
| localStorage-first, fire-and-forget API | Messages, Service Tickets, Notification Jobs                                                           | Write localStorage → async API POST (no error surfacing) | Data loss if API never succeeds     |
| localStorage-only                       | 10 entities (Quotes, Leads, Bookings, Calls, Tasks, Crisis, Requests, Work Items, Contacts, Providers) | No API interaction                                       | Complete data loss on browser clear |

## Approved Post-Remediation localStorage Uses (Max 5)

| #   | Key Pattern                               | Purpose                                              | Allowed                                     |
| --- | ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| 1   | `loadpilot_{companyId}_ui_state`          | Sidebar collapsed, last active tab, view preferences | Yes — ephemeral UI state                    |
| 2   | `loadpilot_{companyId}_dismissed_banners` | Banner dismissal flags                               | Yes — non-authoritative preference          |
| 3   | `loadpilot_{companyId}_preferences`       | Theme, date format, timezone display                 | Yes — non-authoritative preference          |
| 4   | `loadpilot_{companyId}_offline_drafts`    | Loads/messages drafted during connectivity loss      | Yes — with "Pending sync" badge, 72h expiry |
| 5   | `loadpilot_migration_complete`            | One-time flag: localStorage migration finished       | Yes — prevents re-showing migration banner  |
