# SaaS UX & Feature Remediation Sprint

## Goal

Remediate 14 user-testing issues across the SaaS web application to bring the dispatcher-facing platform from "functional prototype" to "polished product." This sprint addresses missing AI extraction fields, broken call buttons, unreadable UI elements, missing navigation, disproportionate sizing, incomplete event triggers, missing automated emails, and gaps in financial/analytics features. All work targets the `main` branch -- mobile app code under `apps/trucker/` is explicitly out of scope.

**Base branch**: `main`
**Issue ref**: #72

## System Context

### Files Read During Discovery

```
# Discovery tool output (Glob + Read + Grep):
# Glob("server/services/gemini.service.ts") → found
# Read(server/services/gemini.service.ts, offset=24, limit=60) → extractLoadInfo schema at lines 32-76
# Read(components/BookingPortal.tsx, offset=220, limit=30) → mapping at lines 226-236
# Read(components/Scanner.tsx, offset=112, limit=58) → mergeIntakeData at lines 112-170
# Read(packages/shared/src/types.ts, offset=740, limit=60) → LoadData interface fields 740-800
# Read(components/LoadDetailView.tsx, offset=274, limit=140) → handleTagForAction + action buttons
# Read(components/operations/TriageWorkspacePanel.tsx, offset=140, limit=320) → opacity classes + tabs
# Read(components/IntelligenceHub.tsx, offset=1520, limit=80) → tab array lines 1531-1548
# Read(components/LoadList.tsx, offset=155, limit=35) → raw pickupDate + call button
# Read(components/QuoteManager.tsx, offset=365, limit=25) → pipeline/intake buttons
# Glob("components/Quote*") → QuoteManager.tsx only (no QuoteDetailView.tsx)
# Read(server/services/notification-delivery.service.ts, offset=80, limit=40) → sendEmail
# Read(server/services/notification-delivery.service.ts, offset=230, limit=30) → deliverNotification
# Read(server/repositories/dispatch-event.repository.ts, offset=20, limit=60) → create() interface
# Read(server/schemas/quote.ts) → full file, no margin fields
# Read(server/repositories/quote.repository.ts, offset=1, limit=50) → QUOTE_UPDATABLE_COLUMNS
# Read(server/migrations/017_quotes_leads_bookings.sql, offset=1, limit=40) → quotes table schema
# Read(server/services/detentionPipeline.ts, offset=170, limit=35) → DETENTION_FLAGGED insert
# Read(server/services/discrepancyPipeline.ts, offset=60, limit=30) → DISCREPANCY_FLAGGED insert
# Read(components/ExceptionConsole.tsx, offset=140, limit=40) → CATEGORY_TABS
# Grep("dispatch-events", server/) → 6 files, routes/dispatch.ts has POST endpoint
# Grep("CommsOverlay", components/) → 1 file, CommsOverlay.tsx
# Read(components/CommsOverlay.tsx, offset=1, limit=30) → interface + imports
# Read(components/AnalyticsDashboard.tsx, offset=80, limit=40) → lane profitability calc
# Read(components/Intelligence.tsx, offset=1, limit=30) → imports
# Grep("bol-scan", server/) → loads.ts lines 718-779
# Glob("server/migrations/*.sql") → 54 migrations through 054_feature_flags.sql
```

| File | Key Findings |
|------|-------------|
| `server/services/gemini.service.ts` | extractLoadInfo (lines 24-85): schema extracts only 8 load fields + 4 broker fields. Prompt is generic. Missing: freightType, driverPay, dropoffDate, appointment times, bolNumber, specialInstructions, palletCount, containerNumber, chassisNumber |
| `components/BookingPortal.tsx` (220-236) | Maps extracted data to quote: `data.freightType` already referenced for equipmentType but OCR never returns it |
| `components/Scanner.tsx` (112-170) | mergeIntakeData already handles specialInstructions, bolNumber -- they just never get populated from OCR |
| `packages/shared/src/types.ts` (740-800) | LoadData interface already has all target fields: freightType(751), driverPay(748), dropoffDate(750), bolNumber(757), specialInstructions(793), palletCount(767), containerNumber(759), chassisNumber(761) |
| `components/LoadDetailView.tsx` (274-290) | handleTagForAction only calls saveLoad + shows toast. No dispatch event creation. Back button exists at line 342 (ChevronDown rotate-90) but only says "Back" with no destination context |
| `components/LoadDetailView.tsx` (360-399) | Utilities dropdown + Tag for Action button at text-[10px]. Notify Partners not present |
| `components/operations/TriageWorkspacePanel.tsx` (149,180,302,305,448) | Multiple `opacity-60`, `opacity-70` classes causing unreadable text on dark bg. Inactive tabs use `text-slate-600` |
| `components/IntelligenceHub.tsx` (1531-1548) | Tab array: OPS, FEED, COMMAND, SALES/CRM, NETWORK, INTELLIGENCE, REPORTS. No SAFETY tab. Tab buttons use `text-[10px]` |
| `components/LoadList.tsx` (163,173-178) | Raw ISO date rendering `{load.pickupDate}`. Call button onClick opens messaging hub, not tel: link |
| `components/QuoteManager.tsx` (369-382) | Pipeline View first, Intake Desk second. Default activeView = "pipeline" |
| `server/schemas/quote.ts` | Zod schema has no margin/discount/commission fields |
| `server/repositories/quote.repository.ts` (8-25) | QUOTE_UPDATABLE_COLUMNS lacks margin columns |
| `server/migrations/017_quotes_leads_bookings.sql` | quotes table has no margin/discount/commission/estimated_driver_pay/company_cost_factor columns |
| `components/QuoteDetailView.tsx` | File does not exist on disk -- quote detail is inline within QuoteManager.tsx |
| `server/services/detentionPipeline.ts` (182-197) | After DETENTION_FLAGGED event insert, no notification sent |
| `server/services/discrepancyPipeline.ts` (70-83) | After DISCREPANCY_FLAGGED event insert, no notification sent |
| `server/services/notification-delivery.service.ts` (94-96, 244-246) | sendEmail and deliverNotification fully implemented. SMTP config via env vars |
| `server/repositories/dispatch-event.repository.ts` (24-72) | CreateDispatchEventInput interface + create() method available |
| `server/routes/dispatch.ts` | Has POST /api/dispatch-events endpoint with createDispatchEventSchema validation |
| `server/routes/loads.ts` (718-779) | POST /api/loads/:id/bol-scan handler -- no email after scan |
| `components/ExceptionConsole.tsx` (149-156) | CATEGORY_TABS includes safety tab. Accepts initialView prop |
| `components/CommsOverlay.tsx` | Call sessions created but no actual phone dialing (tel: link) |
| `components/operations/useCrisisHandlers.ts` (233-265) | handleNotifyPartners builds contact list + opens picker. Only available in crisis workflow context |
| `components/AnalyticsDashboard.tsx` (89-114) | Lane profitability: profit = carrierRate - driverPay. No quarterly breakdown, no targets |
| `components/Intelligence.tsx` | Monthly/seasonal rate averaging from internal data. No lane-specific trend charts |
| `server/migrations/054_feature_flags.sql` | Latest migration number is 054 |

### Data Flow Diagram

```
User Testing Issue → This Plan
  ├── Frontend UX Fixes (Phases 1-4): CSS changes, button behavior, navigation
  │     └── No backend changes, no migrations
  ├── AI Extraction Enhancement (Phase 5): Gemini prompt + schema update
  │     └── server/services/gemini.service.ts → BookingPortal.tsx mapping
  ├── Backend Event/Notification (Phases 6-7): dispatch events, automated emails
  │     └── LoadDetailView → POST /api/dispatch-events
  │     └── detentionPipeline/discrepancyPipeline → deliverNotification()
  ├── Database Migrations (Phases 8-9): quote margins, digital agreements, financial objectives
  │     └── New migrations 055-057
  │     └── New/updated Zod schemas + repository columns
  ├── Feature Additions (Phases 10-12): agreements, analytics, market trends
  │     └── New routes + UI components
  └── Cross-cutting: Date formatting utility (Phase 1)
```

### Existing Patterns

