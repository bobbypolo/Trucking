# Mobile Sprint F+G+H+I: Driver Trip Loop Closure

## Goal

Close the driver trip loop so a driver can: receive push notifications for assignment/status changes, view stop sequences with appointments, complete stops with document prompts, see required-document checklists per trip, exchange threaded messages with dispatch, view a notification center, report issues (breakdown/delay/detention/lumper) including offline, escalate to dispatcher with push notification, and view pay/settlement details. Completes Master Plan Journey 2 (all 8 path steps) and Phase D exit gate (Workstream 4 + Checklist 20.5).

## System Context

### Files Read During Discovery

- `server/routes/push-tokens.ts` -- POST /api/push-tokens, POST /api/push-tokens/unregister
- `server/lib/expo-push.ts` -- sendPush(tokens, title, body, data) batches to Expo API
- `server/routes/loads.ts` -- Already fires push on load creation, reassignment, status change
- `server/services/notification-delivery.service.ts` -- deliverNotification() email/SMS; no push
- `server/routes/messages.ts` -- Basic CRUD, no threading, no read state
- `server/repositories/message.repository.ts` -- tenant-scoped findByCompany, create, delete
- `server/migrations/018_messages_threads.sql` -- threads + messages tables with thread_id
- `server/routes/exceptions.ts` -- Full CRUD, tenant-scoped
- `server/routes/incidents.ts` -- Full CRUD with linked exceptions
- `server/repositories/stop.repository.ts` -- findByLoadId, deleteByLoadId
- `server/routes/geofence.ts` -- ENTRY/EXIT events, detention calc
- `server/migrations/001_baseline.sql` -- load_legs table
- `server/services/load-state-machine.ts` -- 8-state machine
- `server/middleware/requireAuth.ts` -- Firebase token verification
- `server/middleware/requireTenant.ts` -- Tenant isolation
- `apps/trucker/src/services/api.ts` -- api client with Firebase auth
- `apps/trucker/src/services/pushNotifications.ts` -- 6 push token functions
- `apps/trucker/src/contexts/AuthContext.tsx` -- Push registration on auth
- `apps/trucker/src/app/(tabs)/loads/[id].tsx` -- Load detail screen
- `apps/trucker/src/app/(tabs)/_layout.tsx` -- Tab layout
- `apps/trucker/src/types/load.ts` -- Load, LoadLeg, LoadStatus
- `server/routes/accounting.ts` -- GET /api/accounting/settlements (driver self-scope: role-checked, drivers see only own settlements)
- `server/services/accounting.service.ts` -- listSettlementsWithLines(tenantId, driverId), checkSettlementViewPermission(role)

### Data Flow Diagram

```
Driver App                    Express API                      MySQL
  |-- POST /push-tokens -------->| INSERT push_tokens            |
  |<-- Push notification --------|<-- sendPush() on load event   |
  |-- GET /loads/:id/stops ----->| SELECT load_legs JOIN loads   |
  |-- PATCH /loads/:id/stops/:s->| UPDATE load_legs SET status   |
  |-- POST /messages ----------->| INSERT messages (thread_id)   |
  |-- GET /threads ------------->| SELECT threads WHERE company  |
  |-- PATCH /messages/:id/read ->| UPDATE messages SET read_at   |
  |-- POST /driver/exceptions -->| INSERT exceptions (driver)    |
  |-- GET /notifications ------->| SELECT notification_jobs      |
  |-- GET /accounting/settlements>| SELECT settlements (self-scope)|
```

### Existing Patterns

- All server routes use requireAuth + requireTenant middleware
- Repositories follow tenant-scoped pattern with companyId parameter
- Schemas use Zod for request validation
- Mobile services use api.ts wrapper for all HTTP calls
- Mobile screens follow expo-router file-based routing
- Offline queue: AsyncStorage + background sync
- Push: mobile registers token on auth, server sends via sendPush()

### Blast Radius Assessment

| Area | Impact | Risk |
|------|--------|------|
| server/routes/messages.ts | Extend with threading, read state | Low |
| server/repositories/message.repository.ts | Add thread methods | Low |
| server/services/notification-delivery.service.ts | Add push channel | Medium |
| server/index.ts | Register 2 new route modules | Low |
| server/routes/accounting.ts | Already built; consumed read-only | None |
| apps/trucker/src/app/(tabs)/_layout.tsx | Add Messages, Notifications, Pay tabs | Medium |
| apps/trucker/src/app/(tabs)/loads/[id].tsx | Add StopList + Report Issue | Medium |