- **Tailwind CSS**: Dark theme with slate palette, `text-[Npx]` sizing, `font-black uppercase tracking-widest`
- **Backend routes**: Express Router + requireAuth + requireTenant + validateBody(zodSchema) pattern
- **Repositories**: `buildSafeUpdate()` for PATCH, explicit column allowlists
- **Notifications**: `deliverNotification({ channel, message, recipients[], subject? })` from notification-delivery.service.ts
- **Events**: `dispatchEventRepository.create(input)` for append-only audit trail
- **Migrations**: Sequential numbered SQL files in `server/migrations/`

### Blast Radius Assessment

| Area | Impact |
|------|--------|
| `server/services/gemini.service.ts` | Extraction schema change affects all downstream OCR consumers (BookingPortal, Scanner) -- tested via existing scan tests |
| `components/LoadList.tsx` | Call button behavior change -- highly visible on load board |
| `components/LoadDetailView.tsx` | Multiple changes (back button, notify partners, tag events) -- most-visited detail view |
| `components/IntelligenceHub.tsx` | New SAFETY tab + button sizing -- affects hub navigation |
| `components/operations/TriageWorkspacePanel.tsx` | CSS-only changes -- low risk |
| `server/services/detentionPipeline.ts` | Adding notification call -- must not break existing detention calculation |
| `server/services/discrepancyPipeline.ts` | Adding notification call -- must not break existing discrepancy check |
| `server/migrations/` | 3 new additive migrations -- no destructive schema changes |
| `server/routes/` | New agreements.ts and analytics routes -- additive only |

---

## Phase 1 — UX Quick Fixes: Contrast, Sizing, Date Format, Tab Order

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `services/dateFormat.ts` | Add `formatDate()`, `formatDateTime()`, `formatRelativeDate()` utility functions | `src/__tests__/services/dateFormat.test.ts` | unit |
| ADD | `src/__tests__/services/dateFormat.test.ts` | Unit tests for `formatDate`, `formatDateTime`, `formatRelativeDate` | N/A | N/A |
| MODIFY | `components/operations/TriageWorkspacePanel.tsx` | Remove `opacity-60`/`opacity-70` from text, change `text-slate-500`/`text-slate-600` to `text-slate-300`/`text-slate-400`, `bg-white/[0.03]` to `bg-white/[0.08]` | `src/__tests__/components/TriageWorkspacePanel.contrast.test.tsx` | unit |
| ADD | `src/__tests__/components/TriageWorkspacePanel.contrast.test.tsx` | Grep verification of `opacity-60`, `opacity-70`, `text-slate-600` removal | N/A | N/A |
| MODIFY | `components/LoadList.tsx` | Replace raw `{load.pickupDate}` with `formatDate(load.pickupDate)`. Change button `text-[10px]` to `text-[11px]` | `src/__tests__/components/LoadList.dateformat.test.tsx` | unit |
| ADD | `src/__tests__/components/LoadList.dateformat.test.tsx` | Verify `formatDate` applied and min `text-[11px]` size | N/A | N/A |
| MODIFY | `components/QuoteManager.tsx` | Swap `Intake Desk` to first position, `Pipeline View` second. Change default `activeView` to `"intake"`. Change `text-[10px]` to `text-[11px]` | `src/__tests__/components/QuoteManager.taborder.test.tsx` | unit |
| ADD | `src/__tests__/components/QuoteManager.taborder.test.tsx` | Verify `activeView` default is `"intake"` and button order | N/A | N/A |
| MODIFY | `components/IntelligenceHub.tsx` | Change tab `text-[10px]` to `text-[11px]`. Add `{ label: "SAFETY", tab: "safety" }` after COMMAND | `src/__tests__/components/IntelligenceHub.safety-tab.test.tsx` | unit |
| ADD | `src/__tests__/components/IntelligenceHub.safety-tab.test.tsx` | Verify `SAFETY` tab and `ExceptionConsole` render | N/A | N/A |
| MODIFY | `components/LoadDetailView.tsx` | Change action button `text-[10px]` to `text-[11px]` | N/A — covered by Phase 2 tests | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `src/__tests__/services/dateFormat.test.ts` | Test file itself | Self-verifying |
| `src/__tests__/components/TriageWorkspacePanel.contrast.test.tsx` | Test file | Self-verifying |
| `src/__tests__/components/LoadList.dateformat.test.tsx` | Test file | Self-verifying |
| `src/__tests__/components/QuoteManager.taborder.test.tsx` | Test file | Self-verifying |
| `src/__tests__/components/IntelligenceHub.safety-tab.test.tsx` | Test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `formatDate(iso: string)` | `(iso: string) => string` | ISO date string or empty | Formatted "MMM DD, YYYY" or "---" | Returns "---" for invalid/empty input | LoadList, future date displays | None |
| `formatDateTime(iso: string)` | `(iso: string) => string` | ISO datetime string | Formatted "MMM DD, YYYY HH:MM" or "---" | Returns "---" for invalid/empty | Future use | None |
| `formatRelativeDate(iso: string)` | `(iso: string) => string` | ISO date string | "Today", "Tomorrow", "Yesterday", or formatted date | Returns "---" for invalid/empty | Future use | formatDate |

### Data Flow

```
LoadList renders → load.pickupDate (raw ISO) → formatDate() → "Apr 10, 2026"
                                              ↗ Error: empty/null → "---"
TriageWorkspacePanel → CSS classes only (no data flow change)
QuoteManager → activeView state: "pipeline" → "intake" (initial default change)
IntelligenceHub → SAFETY tab click → renders <ExceptionConsole initialView="safety" />
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| formatDate with valid ISO dates | unit | Real | Pure function, no deps | `src/__tests__/services/dateFormat.test.ts` |
| formatDate with edge cases (null, empty, invalid) | unit | Real | Pure function | `src/__tests__/services/dateFormat.test.ts` |
| TriageWorkspacePanel CSS classes | unit | Real | Verify class strings in source code via grep | `src/__tests__/components/TriageWorkspacePanel.contrast.test.tsx` |
| LoadList date rendering | unit | Mock | Verify formatDate is called with mock load data, not raw ISO | `src/__tests__/components/LoadList.dateformat.test.tsx` |
| QuoteManager tab order | unit | Mock | Verify Intake Desk renders first via mock render, default view | `src/__tests__/components/QuoteManager.taborder.test.tsx` |
| IntelligenceHub SAFETY tab | unit | Mock | Verify tab exists in array via mock render, conditional render | `src/__tests__/components/IntelligenceHub.safety-tab.test.tsx` |

**Assertion Blueprints**:
- `expect(formatDate("2026-04-10")).toBe("Apr 10, 2026")`
- `expect(formatDate("")).toBe("---")`
- `expect(source).not.toContain("opacity-60")`
- `expect(tabLabels[0]).toBe("Intake Desk")` (or grep verification)

### Done When

- R-P1-01 [frontend]: `formatDate("2026-04-10")` returns `"Apr 10, 2026"` and `formatDate("")` returns `"---"`
- R-P1-02 [frontend]: `formatDateTime("2026-04-10T14:30:00Z")` returns a string containing `"Apr 10, 2026"` and a time component
- R-P1-03 [frontend]: `TriageWorkspacePanel.tsx` source contains 0 instances of `opacity-60` or `opacity-70` on text elements
- R-P1-04 [frontend]: `TriageWorkspacePanel.tsx` inactive tab classes use `text-slate-400` instead of `text-slate-600`
- R-P1-05 [frontend]: `LoadList.tsx` renders dates via `formatDate()` -- 0 instances of raw `{load.pickupDate}` remain in rendered output
- R-P1-06 [frontend]: 0 instances of `text-[10px]` on interactive buttons remain in `LoadList.tsx`, `IntelligenceHub.tsx` tabs, and `QuoteManager.tsx` tabs -- all changed to `text-[11px]`
- R-P1-07 [frontend]: `QuoteManager.tsx` default `activeView` is `"intake"` and `Intake Desk` button renders before `Pipeline View`
- R-P1-08 [frontend]: `IntelligenceHub.tsx` tab array includes `{ label: "SAFETY", tab: "safety" }` after `COMMAND`
- R-P1-09 [frontend]: When `selectedTab === "safety"`, `IntelligenceHub.tsx` renders `ExceptionConsole` with `initialView="safety"`
- R-P1-10 [frontend]: `TriageWorkspacePanel.tsx` header panel background uses `bg-white/[0.08]` instead of `bg-white/[0.03]`

### Verification Command

```bash
npx vitest run --reporter=verbose src/__tests__/services/dateFormat.test.ts src/__tests__/components/TriageWorkspacePanel.contrast.test.tsx src/__tests__/components/LoadList.dateformat.test.tsx src/__tests__/components/QuoteManager.taborder.test.tsx src/__tests__/components/IntelligenceHub.safety-tab.test.tsx
```

---

## Phase 2 — Navigation & Back Buttons

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `components/LoadDetailView.tsx` | Add `"Back to Load Board"` button with `ArrowLeft` icon before manifest header, calls `onClose` | `src/__tests__/components/LoadDetailView.back-button.test.tsx` | unit |
| ADD | `src/__tests__/components/LoadDetailView.back-button.test.tsx` | Verify back button renders with `"Back to Load Board"` text and calls `onClose` | N/A | N/A |
| MODIFY | `components/IntelligenceHub.tsx` | Add breadcrumb bar showing `selectedTab` label with `setSelectedTab("ops")` navigation | `src/__tests__/components/IntelligenceHub.breadcrumb.test.tsx` | unit |
| ADD | `src/__tests__/components/IntelligenceHub.breadcrumb.test.tsx` | Verify breadcrumb renders current tab label via `data-testid="breadcrumb"` | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `src/__tests__/components/LoadDetailView.back-button.test.tsx` | Test file | Self-verifying |
| `src/__tests__/components/IntelligenceHub.breadcrumb.test.tsx` | Test file | Self-verifying |

### Interface Contracts

N/A -- No new functions. Back button uses existing `onClose` prop. Breadcrumb uses existing `setSelectedTab` prop.

### Data Flow

```
LoadDetailView → back button click → onClose() → parent unmounts LoadDetailView → Load Board visible
IntelligenceHub → breadcrumb click → setSelectedTab("ops") → re-renders OPS tab
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| LoadDetailView back button renders | unit | Mock | UI component test with mock props | `src/__tests__/components/LoadDetailView.back-button.test.tsx` |
| LoadDetailView back button calls onClose | unit | Mock | Verify click handler with mock onClose callback | `src/__tests__/components/LoadDetailView.back-button.test.tsx` |
| IntelligenceHub breadcrumb renders tab name | unit | Mock | UI component test with mock render | `src/__tests__/components/IntelligenceHub.breadcrumb.test.tsx` |

**Assertion Blueprints**:
- `expect(screen.getByText("Back to Load Board")).toBeInTheDocument()`
- `expect(onClose).toHaveBeenCalledOnce()`
- `expect(screen.getByTestId("breadcrumb")).toHaveTextContent("COMMAND")`

### Done When

- R-P2-01 [frontend]: `LoadDetailView.tsx` renders a visible `"Back to Load Board"` button with `ArrowLeft` icon above the manifest header
- R-P2-02 [frontend]: Clicking the back button in `LoadDetailView.tsx` calls the `onClose` prop exactly 1 time
- R-P2-03 [frontend]: `IntelligenceHub.tsx` renders a breadcrumb bar showing the current tab label when `selectedTab !== "ops"`

### Verification Command

```bash
npx vitest run --reporter=verbose src/__tests__/components/LoadDetailView.back-button.test.tsx src/__tests__/components/IntelligenceHub.breadcrumb.test.tsx
```

---

## Phase 3 — Call Button Fix (Load Board + Comms Overlay)

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `components/LoadList.tsx` | Change Call button `onClick`: if `load.customerContact?.phone` exists, call `window.open("tel:${phone}")`. Else fall back to `onOpenHub?.('messaging', true)`. Add `title` tooltip | `src/__tests__/components/LoadList.call-button.test.tsx` | unit |
| ADD | `src/__tests__/components/LoadList.call-button.test.tsx` | Test Call button with `phone="555-0100"` and `phone=undefined` | N/A | N/A |
| MODIFY | `components/CommsOverlay.tsx` | Add `<a href="tel:${phone}">` link when call session contact has `phone` property | `src/__tests__/components/CommsOverlay.tel-link.test.tsx` | unit |
| ADD | `src/__tests__/components/CommsOverlay.tel-link.test.tsx` | Verify `<a href="tel:...">` element rendered for calls with phone numbers | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `src/__tests__/components/LoadList.call-button.test.tsx` | Test file | Self-verifying |
| `src/__tests__/components/CommsOverlay.tel-link.test.tsx` | Test file | Self-verifying |

### Interface Contracts

N/A -- No new functions. Modifying existing onClick handlers to use `window.open()` with `tel:` protocol.

### Data Flow

```
LoadList Call button click
  → load.customerContact?.phone exists?
    → YES: window.open(`tel:${phone}`) → OS phone dialer
    → NO: onOpenHub?.('messaging', true) → IntelligenceHub messaging tab (fallback)

CommsOverlay call session
  → session contact has phone?
    → YES: render <a href="tel:${phone}"> alongside session info
    → NO: show "No phone number" placeholder
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| LoadList Call with phone number | unit | Mock | Browser API window.open mock needed | `src/__tests__/components/LoadList.call-button.test.tsx` |
| LoadList Call without phone | unit | Mock | Verify fallback behavior with mock onOpenHub callback | `src/__tests__/components/LoadList.call-button.test.tsx` |
| CommsOverlay tel link rendering | unit | Mock | UI test with mock session data | `src/__tests__/components/CommsOverlay.tel-link.test.tsx` |

**Assertion Blueprints**:
- `expect(window.open).toHaveBeenCalledWith("tel:555-0100")`
- `expect(onOpenHub).toHaveBeenCalledWith("messaging", true)` (fallback)
- `expect(screen.getByRole("link")).toHaveAttribute("href", "tel:555-0100")`

### Done When

- R-P3-01 [frontend]: `LoadList.tsx` Call button calls `window.open("tel:555-0100")` when `load.customerContact.phone` is `"555-0100"`
- R-P3-02 [frontend]: `LoadList.tsx` Call button falls back to `onOpenHub('messaging', true)` when `load.customerContact.phone` is `undefined`
- R-P3-03 [frontend]: `LoadList.tsx` Call button shows tooltip with phone number `"555-0100"` on hover when phone is available
- R-P3-04 [frontend]: `CommsOverlay.tsx` renders a clickable `<a href="tel:555-0100">` link when the active call session contact has a phone number

### Verification Command

```bash
npx vitest run --reporter=verbose src/__tests__/components/LoadList.call-button.test.tsx src/__tests__/components/CommsOverlay.tel-link.test.tsx
```

---

## Phase 4 — Notify Partners from Load Detail

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `components/LoadDetailView.tsx` | Add `"Notify Partners"` button near `"Tag for Action"`. Add inline modal with contact picker (`brokerId`, `driverId`, `customerContact`), message `<textarea>`, and `POST /api/notification-jobs` submit handler | `src/__tests__/components/LoadDetailView.notify-partners.test.tsx` | unit |
| ADD | `src/__tests__/components/LoadDetailView.notify-partners.test.tsx` | Test modal open/close, contact selection, `POST /api/notification-jobs` submit | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `src/__tests__/components/LoadDetailView.notify-partners.test.tsx` | Test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| NotifyPartnersModal (inline) | React component | `{ load, onClose, onSend }` | Renders contact picker + message form | Shows error toast on API failure | LoadDetailView | POST /api/notification-jobs |

### Data Flow

```
LoadDetailView → "Notify Partners" click → open modal
  → Modal extracts contacts: broker (load.brokerId → broker data), driver (load.driverId), customerContact
  → User selects contacts + types message
  → Submit → POST /api/notification-jobs { channel: "Multi", recipients, subject, message }
    → Success: toast "Notification sent" + close modal
    → Error: toast "Failed to send notification"
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Notify Partners button renders | unit | Mock | UI presence test with mock render | `src/__tests__/components/LoadDetailView.notify-partners.test.tsx` |
| Modal opens on click | unit | Mock | UI interaction with mock render and click | `src/__tests__/components/LoadDetailView.notify-partners.test.tsx` |
| Submit sends POST with correct payload | unit | Mock | Network mock for fetch needed | `src/__tests__/components/LoadDetailView.notify-partners.test.tsx` |
| Error handling on failed POST | unit | Mock | Error path with mock fetch rejection | `src/__tests__/components/LoadDetailView.notify-partners.test.tsx` |