---

## Phase 1 -- Push Channel + Notification Center

Phase Type: `foundation`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `server/services/notification-delivery.service.ts` | Add push channel: query push_tokens, call sendPush() | `server/__tests__/services/notification-delivery-push.test.ts` | unit |
| ADD | `apps/trucker/src/services/notifications.ts` | fetchNotifications() via GET /api/notification-jobs | `apps/trucker/__tests__/services/notifications.test.ts` | unit |
| ADD | `apps/trucker/src/types/notification.ts` | NotificationItem type | N/A | N/A |
| ADD | `apps/trucker/src/app/(tabs)/notifications.tsx` | Notification center: FlatList, pull-to-refresh | `apps/trucker/__tests__/screens/notifications.test.tsx` | unit |
| MODIFY | `apps/trucker/src/app/(tabs)/_layout.tsx` | Add Notifications tab | `apps/trucker/__tests__/screens/tab-layout.test.tsx` | unit |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| apps/trucker/src/types/notification.ts | Type-only | TS compiler + service tests |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| deliverNotification (push) | deliverNotification({channel:'push',...}) | DeliverNotificationOptions | DeliverNotificationResult | FAILED if no tokens | notification-jobs route | sendPush() |
| fetchNotifications | () => Promise<NotificationItem[]> | none | NotificationItem[] | Throws on error | NotificationsScreen | api.get('/notification-jobs') |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Push channel | unit | Mock | Verify token query + delegation to sendPush | server/__tests__/services/notification-delivery-push.test.ts |
| fetchNotifications | unit | Mock | Verify endpoint path and response mapping | apps/trucker/__tests__/services/notifications.test.ts |
| NotificationsScreen | unit | Mock | Verify FlatList renders notification items | apps/trucker/__tests__/screens/notifications.test.tsx |
| Tab layout | unit | Mock | Verify Tabs.Screen with name=notifications exists | apps/trucker/__tests__/screens/tab-layout.test.tsx |

Assertion blueprints:
- `expect(sendPush).toHaveBeenCalledWith(['ExponentPushToken[abc]'], 'LoadPilot Notification', 'test message', {})`
- `expect(result.status).toBe('SENT')`
- `expect(api.get).toHaveBeenCalledWith('/notification-jobs')`
- `expect(screen.getByText('Load assigned')).toBeTruthy()`

### Done When

- R-P1-01: deliverNotification({channel:'push'}) queries push_tokens for recipient user IDs with enabled=1 and calls sendPush() with the resulting tokens
- R-P1-02: deliverNotification({channel:'push'}) returns {status:'FAILED', sync_error:'No push tokens found'} when no enabled tokens exist
- R-P1-03: fetchNotifications() calls api.get('/notification-jobs') and returns NotificationItem[]
- R-P1-04: NotificationsScreen renders a FlatList with one item per notification showing message and sent_at
- R-P1-05: NotificationsScreen shows pull-to-refresh and re-fetches on pull
- R-P1-06: Tab layout includes a Notifications tab rendering NotificationsScreen

### Verification Command

```bash
npx vitest run server/__tests__/services/notification-delivery-push.test.ts --reporter=verbose && npx vitest run apps/trucker/__tests__/services/notifications.test.ts apps/trucker/__tests__/screens/notifications.test.tsx apps/trucker/__tests__/screens/tab-layout.test.tsx --reporter=verbose
```

---

## Phase 2 -- Message Threading + Read State