**Assertion Blueprints**:
- `expect(screen.getByText("Notify Partners")).toBeInTheDocument()`
- `expect(fetch).toHaveBeenCalledWith("/api/notification-jobs", expect.objectContaining({ method: "POST" }))`
- `expect(screen.getByText("Notification sent")).toBeInTheDocument()`

### Done When

- R-P4-01 [frontend]: `LoadDetailView.tsx` renders a `"Notify Partners"` button in the action bar next to `"Tag for Action"`
- R-P4-02 [frontend]: Clicking `"Notify Partners"` opens an inline modal with >= 1 contact checkboxes extracted from load data (`brokerId`, `driverId`, `customerContact`)
- R-P4-03 [frontend]: Submitting the modal sends `POST /api/notification-jobs` with `channel: "Multi"`, selected contacts as `recipients[]`, and the message text
- R-P4-04 [frontend]: A success toast with text `"Notification sent"` appears after successful POST returns 200
- R-P4-05 [frontend]: An error toast appears when the `POST /api/notification-jobs` fails with status >= 400

### Verification Command

```bash
npx vitest run --reporter=verbose src/__tests__/components/LoadDetailView.notify-partners.test.tsx
```

---

## Phase 5 — AI Extraction Enhancement (Gemini Schema + Prompt)

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `server/services/gemini.service.ts` | Expand `extractLoadInfo` schema with 10 new fields: `freightType`, `driverPay`, `dropoffDate`, `pickupAppointmentTime`, `dropoffAppointmentTime`, `bolNumber`, `specialInstructions`, `palletCount`, `containerNumber`, `chassisNumber`. Rewrite prompt with explicit extraction guidance | `server/__tests__/services/gemini-schema.test.ts` | unit |
| ADD | `server/__tests__/services/gemini-schema.test.ts` | Verify `schema.properties.load.properties` includes all 10 new fields and prompt contains `"equipment type"`, `"delivery date"` keywords | N/A | N/A |
| MODIFY | `components/BookingPortal.tsx` | Update mapping at lines 227-237: `data.freightType` to `equipmentType`, `data.dropoffDate`, `data.specialInstructions` from extraction result | `src/__tests__/components/BookingPortal.extraction-mapping.test.tsx` | unit |
| ADD | `src/__tests__/components/BookingPortal.extraction-mapping.test.tsx` | Verify `freightType`, `dropoffDate`, `specialInstructions` mapped from extraction result to quote state | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/__tests__/services/gemini-schema.test.ts` | Test file | Self-verifying |
| `src/__tests__/components/BookingPortal.extraction-mapping.test.tsx` | Test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `extractLoadInfo` (updated) | `(base64: string, mime: string) => Promise<ExtractedLoadData>` | Base64 image + MIME type | JSON with load (18 fields) + broker (4 fields) | Returns `{load: {}, broker: {}}` on parse failure | BookingPortal, Scanner intake | Google Gemini API |

### Data Flow

```
Document image → extractLoadInfo()
  → Gemini API with expanded schema + detailed prompt
  → JSON response: { load: { loadNumber, carrierRate, ..., freightType, dropoffDate, bolNumber, specialInstructions, palletCount, containerNumber, chassisNumber }, broker: {...} }
  → BookingPortal maps: data.freightType → equipmentType, data.dropoffDate → (stored), data.specialInstructions → (stored)
  → Scanner.mergeIntakeData: bolNumber, specialInstructions now populated from OCR
  Error paths: Gemini returns partial → missing fields are undefined → consumers use existing fallbacks
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Schema includes all 10 new fields | unit | Real | Schema is a static object, inspect directly | `server/__tests__/services/gemini-schema.test.ts` |
| Prompt contains extraction guidance keywords | unit | Real | Prompt is a static string, inspect directly | `server/__tests__/services/gemini-schema.test.ts` |
| BookingPortal maps new extraction fields | unit | Mock | Verify state update with mock extraction result | `src/__tests__/components/BookingPortal.extraction-mapping.test.tsx` |

**Assertion Blueprints**:
- `expect(schema.properties.load.properties).toHaveProperty("freightType")`
- `expect(schema.properties.load.properties).toHaveProperty("dropoffDate")`
- `expect(prompt).toContain("equipment type")`
- `expect(prompt).toContain("delivery date")`

### Done When

- R-P5-01 [backend]: `extractLoadInfo` schema `properties.load.properties` includes `freightType` (STRING), `driverPay` (NUMBER), `dropoffDate` (STRING), `pickupAppointmentTime` (STRING), `dropoffAppointmentTime` (STRING) -- 5 new fields
- R-P5-02 [backend]: `extractLoadInfo` schema `properties.load.properties` includes `bolNumber` (STRING), `specialInstructions` (STRING), `palletCount` (NUMBER), `containerNumber` (STRING), `chassisNumber` (STRING) -- 5 more new fields
- R-P5-03 [backend]: `extractLoadInfo` prompt string contains keywords `"equipment type"`, `"delivery date"`, `"appointment"`, `"BOL"`, `"special"`, `"pallet"`, `"container"`, `"chassis"`
- R-P5-04 [frontend]: `BookingPortal.tsx` maps 3 new fields from extraction: `data.freightType` to `equipmentType`, `data.dropoffDate`, and `data.specialInstructions`

### Verification Command

```bash
npx vitest run --reporter=verbose src/__tests__/components/BookingPortal.extraction-mapping.test.tsx && npx vitest run --reporter=verbose --config server/vitest.config.ts server/__tests__/services/gemini-schema.test.ts
```

---

## Phase 6 — Tag for Action Event Trigger

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `components/LoadDetailView.tsx` | After `saveLoad()` in `handleTagForAction`, send `POST /api/dispatch-events` with `event_type: "ACTION_TAGGED"` or `"ACTION_UNTAGGED"`, `load_id`, `actor_id` from `currentUser` | `src/__tests__/components/LoadDetailView.tag-event.test.tsx` | unit |
| ADD | `src/__tests__/components/LoadDetailView.tag-event.test.tsx` | Verify `POST /api/dispatch-events` called after `saveLoad` with `"ACTION_TAGGED"` / `"ACTION_UNTAGGED"` | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `src/__tests__/components/LoadDetailView.tag-event.test.tsx` | Test file | Self-verifying |

### Interface Contracts

N/A -- Uses existing `POST /api/dispatch-events` endpoint with `CreateDispatchEventInput` shape. No new server changes needed.

### Data Flow