Phase Type: `foundation`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/migrations/056_message_threading.sql` | Add read_at to messages, participant_ids to threads | `server/__tests__/migrations/056_message_threading.test.ts` | unit |
| MODIFY | `server/routes/messages.ts` | POST /api/threads, GET /api/threads, GET /api/threads/:id/messages, PATCH /api/messages/:id/read | `server/__tests__/routes/messages-threading.test.ts` | unit |
| MODIFY | `server/repositories/message.repository.ts` | findByThread(), markRead(), createThread(), findThreadsByCompany() | `server/__tests__/repositories/message-repository-threading.test.ts` | unit |
| MODIFY | `server/schemas/message.ts` | createThreadSchema, markReadSchema | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| server/schemas/message.ts | Schema defs | Route tests |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| POST /api/threads | handler | {title?, load_id?, participant_ids} | 201 {thread} | 400 | MessagesScreen | createThread() |
| GET /api/threads | handler | ?loadId= | 200 {threads} | 500 | MessagesScreen | findThreadsByCompany() |
| GET /api/threads/:id/messages | handler | params: id | 200 {messages} | 404 | MessageThread | findByThread() |
| PATCH /api/messages/:id/read | handler | params: id | 200 {read_at} | 404 | MessageThread | markRead() |
| createThread | (input, companyId) => ThreadRow | thread input | ThreadRow | DB error | POST route | pool.query |
| markRead | (id, companyId) => string | ids | ISO timestamp | null | PATCH route | pool.query |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Migration | unit | Mock | Verify DDL SQL correctness | server/__tests__/migrations/056_message_threading.test.ts |
| Thread endpoints | unit | Mock | Verify handler logic and status codes | server/__tests__/routes/messages-threading.test.ts |
| Repository methods | unit | Mock | Verify SQL queries and tenant scoping | server/__tests__/repositories/message-repository-threading.test.ts |

Assertion blueprints:
- `expect(res.status).toBe(201)`
- `expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO threads'), expect.any(Array))`
- `expect(result.read_at).toMatch(/^\d{4}-\d{2}-\d{2}/)`

### Done When

- R-P2-01: POST /api/threads creates thread with company_id, participant_ids JSON, optional load_id, returns 201
- R-P2-02: GET /api/threads returns all threads for tenant, optionally filtered by loadId
- R-P2-03: GET /api/threads/:id/messages returns messages ordered by created_at ASC, tenant-scoped
- R-P2-04: PATCH /api/messages/:id/read sets read_at and returns 200
- R-P2-05: PATCH /api/messages/:id/read returns 404 when not found or wrong tenant
- R-P2-06: Migration 056 adds read_at DATETIME NULL to messages and participant_ids JSON to threads
- R-P2-07: POST /api/messages accepts optional thread_id and stores it

### Verification Command

```bash
npx vitest run server/__tests__/migrations/056_message_threading.test.ts server/__tests__/routes/messages-threading.test.ts server/__tests__/repositories/message-repository-threading.test.ts --reporter=verbose
```

---

## Phase 3 -- Mobile Messaging Screen