```
handleTagForAction → saveLoad({...load, isActionRequired: newFlagged})
  → Success → POST /api/dispatch-events {
      id: uuidv4(),
      load_id: load.id,
      dispatcher_id: currentUser.id,
      actor_id: currentUser.id,
      event_type: newFlagged ? "ACTION_TAGGED" : "ACTION_UNTAGGED",
      message: newFlagged ? "Load tagged for action" : "Action tag removed"
    }
  → Event POST failure → log warning, do NOT show error toast (tag itself succeeded)
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Tag triggers POST /api/dispatch-events with ACTION_TAGGED | unit | Mock | Network mock for fetch and saveLoad | `src/__tests__/components/LoadDetailView.tag-event.test.tsx` |
| Untag triggers POST with ACTION_UNTAGGED | unit | Mock | Network mock for fetch and saveLoad | `src/__tests__/components/LoadDetailView.tag-event.test.tsx` |
| Event POST failure does not surface error toast | unit | Mock | Error path with mock fetch rejection | `src/__tests__/components/LoadDetailView.tag-event.test.tsx` |

**Assertion Blueprints**:
- `expect(fetch).toHaveBeenCalledWith("/api/dispatch-events", expect.objectContaining({ body: expect.stringContaining("ACTION_TAGGED") }))`
- `expect(screen.queryByText("Failed")).toBeNull()` (event failure silent)

### Done When

- R-P6-01 [frontend]: Tagging a load sends `POST /api/dispatch-events` with `event_type: "ACTION_TAGGED"` and `load_id` matching the current load
- R-P6-02 [frontend]: Removing a tag sends `POST /api/dispatch-events` with `event_type: "ACTION_UNTAGGED"` and `load_id` matching the current load
- R-P6-03 [frontend]: Failure to POST the dispatch event (status >= 400) does not render an error toast -- `screen.queryByText("Failed")` returns `null`

### Verification Command

```bash
npx vitest run --reporter=verbose src/__tests__/components/LoadDetailView.tag-event.test.tsx
```

---

## Phase 7 — Automated Email Notifications (BOL/Detention/Discrepancy)

**Phase Type**: `integration`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `server/services/detentionPipeline.ts` | After `DETENTION_FLAGGED` event insert (line 197), call `deliverNotification({ channel: "email", subject: "Detention..." })` with broker contact | `server/__tests__/services/detentionPipeline.notification.test.ts` | unit |
| ADD | `server/__tests__/services/detentionPipeline.notification.test.ts` | Verify `deliverNotification` called with `channel: "email"` and `subject` containing `"Detention"` | N/A | N/A |
| MODIFY | `server/services/discrepancyPipeline.ts` | After `DISCREPANCY_FLAGGED` event insert (line 83), call `deliverNotification({ channel: "email", subject: "Discrepancy..." })` with broker contact | `server/__tests__/services/discrepancyPipeline.notification.test.ts` | unit |
| ADD | `server/__tests__/services/discrepancyPipeline.notification.test.ts` | Verify `deliverNotification` called with `channel: "email"` and `subject` containing `"Discrepancy"` | N/A | N/A |
| MODIFY | `server/routes/loads.ts` | In `POST /api/loads/:id/bol-scan` handler, after scan completes, call `deliverNotification({ channel: "email", subject: "BOL..." })` | `server/__tests__/routes/loads.bol-email.test.ts` | unit |
| ADD | `server/__tests__/routes/loads.bol-email.test.ts` | Verify `deliverNotification` called with `channel: "email"` after BOL scan | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/__tests__/services/detentionPipeline.notification.test.ts` | Test file | Self-verifying |
| `server/__tests__/services/discrepancyPipeline.notification.test.ts` | Test file | Self-verifying |
| `server/__tests__/routes/loads.bol-email.test.ts` | Test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `deliverNotification` (existing) | `(options: DeliverNotificationOptions) => Promise<DeliverNotificationResult>` | `{ channel: "email", recipients: [{email}], message, subject }` | `{ status: "DELIVERED" \| "FAILED" }` | Returns FAILED with sync_error on SMTP issues | detentionPipeline, discrepancyPipeline, loads route | sendEmail |

### Data Flow

```
detentionPipeline: DETENTION_FLAGGED event inserted
  → deliverNotification({ channel: "email", recipients: [{ email: broker.email }], subject: "Detention Alert: Load #{loadNumber}", message: detention details })
  → SMTP configured: email sent → log success
  → SMTP not configured: log warning, return gracefully (detention pipeline continues unaffected)

discrepancyPipeline: DISCREPANCY_FLAGGED event inserted
  → deliverNotification({ channel: "email", recipients: [{ email: broker.email }], subject: "Weight Discrepancy: Load #{loadNumber}", message: discrepancy details })
  → Same SMTP fallback as above

loads.ts bol-scan: scan completes successfully
  → deliverNotification({ channel: "email", recipients: [{ email: broker.email }], subject: "BOL Scanned: Load #{loadNumber}", message: scan summary })
  → Same SMTP fallback
  → Error in notification does NOT fail the bol-scan response (fire-and-forget)
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Detention notification triggered on billable detention | unit | Mock | DB queries and deliverNotification mocked | `server/__tests__/services/detentionPipeline.notification.test.ts` |
| Discrepancy notification triggered on flag | unit | Mock | DB queries and deliverNotification mocked | `server/__tests__/services/discrepancyPipeline.notification.test.ts` |
| BOL scan sends email notification | unit | Mock | DB, gemini, and deliverNotification mocked | `server/__tests__/routes/loads.bol-email.test.ts` |
| Notification failure does not break pipeline | unit | Mock | deliverNotification rejection mocked | All three test files |

**Assertion Blueprints**:
- `expect(deliverNotification).toHaveBeenCalledWith(expect.objectContaining({ channel: "email", subject: expect.stringContaining("Detention") }))`
- `expect(deliverNotification).toHaveBeenCalledWith(expect.objectContaining({ channel: "email", subject: expect.stringContaining("Discrepancy") }))`
- Pipeline still returns valid result after notification failure

### Done When

- R-P7-01 [backend]: After a billable `DETENTION_FLAGGED` event is inserted, `deliverNotification` is called with `channel: "email"` and `subject` containing `"Detention"`
- R-P7-02 [backend]: After a `DISCREPANCY_FLAGGED` event is inserted, `deliverNotification` is called with `channel: "email"` and `subject` containing `"Discrepancy"`
- R-P7-03 [backend]: After a successful BOL scan at `POST /api/loads/:id/bol-scan`, `deliverNotification` is called with `channel: "email"` and `subject` containing `"BOL"`
- R-P7-04 [backend]: If `deliverNotification` rejects (throws), the parent pipeline still returns a valid result (fire-and-forget pattern)

### Verification Command

```bash
npx vitest run --reporter=verbose --config server/vitest.config.ts server/__tests__/services/detentionPipeline.notification.test.ts server/__tests__/services/discrepancyPipeline.notification.test.ts server/__tests__/routes/loads.bol-email.test.ts
```

---

## Phase 8 — Quote Margin Settings (Migration + Backend)

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/migrations/055_quote_margin_columns.sql` | `ALTER TABLE quotes ADD COLUMN` for `margin` DECIMAL(5,2), `discount` DECIMAL(5,2), `commission` DECIMAL(5,2), `estimated_driver_pay` DECIMAL(10,2), `company_cost_factor` DECIMAL(5,2) DEFAULT 50.00 | `server/__tests__/migrations/055_quote_margin_columns.test.ts` | unit |
| ADD | `server/__tests__/migrations/055_quote_margin_columns.test.ts` | Verify migration SQL contains `margin`, `discount`, `commission`, `estimated_driver_pay`, `company_cost_factor` | N/A | N/A |
| MODIFY | `server/schemas/quote.ts` | Add `margin`, `discount`, `commission`, `estimated_driver_pay`, `company_cost_factor` to `createQuoteSchema` and `updateQuoteSchema` | `server/__tests__/schemas/quote.margin.test.ts` | unit |
| ADD | `server/__tests__/schemas/quote.margin.test.ts` | Validate `createQuoteSchema.parse({ margin: 15.5 })` succeeds and `parse({ margin: "invalid" })` throws | N/A | N/A |
| MODIFY | `server/repositories/quote.repository.ts` | Add `"margin"`, `"discount"`, `"commission"`, `"estimated_driver_pay"`, `"company_cost_factor"` to `QUOTE_UPDATABLE_COLUMNS`. Update `create()` INSERT | `server/__tests__/repositories/quote.margin.test.ts` | unit |
| ADD | `server/__tests__/repositories/quote.margin.test.ts` | Verify `QUOTE_UPDATABLE_COLUMNS` includes 5 new strings | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/migrations/055_quote_margin_columns.sql` | Migration SQL, verified by migration test | `server/__tests__/migrations/055_quote_margin_columns.test.ts` |
| `server/__tests__/migrations/055_quote_margin_columns.test.ts` | Test file | Self-verifying |
| `server/__tests__/schemas/quote.margin.test.ts` | Test file | Self-verifying |
| `server/__tests__/repositories/quote.margin.test.ts` | Test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `createQuoteSchema` (updated) | Zod schema | `{ ...existing, margin?, discount?, commission?, estimated_driver_pay?, company_cost_factor? }` | Validated quote object | Zod validation error on invalid types | Quote route handlers | None |
| `QUOTE_UPDATABLE_COLUMNS` (updated) | `readonly string[]` | N/A | Array includes new 5 column names | N/A | `quoteRepository.update()` via `buildSafeUpdate()` | None |

### Data Flow

```
Quote create/update request
  → Zod schema validation (now includes margin fields)
  → quoteRepository.create/update
    → INSERT/UPDATE now includes margin, discount, commission, estimated_driver_pay, company_cost_factor
  → Database: quotes table has new columns with defaults
  Error: Invalid margin type → Zod returns 400 validation error
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Migration SQL adds 5 columns | unit | Real | Static SQL verification via parse or grep | `server/__tests__/migrations/055_quote_margin_columns.test.ts` |
| Zod schema validates margin fields | unit | Real | Pure function Zod parse validation | `server/__tests__/schemas/quote.margin.test.ts` |
| Zod schema rejects invalid margin types | unit | Real | Zod parse error path | `server/__tests__/schemas/quote.margin.test.ts` |
| QUOTE_UPDATABLE_COLUMNS includes new fields | unit | Real | Static data array inspection | `server/__tests__/repositories/quote.margin.test.ts` |