Phase Type: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/src/types/message.ts` | Thread, Message types | N/A | N/A |
| ADD | `apps/trucker/src/services/messaging.ts` | fetchThreads(), fetchThreadMessages(), sendMessage(), createThread(), markMessageRead() | `apps/trucker/__tests__/services/messaging.test.ts` | unit |
| ADD | `apps/trucker/src/app/(tabs)/messages.tsx` | Thread list: FlatList with previews | `apps/trucker/__tests__/screens/messages.test.tsx` | unit |
| ADD | `apps/trucker/src/components/MessageThread.tsx` | Messages FlatList, input, send | `apps/trucker/__tests__/components/MessageThread.test.tsx` | unit |
| MODIFY | `apps/trucker/src/app/(tabs)/_layout.tsx` | Add Messages tab | `apps/trucker/__tests__/screens/tab-layout.test.tsx` | unit |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| apps/trucker/src/types/message.ts | Type-only | TS compiler |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| fetchThreads | () => Thread[] | none | Thread[] | Throws | MessagesScreen | api.get('/threads') |
| sendMessage | (threadId, text) => Message | ids, text | Message | Throws | MessageThread | api.post('/messages') |
| markMessageRead | (id) => void | id | void | Throws | MessageThread | api.patch() |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Messaging service | unit | Mock | Verify endpoint paths and payload shapes | apps/trucker/__tests__/services/messaging.test.ts |
| MessagesScreen | unit | Mock | Verify FlatList items render thread titles | apps/trucker/__tests__/screens/messages.test.tsx |
| MessageThread | unit | Mock | Verify message list, input, and send action | apps/trucker/__tests__/components/MessageThread.test.tsx |

Assertion blueprints:
- `expect(api.get).toHaveBeenCalledWith('/threads')`
- `expect(api.post).toHaveBeenCalledWith('/messages', {thread_id: 'T1', sender_id: 'U1', text: 'Hello'})`
- `expect(screen.getByText('Hello from dispatch')).toBeTruthy()`

### Done When

- R-P3-01: fetchThreads() calls api.get('/threads') and returns Thread[]
- R-P3-02: sendMessage(threadId, text) calls api.post('/messages') with thread_id, sender_id, text
- R-P3-03: markMessageRead(id) calls api.patch('/messages/{id}/read')
- R-P3-04: MessagesScreen renders FlatList with thread title and last message preview
- R-P3-05: MessageThread renders messages chronologically with sender name and timestamp
- R-P3-06: MessageThread has TextInput and Send button; Send calls sendMessage()
- R-P3-07: Tab layout includes Messages tab rendering MessagesScreen

### Verification Command

```bash
npx vitest run apps/trucker/__tests__/services/messaging.test.ts apps/trucker/__tests__/screens/messages.test.tsx apps/trucker/__tests__/components/MessageThread.test.tsx apps/trucker/__tests__/screens/tab-layout.test.tsx --reporter=verbose
```

---

## Phase 4 -- Driver-Facing Stops API

Phase Type: `foundation`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/migrations/057_stop_status_tracking.sql` | Add status ENUM, arrived_at, departed_at to load_legs | `server/__tests__/migrations/057_stop_status_tracking.test.ts` | unit |
| ADD | `server/routes/driver-stops.ts` | GET /api/loads/:loadId/stops, PATCH /api/loads/:loadId/stops/:stopId | `server/__tests__/routes/driver-stops.test.ts` | unit |
| ADD | `server/schemas/driver-stops.ts` | Zod: patchStopSchema | N/A | N/A |
| MODIFY | `server/index.ts` | Register driverStopsRouter | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| server/schemas/driver-stops.ts | Schema defs | Route tests |
| server/index.ts | Import only | Route tests |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| GET /api/loads/:loadId/stops | handler | loadId | 200 {stops} | 404 | StopList | stopRepository.findByLoadId() |
| PATCH /api/loads/:loadId/stops/:stopId | handler | params + body | 200 {stop} | 404/400 | StopList | pool.query UPDATE |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Migration | unit | Mock | Verify DDL SQL correctness | server/__tests__/migrations/057_stop_status_tracking.test.ts |
| Endpoints | unit | Mock | Verify handler logic and tenant scoping | server/__tests__/routes/driver-stops.test.ts |

Assertion blueprints:
- `expect(res.body.stops).toHaveLength(3)`
- `expect(res.body.stops[0].sequence_order).toBe(1)`
- `expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE load_legs SET'), expect.arrayContaining(['arrived']))`

### Done When

- R-P4-01: GET /api/loads/:loadId/stops returns stops ordered by sequence_order, tenant-scoped
- R-P4-02: GET returns 404 when load not found or wrong tenant
- R-P4-03: PATCH updates status, arrived_at, departed_at, completed
- R-P4-04: PATCH returns 404 when stop not found or wrong tenant
- R-P4-05: PATCH returns 400 when body fails validation
- R-P4-06: Migration 057 adds status ENUM DEFAULT 'pending', arrived_at, departed_at to load_legs

### Verification Command

```bash
npx vitest run server/__tests__/migrations/057_stop_status_tracking.test.ts server/__tests__/routes/driver-stops.test.ts --reporter=verbose
```

---

## Phase 5 -- Mobile Stop List + Load Detail Integration

Phase Type: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/src/types/stop.ts` | Stop, StopStatus types | N/A | N/A |
| ADD | `apps/trucker/src/services/stops.ts` | fetchStops(), updateStopStatus() | `apps/trucker/__tests__/services/stops.test.ts` | unit |
| ADD | `apps/trucker/src/components/StopList.tsx` | Ordered stops with action buttons | `apps/trucker/__tests__/components/StopList.test.tsx` | unit |
| MODIFY | `apps/trucker/src/app/(tabs)/loads/[id].tsx` | Render StopList | `apps/trucker/__tests__/screens/load-detail-stops.test.tsx` | unit |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| apps/trucker/src/types/stop.ts | Type-only | TS compiler |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| fetchStops | (loadId) => Stop[] | loadId | Stop[] | Throws | StopList | api.get() |
| updateStopStatus | (loadId, stopId, update) => Stop | ids, update | Stop | Throws | StopList | api.patch() |
| StopList | component | {loadId} | stop cards | loading/error | LoadDetail | services |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Stops service | unit | Mock | Verify endpoint paths and payload | apps/trucker/__tests__/services/stops.test.ts |
| StopList | unit | Mock | Verify ordered rendering with appointments | apps/trucker/__tests__/components/StopList.test.tsx |
| Load detail | unit | Mock | Verify StopList rendered with loadId | apps/trucker/__tests__/screens/load-detail-stops.test.tsx |

Assertion blueprints:
- `expect(api.get).toHaveBeenCalledWith('/loads/L1/stops')`
- `expect(screen.getByText('Pickup - Warehouse A')).toBeTruthy()`
- `expect(api.patch).toHaveBeenCalledWith('/loads/L1/stops/S1', {status: 'arrived', arrived_at: expect.any(String)})`

### Done When

- R-P5-01: fetchStops(loadId) calls api.get('/loads/{loadId}/stops') and returns Stop[]
- R-P5-02: updateStopStatus calls api.patch with status update payload
- R-P5-03: StopList renders stops in sequence_order with facility_name, city, state, appointment_time
- R-P5-04: StopList shows Arrive when pending, Depart when arrived, Complete when departed
- R-P5-05: Pressing Arrive calls updateStopStatus with {status:'arrived', arrived_at: ISO}
- R-P5-06: StopList shows color-coded status badge per stop
- R-P5-07: Load detail renders StopList with the current load ID
- R-P5-08: StopList prompts Capture Document after completing Pickup or Dropoff
- R-P5-09: Load detail shows document checklist section listing required doc types (BOL, POD) with present/missing indicators from fetchDocuments(loadId)

### Verification Command

```bash
npx vitest run apps/trucker/__tests__/services/stops.test.ts apps/trucker/__tests__/components/StopList.test.tsx apps/trucker/__tests__/screens/load-detail-stops.test.tsx --reporter=verbose
```

---

## Phase 6 -- Driver Exception Intake API

Phase Type: `foundation`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/routes/driver-exceptions.ts` | POST + GET /api/driver/exceptions | `server/__tests__/routes/driver-exceptions.test.ts` | unit |
| ADD | `server/schemas/driver-exceptions.ts` | createDriverExceptionSchema | N/A | N/A |
| MODIFY | `server/index.ts` | Register driverExceptionsRouter | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| server/schemas/driver-exceptions.ts | Schema defs | Route tests |
| server/index.ts | Import only | Route tests |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| POST /api/driver/exceptions | handler | {issue_type, load_id, description, photo_urls?, location?} | 201 {id} | 400/404 | IssueReportForm | pool.query + messageRepository |
| GET /api/driver/exceptions | handler | ?loadId= | 200 {exceptions} | 500 | LoadDetail | pool.query |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| POST intake | unit | Mock | Verify INSERT SQL and tenant scoping | server/__tests__/routes/driver-exceptions.test.ts |
| GET exceptions | unit | Mock | Verify filtered query and response shape | server/__tests__/routes/driver-exceptions.test.ts |
| Validation | unit | Mock | Verify 400 on invalid issue_type | server/__tests__/routes/driver-exceptions.test.ts |

Assertion blueprints:
- `expect(res.status).toBe(201)`
- `expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO exceptions'), expect.arrayContaining(['BREAKDOWN']))`

### Done When

- R-P6-01: POST creates exception with tenant_id, type from issue_type, status OPEN, entity_type LOAD
- R-P6-02: POST accepts: BREAKDOWN, DELAY_REPORTED, DETENTION_ELIGIBLE, LUMPER_REQUEST, INCIDENT_GENERAL
- R-P6-03: POST creates exception_events with action 'Driver Reported'
- R-P6-04: POST auto-creates escalation message in load thread
- R-P6-05: POST returns 400 for invalid issue_type
- R-P6-06: POST returns 404 when load not found or wrong tenant
- R-P6-07: GET returns user exceptions, optionally filtered by loadId
- R-P6-08: POST triggers push notification to load's assigned dispatcher via deliverNotification({channel:'push'})

### Verification Command

```bash
npx vitest run server/__tests__/routes/driver-exceptions.test.ts --reporter=verbose
```

---

## Phase 7 -- Mobile Issue Report Form