**Assertion Blueprints**:
- `expect(migrationSql).toContain("margin DECIMAL")`
- `expect(createQuoteSchema.parse({ margin: 15.5 })).toHaveProperty("margin", 15.5)`
- `expect(QUOTE_UPDATABLE_COLUMNS).toContain("margin")`
- `expect(() => createQuoteSchema.parse({ margin: "invalid" })).toThrow()`

### Done When

- R-P8-01 [backend]: Migration `055_quote_margin_columns.sql` adds 5 columns: `margin`, `discount`, `commission`, `estimated_driver_pay`, `company_cost_factor` to `quotes` table
- R-P8-02 [backend]: `company_cost_factor` has `DEFAULT 50.00` in migration `055`
- R-P8-03 [backend]: `createQuoteSchema` and `updateQuoteSchema` accept 5 new numeric fields: `margin`, `discount`, `commission`, `estimated_driver_pay`, `company_cost_factor`
- R-P8-04 [backend]: `QUOTE_UPDATABLE_COLUMNS` array includes all 5 strings: `"margin"`, `"discount"`, `"commission"`, `"estimated_driver_pay"`, `"company_cost_factor"`
- R-P8-05 [backend]: `quoteRepository.create()` INSERT SQL includes all 5 new column names
- R-P8-06 [backend]: `createQuoteSchema.parse({ margin: "invalid" })` rejects with a Zod validation error

### Verification Command

```bash
npx vitest run --reporter=verbose --config server/vitest.config.ts server/__tests__/migrations/055_quote_margin_columns.test.ts server/__tests__/schemas/quote.margin.test.ts server/__tests__/repositories/quote.margin.test.ts
```

---

## Phase 9 — Digital Agreement from Rate Confirmation

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/migrations/056_digital_agreements.sql` | `CREATE TABLE digital_agreements` with `id`, `company_id`, `load_id`, `rate_con_data` JSON, `status` ENUM(`DRAFT`,`SENT`,`SIGNED`,`VOIDED`), `signature_data` JSON, `signed_at`, `created_at`, `updated_at` | `server/__tests__/migrations/056_digital_agreements.test.ts` | unit |
| ADD | `server/__tests__/migrations/056_digital_agreements.test.ts` | Verify migration SQL contains `digital_agreements` and all column names | N/A | N/A |
| ADD | `server/routes/agreements.ts` | `POST /api/agreements` (201), `GET /api/agreements/:id` (200/404), `PATCH /api/agreements/:id/sign` (200/400/409) | `server/__tests__/routes/agreements.test.ts` | unit |
| ADD | `server/__tests__/routes/agreements.test.ts` | Test `POST /api/agreements` returns 201, `GET` returns 200/404, `PATCH .../sign` returns 200/400/409 | N/A | N/A |
| ADD | `server/schemas/agreement.ts` | `createAgreementSchema` and `signAgreementSchema` Zod schemas | N/A — validated via route tests | N/A |
| MODIFY | `server/index.ts` | Register `agreementsRouter` from `./routes/agreements` | N/A — covered by route tests | N/A |
| MODIFY | `components/LoadDetailView.tsx` | Add `"Generate Agreement"` button that sends `POST /api/agreements` with `{ load_id, rate_con_data }` | `src/__tests__/components/LoadDetailView.agreement-button.test.tsx` | unit |
| ADD | `src/__tests__/components/LoadDetailView.agreement-button.test.tsx` | Test `"Generate Agreement"` button renders and triggers `POST /api/agreements` | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/migrations/056_digital_agreements.sql` | Migration SQL | Migration test |
| `server/schemas/agreement.ts` | Zod schema | Validated via route tests |
| `server/index.ts` | Router registration (1 line) | Route tests exercise the endpoint |
| `server/__tests__/migrations/056_digital_agreements.test.ts` | Test file | Self-verifying |
| `server/__tests__/routes/agreements.test.ts` | Test file | Self-verifying |
| `src/__tests__/components/LoadDetailView.agreement-button.test.tsx` | Test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `POST /api/agreements` | Express route | `{ load_id, rate_con_data: { carrierRate, broker, pickup, dropoff, ... } }` | `{ id, status: "DRAFT", created_at }` | 400 (validation), 404 (load not found), 500 (DB) | LoadDetailView | pool.execute INSERT |
| `GET /api/agreements/:id` | Express route | Route param `id` | Agreement record with all fields | 404 (not found) | LoadDetailView | pool.query SELECT |
| `PATCH /api/agreements/:id/sign` | Express route | `{ signature_data: { dataUrl, signedBy, signedAt } }` | `{ id, status: "SIGNED", signed_at }` | 400 (missing signature), 404 (not found), 409 (already signed) | LoadDetailView | pool.execute UPDATE |

### Data Flow