Phase Type: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/src/types/issue.ts` | DriverException, IssueType, CreateIssuePayload | N/A | N/A |
| ADD | `apps/trucker/src/services/issues.ts` | reportIssue(), fetchDriverExceptions() | `apps/trucker/__tests__/services/issues.test.ts` | unit |
| ADD | `apps/trucker/src/components/IssueReportForm.tsx` | Modal: type picker, description, photo, submit | `apps/trucker/__tests__/components/IssueReportForm.test.tsx` | unit |
| MODIFY | `apps/trucker/src/app/(tabs)/loads/[id].tsx` | Report Issue button + modal | `apps/trucker/__tests__/screens/load-detail-issues.test.tsx` | unit |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| apps/trucker/src/types/issue.ts | Type-only | TS compiler |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| reportIssue | (payload) => {id} | CreateIssuePayload | {id} | Throws | IssueReportForm | api.post() |
| fetchDriverExceptions | (loadId?) => DriverException[] | loadId | array | Throws | LoadDetail | api.get() |
| IssueReportForm | component | {loadId, visible, onClose, onSubmit} | Modal | validation | LoadDetail | reportIssue() |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Issues service | unit | Mock | Verify endpoint paths and payload shapes | apps/trucker/__tests__/services/issues.test.ts |
| IssueReportForm | unit | Mock | Verify form rendering and submit action | apps/trucker/__tests__/components/IssueReportForm.test.tsx |
| Load detail | unit | Mock | Verify Report Issue button and modal toggle | apps/trucker/__tests__/screens/load-detail-issues.test.tsx |

Assertion blueprints:
- `expect(api.post).toHaveBeenCalledWith('/driver/exceptions', {issue_type: 'BREAKDOWN', load_id: 'L1', description: 'Flat tire'})`
- `expect(screen.getByText('Breakdown')).toBeTruthy()`
- `expect(screen.getByText('Report Issue')).toBeTruthy()`

### Done When

- R-P7-01: reportIssue calls api.post('/driver/exceptions') with issue_type, load_id, description, optional photo_urls
- R-P7-02: fetchDriverExceptions calls api.get('/driver/exceptions?loadId={loadId}')
- R-P7-03: IssueReportForm renders picker with: Breakdown, Delay, Detention, Lumper, Other
- R-P7-04: IssueReportForm renders description TextInput (multiline) and Submit button
- R-P7-05: Submit disabled when issue_type not selected or description empty
- R-P7-06: On submit calls reportIssue() then onClose() + onSubmit()
- R-P7-07: Load detail shows Report Issue Pressable opening IssueReportForm modal
- R-P7-08: IssueReportForm has Attach Photo button navigating to camera
- R-P7-09: When offline, reportIssue() stores the payload in AsyncStorage offline queue and syncs on reconnect

### Verification Command

```bash
npx vitest run apps/trucker/__tests__/services/issues.test.ts apps/trucker/__tests__/components/IssueReportForm.test.tsx apps/trucker/__tests__/screens/load-detail-issues.test.tsx --reporter=verbose
```

---

## Phase 8 -- Pay/Settlement Visibility

Phase Type: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/src/types/settlement.ts` | Settlement, SettlementLine types | N/A | N/A |
| ADD | `apps/trucker/src/services/settlements.ts` | fetchSettlements(), fetchSettlementDetail() | `apps/trucker/__tests__/services/settlements.test.ts` | unit |
| ADD | `apps/trucker/src/app/(tabs)/pay.tsx` | Settlements list: FlatList with status, amount, period | `apps/trucker/__tests__/screens/pay.test.tsx` | unit |
| ADD | `apps/trucker/src/components/SettlementDetail.tsx` | Detail view: line items by load, deductions, total | `apps/trucker/__tests__/components/SettlementDetail.test.tsx` | unit |
| MODIFY | `apps/trucker/src/app/(tabs)/_layout.tsx` | Add Pay tab | `apps/trucker/__tests__/screens/tab-layout.test.tsx` | unit |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| apps/trucker/src/types/settlement.ts | Type-only | TS compiler |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| fetchSettlements | () => Settlement[] | none | Settlement[] | Throws on error | PayScreen | api.get('/accounting/settlements') |
| fetchSettlementDetail | (id) => Settlement | id | Settlement with lines | Throws on 404 | SettlementDetail | api.get('/accounting/settlements') + filter |
| PayScreen | component | none | settlement list | empty state | Tab nav | fetchSettlements() |
| SettlementDetail | component | {settlement} | line items | - | PayScreen | none |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Settlements service | unit | Mock | Verify endpoint path and response mapping | apps/trucker/__tests__/services/settlements.test.ts |
| PayScreen | unit | Mock | Verify FlatList renders settlement rows | apps/trucker/__tests__/screens/pay.test.tsx |
| SettlementDetail | unit | Mock | Verify line items, totals, deductions render | apps/trucker/__tests__/components/SettlementDetail.test.tsx |