```
LoadDetailView → "Generate Agreement" click → POST /api/agreements { load_id, rate_con_data }
  → Server validates, creates agreement with status DRAFT
  → Returns agreement ID
  → Frontend can render agreement details + signature pad
  → PATCH /api/agreements/:id/sign { signature_data }
    → Server validates agreement exists + not already signed
    → Updates status to SIGNED, stores signature_data JSON
    → Returns updated agreement
  Error: load not found → 404
  Error: already signed → 409 "Agreement already signed"
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| POST /api/agreements creates agreement | unit | Mock | DB pool mock for isolation | `server/__tests__/routes/agreements.test.ts` |
| GET /api/agreements/:id returns agreement | unit | Mock | DB pool mock | `server/__tests__/routes/agreements.test.ts` |
| PATCH sign validates and updates | unit | Mock | DB pool mock | `server/__tests__/routes/agreements.test.ts` |
| PATCH sign rejects already-signed | unit | Mock | DB pool mock error path | `server/__tests__/routes/agreements.test.ts` |
| LoadDetailView Generate Agreement button | unit | Mock | UI render and fetch network mock | `src/__tests__/components/LoadDetailView.agreement-button.test.tsx` |

**Assertion Blueprints**:
- `expect(res.status).toBe(201)` (create)
- `expect(res.body).toHaveProperty("status", "DRAFT")`
- `expect(res.body).toHaveProperty("status", "SIGNED")` (after sign)
- `expect(res.status).toBe(409)` (already signed)

### Done When

- R-P9-01 [backend]: Migration `056_digital_agreements.sql` creates `digital_agreements` table with 9 columns: `id`, `company_id`, `load_id`, `rate_con_data` JSON, `status` ENUM, `signature_data` JSON, `signed_at`, `created_at`, `updated_at`
- R-P9-02 [backend]: `POST /api/agreements` creates a `DRAFT` agreement and returns status 201 with `{ id, status: "DRAFT" }`
- R-P9-03 [backend]: `GET /api/agreements/:id` returns the full agreement record with status 200 or returns status 404
- R-P9-04 [backend]: `PATCH /api/agreements/:id/sign` updates `status` to `"SIGNED"` and stores `signature_data` JSON, returning status 200
- R-P9-05 [backend]: `PATCH /api/agreements/:id/sign` returns status 409 when the agreement `status` is already `"SIGNED"`
- R-P9-06 [frontend]: `LoadDetailView.tsx` renders a `"Generate Agreement"` button that sends `POST /api/agreements` on click
- R-P9-07 [backend]: `POST /api/agreements` rejects with status 400 when `load_id` is missing from the request body
- R-P9-08 [backend]: `PATCH /api/agreements/:id/sign` rejects with status 400 when `signature_data` is missing from the request body

### Verification Command

```bash
npx vitest run --reporter=verbose --config server/vitest.config.ts server/__tests__/migrations/056_digital_agreements.test.ts server/__tests__/routes/agreements.test.ts && npx vitest run --reporter=verbose src/__tests__/components/LoadDetailView.agreement-button.test.tsx
```

---

## Phase 10 — Financial Quarters & Objectives (Migration + Analytics Enhancement)

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/migrations/057_financial_objectives.sql` | `CREATE TABLE financial_objectives` with `id`, `company_id`, `quarter` VARCHAR(7), `revenue_target` DECIMAL, `expense_budget` DECIMAL, `profit_target` DECIMAL, `notes` TEXT, `created_at`, `updated_at` | `server/__tests__/migrations/057_financial_objectives.test.ts` | unit |
| ADD | `server/__tests__/migrations/057_financial_objectives.test.ts` | Verify migration SQL contains `financial_objectives` and column names | N/A | N/A |
| ADD | `server/routes/financial-objectives.ts` | `GET /api/financial-objectives?quarter=X` (200/400), `POST /api/financial-objectives` (201/400), `PATCH /api/financial-objectives/:id` (200/404) | `server/__tests__/routes/financial-objectives.test.ts` | unit |
| ADD | `server/__tests__/routes/financial-objectives.test.ts` | Test GET with `quarter=2026-Q2`, POST creates 201, invalid quarter returns 400 | N/A | N/A |
| MODIFY | `server/index.ts` | Register `financialObjectivesRouter` from `./routes/financial-objectives` | N/A — covered by route tests | N/A |
| MODIFY | `components/AnalyticsDashboard.tsx` | Add `quarter` selector (`Q1`-`Q4`). Add `"Actual vs Target"` progress bars from `GET /api/financial-objectives`. Filter lane analytics by quarter dates | `src/__tests__/components/AnalyticsDashboard.quarterly.test.tsx` | unit |
| ADD | `src/__tests__/components/AnalyticsDashboard.quarterly.test.tsx` | Verify `data-testid="quarter-selector"` renders and `"Actual vs Target"` displays | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/migrations/057_financial_objectives.sql` | Migration SQL | Migration test |
| `server/index.ts` | Router registration (1 line) | Route tests |
| `server/__tests__/migrations/057_financial_objectives.test.ts` | Test file | Self-verifying |
| `server/__tests__/routes/financial-objectives.test.ts` | Test file | Self-verifying |
| `src/__tests__/components/AnalyticsDashboard.quarterly.test.tsx` | Test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `GET /api/financial-objectives` | Express route | `?quarter=2026-Q1&company_id=X` | `[{ id, quarter, revenue_target, expense_budget, profit_target }]` | 400 (invalid quarter format) | AnalyticsDashboard | pool.query |
| `POST /api/financial-objectives` | Express route | `{ quarter, revenue_target, expense_budget, profit_target, notes? }` | `{ id, ...created }` 201 | 400 (validation), 409 (duplicate quarter) | AnalyticsDashboard | pool.execute INSERT |
| `PATCH /api/financial-objectives/:id` | Express route | `{ revenue_target?, expense_budget?, profit_target?, notes? }` | Updated record | 404, 400 | AnalyticsDashboard | buildSafeUpdate |

### Data Flow

```
AnalyticsDashboard → quarter selector (Q1-Q4 of current year)
  → GET /api/financial-objectives?quarter=2026-Q2
  → Server returns targets for that quarter (or empty array)
  → UI renders "Actual vs Target" progress bars
  → Actual values computed from existing lane analytics filtered by quarter dates
  Error: No targets set → show "Set quarterly targets" CTA instead of progress bars
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| GET /api/financial-objectives returns data | unit | Mock | DB pool mock | `server/__tests__/routes/financial-objectives.test.ts` |
| POST creates objective | unit | Mock | DB pool mock | `server/__tests__/routes/financial-objectives.test.ts` |
| Quarter filter changes analytics display | unit | Mock | UI test with mock render and load data | `src/__tests__/components/AnalyticsDashboard.quarterly.test.tsx` |
| Actual vs Target rendering | unit | Mock | UI test with mock objectives data | `src/__tests__/components/AnalyticsDashboard.quarterly.test.tsx` |

**Assertion Blueprints**:
- `expect(res.status).toBe(200)` and `expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ quarter: "2026-Q2" })]))`
- `expect(screen.getByTestId("quarter-selector")).toBeInTheDocument()`
- `expect(screen.getByTestId("actual-vs-target")).toHaveTextContent("Revenue")`

### Done When

- R-P10-01 [backend]: Migration `057_financial_objectives.sql` creates `financial_objectives` table with columns `id`, `company_id`, `quarter` (VARCHAR(7)), `revenue_target`, `expense_budget`, `profit_target`, `notes`, `created_at`, `updated_at`
- R-P10-02 [backend]: `GET /api/financial-objectives?quarter=2026-Q2` returns status 200 with array of objectives filtered by `quarter` parameter
- R-P10-03 [backend]: `POST /api/financial-objectives` creates a new objective and returns status 201
- R-P10-04 [frontend]: `AnalyticsDashboard.tsx` renders a quarter selector with 4 options (`Q1`-`Q4`) that filters displayed lane data
- R-P10-05 [frontend]: `AnalyticsDashboard.tsx` displays `"Actual vs Target"` progress bars when >= 1 financial objective exists for the selected quarter
- R-P10-06 [frontend]: `AnalyticsDashboard.tsx` shows a `"Set quarterly targets"` prompt when 0 objectives exist for the selected quarter
- R-P10-07 [backend]: `GET /api/financial-objectives?quarter=invalid` rejects with status 400 when the `quarter` parameter fails `YYYY-QN` format validation

### Verification Command

```bash
npx vitest run --reporter=verbose --config server/vitest.config.ts server/__tests__/migrations/057_financial_objectives.test.ts server/__tests__/routes/financial-objectives.test.ts && npx vitest run --reporter=verbose src/__tests__/components/AnalyticsDashboard.quarterly.test.tsx
```

---

## Phase 11 — Market Trends Enhancement

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/routes/analytics.ts` | `GET /api/analytics/lane-trends?months=6` endpoint: aggregates loads by lane + month, returns `trend` (`"up"` / `"down"` / `"flat"`), `avgRate`, `volume` | `server/__tests__/routes/analytics.lane-trends.test.ts` | unit |
| ADD | `server/__tests__/routes/analytics.lane-trends.test.ts` | Test lane trends aggregation and `trend` direction calculation (> 5% = `"up"`, < -5% = `"down"`) | N/A | N/A |
| MODIFY | `server/index.ts` | Register `analyticsRouter` from `./routes/analytics` | N/A — covered by route tests | N/A |
| MODIFY | `components/Intelligence.tsx` | Add `TrendingUp` (green) / `TrendingDown` (red) trend indicators per lane. Fetch `GET /api/analytics/lane-trends` on mount | `src/__tests__/components/Intelligence.market-trends.test.tsx` | unit |
| ADD | `src/__tests__/components/Intelligence.market-trends.test.tsx` | Verify `data-testid="trend-indicator-up"` renders for upward trend lanes | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/index.ts` | Router registration (1 line) | Route tests |
| `server/__tests__/routes/analytics.lane-trends.test.ts` | Test file | Self-verifying |
| `src/__tests__/components/Intelligence.market-trends.test.tsx` | Test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `GET /api/analytics/lane-trends` | Express route | `?company_id=X&months=6` | `[{ lane, month, avgRate, volume, trend: "up"\|"down"\|"flat", rpmAvg }]` | 400 (invalid params) | Intelligence.tsx | pool.query aggregate |

### Data Flow

```
Intelligence.tsx → useEffect fetch /api/analytics/lane-trends?months=6
  → Server aggregates loads by pickup-dropoff lane + month
  → Computes trend direction: compare last month avg rate vs previous month
    → rate increase > 5% → "up", decrease > 5% → "down", else → "flat"
  → Returns lane trend array
  → UI renders trend indicators: TrendingUp (green), TrendingDown (red), Minus (gray)
  → Lane mini-chart: small sparkline of monthly rates per lane
  Error: No loads for lane → omit from results
  Error: Fetch fails → show "Unable to load trends" fallback
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Lane trends endpoint aggregates correctly | unit | Mock | DB pool mock | `server/__tests__/routes/analytics.lane-trends.test.ts` |
| Trend direction calculation | unit | Mock | DB results mock for business logic test | `server/__tests__/routes/analytics.lane-trends.test.ts` |
| Trend indicators render | unit | Mock | UI test with mock trends data | `src/__tests__/components/Intelligence.market-trends.test.tsx` |

**Assertion Blueprints**:
- `expect(res.body[0]).toHaveProperty("trend", "up")`
- `expect(res.body[0]).toHaveProperty("lane")`
- `expect(screen.getByTestId("trend-indicator-up")).toBeInTheDocument()`

### Done When

- R-P11-01 [backend]: `GET /api/analytics/lane-trends?months=6` returns status 200 with array of objects containing `lane`, `month`, `avgRate`, `volume`, `trend` (`"up"` / `"down"` / `"flat"`)
- R-P11-02 [backend]: Trend `"up"` when current month avg rate exceeds previous month by > 5%, `"down"` when < -5%, `"flat"` otherwise
- R-P11-03 [frontend]: `Intelligence.tsx` renders >= 1 `TrendingUp` or `TrendingDown` icon elements matching `data-testid="trend-indicator-up"` or `"trend-indicator-down"` for each lane
- R-P11-04 [frontend]: `Intelligence.tsx` fetches from `GET /api/analytics/lane-trends` and displays >= 1 lane row with `avgRate` and `trend` values

### Verification Command

```bash
npx vitest run --reporter=verbose --config server/vitest.config.ts server/__tests__/routes/analytics.lane-trends.test.ts && npx vitest run --reporter=verbose src/__tests__/components/Intelligence.market-trends.test.tsx
```

---

## Phase 12 — Integration Smoke & Cross-Cutting Verification

**Phase Type**: `e2e`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `src/__tests__/integration/ux-remediation.smoke.test.tsx` | Smoke test: render all 10 modified components, verify 0 console errors, `"SAFETY"` tab, `"Notify Partners"` button, `"Generate Agreement"` button, formatted dates | `src/__tests__/integration/ux-remediation.smoke.test.tsx` | integration |
| MODIFY | `components/LoadDetailView.tsx` | Final cleanup: ensure Phases 2/4/6/9 changes use consistent `text-[11px]` button sizing | N/A — covered by smoke test | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `src/__tests__/integration/ux-remediation.smoke.test.tsx` | Test file | Self-verifying |

### Interface Contracts

N/A -- Integration test phase, no new interfaces.

### Data Flow

```
Smoke test → renders each modified component with mock data
  → Verifies: date formatting, button text sizes, tab order, new buttons present
  → Asserts no console errors during render
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| All modified components render without errors | integration | Mock | Render smoke test with mock data and providers | `src/__tests__/integration/ux-remediation.smoke.test.tsx` |
| Date formatting applied in LoadList | integration | Mock | Verify rendered output with mock load data containing ISO dates | `src/__tests__/integration/ux-remediation.smoke.test.tsx` |
| New tabs and buttons present | integration | Mock | Presence verification with mock render | `src/__tests__/integration/ux-remediation.smoke.test.tsx` |

**Assertion Blueprints**:
- `expect(screen.getByText("SAFETY")).toBeInTheDocument()`
- `expect(screen.getByText("Notify Partners")).toBeInTheDocument()`
- `expect(screen.getByText("Generate Agreement")).toBeInTheDocument()`
- `expect(consoleErrors).toHaveLength(0)`

### Done When

- R-P12-01 [integration]: All 10 modified frontend components render with `consoleErrors.length === 0` in the smoke test
- R-P12-02 [integration]: `LoadList` renders formatted dates matching `/[A-Z][a-z]{2} \d{1,2}, \d{4}/` pattern (not raw ISO strings) in the smoke test
- R-P12-03 [integration]: `"SAFETY"` tab, `"Notify Partners"` button, and `"Generate Agreement"` button are all found via `screen.getByText()` in the smoke test renders

### Verification Command

```bash
npx vitest run --reporter=verbose src/__tests__/integration/ux-remediation.smoke.test.tsx && npx vitest run --reporter=verbose --config server/vitest.config.ts --exclude=server/__tests__/integration/** --exclude=server/__tests__/regression/** --exclude=server/__tests__/performance/**
```

---

### API Contracts

| Method | Endpoint | Request Schema | Response Schema | Status Codes | Phase |
|--------|----------|---------------|-----------------|--------------|-------|
| POST | `/api/notification-jobs` | `{ channel: "Multi", recipients: [{name, email?, phone?}], subject: string, message: string }` | `{ id, status: "PENDING" }` | 200, 400, 500 | P4 |
| POST | `/api/dispatch-events` | `{ id, load_id, dispatcher_id, actor_id, event_type: "ACTION_TAGGED"\|"ACTION_UNTAGGED", message? }` | `{ success: true }` | 200, 400, 500 | P6 (existing endpoint) |
| POST | `/api/agreements` | `{ load_id, rate_con_data: { carrierRate, broker, pickup, dropoff } }` | `{ id, status: "DRAFT", created_at }` | 201, 400, 500 | P9 |
| GET | `/api/agreements/:id` | Route param `id` | `{ id, company_id, load_id, rate_con_data, status, signature_data, signed_at, created_at }` | 200, 404 | P9 |
| PATCH | `/api/agreements/:id/sign` | `{ signature_data: { dataUrl, signedBy, signedAt } }` | `{ id, status: "SIGNED", signed_at }` | 200, 400, 404, 409 | P9 |
| GET | `/api/financial-objectives` | `?quarter=YYYY-QN&company_id=X` | `[{ id, quarter, revenue_target, expense_budget, profit_target }]` | 200, 400 | P10 |
| POST | `/api/financial-objectives` | `{ quarter, revenue_target, expense_budget, profit_target, notes? }` | `{ id, ...created }` | 201, 400, 409 | P10 |
| PATCH | `/api/financial-objectives/:id` | `{ revenue_target?, expense_budget?, profit_target?, notes? }` | Updated record | 200, 400, 404 | P10 |
| GET | `/api/analytics/lane-trends` | `?company_id=X&months=6` | `[{ lane, month, avgRate, volume, trend, rpmAvg }]` | 200, 400 | P11 |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Gemini schema change causes extraction regressions | Medium | High | Phase 5 keeps all existing fields, only adds new ones. Prompt change is additive. Test with schema validation |
| Quote margin migration on production DB | Low | Medium | Migration is ALTER TABLE ADD COLUMN with defaults -- non-destructive, no data loss |
| Notification emails sent accidentally in dev | Medium | Low | SMTP not configured in dev = graceful fallback (no email sent). Feature relies on env var gating |
| Large phase count (12) causes long sprint | High | Medium | Phases 1-4 are CSS/UI only (fast). Phases 8-10 are migrations (deterministic). Parallelization possible for independent phases |
| Pre-existing test failures on main branch | Medium | Medium | Run baseline test suite before starting. Document pre-existing failures |
| LoadDetailView becomes too complex | Medium | Low | Notify Partners modal is self-contained inline component. Agreement button is a simple action button |

## Dependencies

### Internal
- Phase 5 (AI extraction) is independent -- can run in any order
- Phase 7 (automated emails) depends on existing notification-delivery.service.ts (already implemented)
- Phase 8 (quote margins) is independent of all other phases
- Phase 9 (agreements) depends on Phase 8 only if agreements reference quote margins (they don't -- independent)
- Phase 10 (financial objectives) is independent
- Phase 11 (market trends) is independent
- Phase 12 (smoke test) depends on all other phases

### External
- Google Gemini API (Phase 5) -- already configured and working
- SMTP configuration (Phase 7) -- optional, graceful fallback when not configured
- No new external dependencies introduced

### Parallel Groups
- Group A (independent): Phases 1, 2, 3, 5, 8
- Group B (independent): Phases 4, 6, 7
- Group C (independent): Phases 9, 10, 11
- Group D (depends on all): Phase 12

## Rollback Plan

1. All migrations are additive (ADD COLUMN, CREATE TABLE) -- rollback is DROP COLUMN / DROP TABLE
2. Frontend changes are in separate components -- revert individual files via git
3. Gemini schema changes are backward-compatible -- old extractions still work, new fields are optional
4. Feature branch ensures main is never affected until PR merge
5. If sprint fails midway, partial work (UX fixes, extraction) still has value and can be merged independently

## Open Questions

1. **GitHub Issue Reference**: The workflow requires `require_issue_ref: true`. A GitHub issue should be created before running `/ralph`. Should the plan create one, or does one already exist?
2. **Branch base**: Plan targets `main` but current session is on `mobile/trucker-app`. `/ralph` should checkout `main` before creating the feature branch.
3. **QuoteDetailView**: The specification references `QuoteDetailView.tsx` but this file does not exist on disk. Quote detail appears to be rendered inline within `QuoteManager.tsx`. Phase 8 addresses the backend. Frontend margin UI is deferred unless the user confirms where margin settings should appear.