Assertion blueprints:
- `expect(api.get).toHaveBeenCalledWith('/accounting/settlements')`
- `expect(screen.getByText('$1,250.00')).toBeTruthy()`
- `expect(screen.getByText('Pending')).toBeTruthy()`
- `expect(screen.getByText('Load #1234')).toBeTruthy()`

### Done When

- R-P8-01: fetchSettlements() calls api.get('/accounting/settlements') and returns Settlement[]
- R-P8-02: PayScreen renders FlatList with settlement status, total_amount, and pay_period
- R-P8-03: PayScreen shows empty state message when no settlements exist
- R-P8-04: Pressing a settlement row navigates to SettlementDetail
- R-P8-05: SettlementDetail renders line items with load reference, description, and amount
- R-P8-06: SettlementDetail shows deductions, reimbursements, and net pay total
- R-P8-07: Tab layout includes Pay tab rendering PayScreen

### Verification Command

```bash
npx vitest run apps/trucker/__tests__/services/settlements.test.ts apps/trucker/__tests__/screens/pay.test.tsx apps/trucker/__tests__/components/SettlementDetail.test.tsx apps/trucker/__tests__/screens/tab-layout.test.tsx --reporter=verbose
```

---

## Phase 9 -- End-to-End Integration + Dashboard

Phase Type: `e2e`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `apps/trucker/src/app/(tabs)/index.tsx` | Next Stop, Open Issues, Latest Pay cards | `apps/trucker/__tests__/screens/home-dashboard.test.tsx` | unit |
| ADD | `apps/trucker/__tests__/integration/driver-trip-loop.test.ts` | Mobile integration test | `apps/trucker/__tests__/integration/driver-trip-loop.test.ts` | integration |
| ADD | `server/__tests__/integration/driver-trip-loop.test.ts` | Server integration test | `server/__tests__/integration/driver-trip-loop.test.ts` | integration |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| HomeScreen | component | none | Dashboard cards | - when no data | Tab nav | fetchLoads(), fetchStops(), fetchDriverExceptions(), fetchSettlements() |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Dashboard cards | unit | Mock | Verify Next Stop, Open Issues, Latest Pay cards render | apps/trucker/__tests__/screens/home-dashboard.test.tsx |
| Mobile loop | integration | Mock at api boundary | Verify full driver trip loop: push → load detail → stops → arrive → issue → verify | apps/trucker/__tests__/integration/driver-trip-loop.test.ts |
| Server loop | integration | Mock at pool.query boundary | Verify full server trip loop: stops → PATCH → exception → escalation msg → push | server/__tests__/integration/driver-trip-loop.test.ts |

Assertion blueprints:
- `expect(screen.getByText('Next Stop')).toBeTruthy()`
- `expect(screen.getByText('Open Issues')).toBeTruthy()`
- `expect(screen.getByText('Latest Pay')).toBeTruthy()`

### Done When

- R-P9-01: Dashboard displays Next Stop card with facility and appointment time
- R-P9-02: Dashboard displays Open Issues card with count
- R-P9-03: Dashboard displays Latest Pay card with most recent settlement amount and status
- R-P9-04: Dashboard shows empty state placeholders when no active loads, no issues, no settlements
- R-P9-05 [integration]: Server test: create load with stops → GET stops → PATCH arrive → POST exception → verify escalation message created → verify push notification dispatched
- R-P9-06 [integration]: Mobile test: mock push received → load detail → stops rendered → arrive action → issue report → verify all API calls in correct sequence

### Verification Command

```bash
npx vitest run apps/trucker/__tests__/screens/home-dashboard.test.tsx apps/trucker/__tests__/integration/driver-trip-loop.test.ts --reporter=verbose && npx vitest run server/__tests__/integration/driver-trip-loop.test.ts --reporter=verbose
```

---

## Master Plan Traceability

### Journey 2: Driver Trip Execution — Coverage Map

| Journey Step | Plan Coverage |
|---|---|
| 1. Driver receives assignment | Phase 1 (push notification on assignment) |
| 2. Trip appears in mobile | Sprints A-E (already built: loads list + detail) |
| 3. Driver updates statuses | Sprint E (already built: StatusUpdateButton) |
| 4. Driver scans docs | Sprint D (already built: camera + document capture) |
| 5. Driver reports issue | Phase 6 (server) + Phase 7 (mobile) |
| 6. Trip completes | Sprint E (already built: status update to completed) |
| 7. Final packet visible | Phase 5 R-P5-09 (document checklist) |
| 8. Pay visibility updates | Phase 8 (settlements list + detail) |

### Workstream 4 Deliverables — Coverage Map

| Deliverable | Plan Coverage |
|---|---|
| Primary trip workspace | Sprints C-E (built) |
| Stop sequence and appointment awareness | Phases 4-5 |
| Status updates and change requests | Sprint E (built) |
| Delay, detention, breakdown, lumper, issue escalation | Phases 6-7 |
| Driver messaging and read-state continuity | Phases 2-3 |
| Document checklist by trip | Phase 5 R-P5-09 |
| Pay and settlement visibility | Phase 8 |
| Offline queue and sync behavior | Sprint E (built) + Phase 7 R-P7-09 |

### Checklist 20.5 — Coverage Map

| Item | Plan Coverage | Notes |
|---|---|---|
| Finalize mobile IA and trip-first home screen | Phase 9 (dashboard cards) | Home screen enhanced with Next Stop, Issues, Pay |
| Complete stop sequence and appointment display | Phase 5 | StopList with sequence + appointments |
| Complete status update controls | Sprint E (built) | StatusUpdateButton exists |
| Complete issue and breakdown reporting | Phases 6-7 | Full intake with 5 issue types |
| Complete document checklist and required-document prompts | Phase 5 R-P5-08, R-P5-09 | Per-stop prompt + trip-level checklist |
| Complete offline capture queue and sync retry | Sprint E (built) + Phase 7 R-P7-09 | Upload queue + issue offline queue |
| Complete pay / settlement view | Phase 8 | List + detail + line items |
| Complete messaging read-state and notification handoff | Phases 1-3 | Push + threading + read state |
| Complete mobile auth, session persistence, and logout | Sprint B2 (built) | Deferred hardening to Sprint L |
| Complete store, legal, and device baseline | Deferred to Sprint L | Not in scope |
| Complete build signing and internal distribution | Deferred to Sprint L | Not in scope |
| Complete privacy policy and permission copy approval | Deferred to Sprint L | Not in scope |
| Complete crash reporting activation | Deferred to Sprint L | Not in scope |
| Complete pilot device matrix and beta feedback intake | Deferred to Sprint L | Not in scope |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Expo push token not available in dev | Medium | Low | getPushToken() returns null gracefully |
| Message threading complexity | Low | Medium | Additive only; existing CRUD untouched |
| Stop migration on existing data | Low | Low | DEFAULT values on new columns |
| Offline issue queue conflict | Low | Medium | Separate AsyncStorage key from upload queue |
| Push channel affects existing callers | Medium | Medium | Existing email/SMS channels unchanged; push is additive case |
| Settlement API returns back-office fields to driver | Low | High | Server already enforces role-based self-scope; mobile only displays allowed fields |

## Dependencies

### Internal
- server/lib/expo-push.ts -- Built (verified)
- server/routes/push-tokens.ts -- Built (verified)
- server/repositories/stop.repository.ts -- Built (verified)
- server/repositories/message.repository.ts -- Extended (threading)
- server/routes/accounting.ts -- Built (verified, driver self-scope)
- server/services/accounting.service.ts -- Built (verified, role check)
- apps/trucker/src/services/pushNotifications.ts -- Built (verified)
- apps/trucker/src/services/documents.ts -- Built (used by doc checklist)

### External
- Expo Push API
- expo-notifications SDK (installed)
- @react-native-async-storage/async-storage (installed)

## Rollback Plan

1. Migrations: DOWN in reverse 057, 056
2. Routes: Remove driver-stops and driver-exceptions imports from server/index.ts
3. Push channel: Revert push case in deliverNotification()
4. Mobile: Remove new tabs (notifications, messages, pay), screens, services, components
5. No existing code depends on new files — all additions are leaf nodes

## Open Questions

None. All Master Plan Journey 2 steps, Workstream 4 deliverables, and Checklist 20.5 items are either covered by this sprint or explicitly deferred to Sprint L with documented rationale.
