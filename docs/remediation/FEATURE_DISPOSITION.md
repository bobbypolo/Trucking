# Feature Disposition List

**Created**: 2026-03-16
**Approver**: Operator

## Decision Summary

| Decision               | Count | Features                                                                              |
| ---------------------- | ----- | ------------------------------------------------------------------------------------- |
| IMPLEMENT NOW          | 5     | Equipment updates, file uploads, customer archive, password reset, endpoint hardening |
| REMOVE FROM PRODUCTION | 5     | QB Sync, IFTA filing, WebSocket tracking, driver certifications, load templates       |

## IMPLEMENT NOW

### 1. Equipment Maintenance Updates (STORY-025)

- **Current state**: GET endpoint exists, no PATCH for status/maintenance updates
- **Missing**: `PATCH /api/equipment/:id` with role check (admin, dispatcher, safety_manager)
- **Implementation**: Add update method to repository, add Zod schema, add route with requireAuth + requireTenant + requireRole

### 2. File/Photo Upload (STORY-026)

- **Current state**: FileVault UI component exists, no upload backend
- **Missing**: Multipart upload endpoint, Firebase Storage integration, signed download URLs
- **Implementation**: multer middleware, Firebase Storage service, document metadata in MySQL, progress indicator frontend

### 3. Customer Soft Delete/Archive (STORY-027)

- **Current state**: Archive button exists in UI, no backend endpoint
- **Missing**: `PATCH /api/clients/:id/archive` with `archived_at` column
- **Implementation**: Migration adds archived_at/archived_by columns, endpoint sets timestamp, default views filter archived

### 4. Password Reset Flow (STORY-028)

- **Current state**: No "Forgot Password?" link or flow
- **Missing**: Server-proxied reset endpoint using Firebase Admin SDK
- **Implementation**: `POST /api/auth/reset-password` (unauthenticated, rate-limited at 3/15min), always returns 200 (no enumeration), frontend InputDialog for email

### 5. Endpoint Hardening (STORY-029)

- **Current state**: IFTA pings array unbounded, AI payload limit 15MB
- **Missing**: Input bounds validation
- **Implementation**: Pings >10,000 returns 400, AI payload >5MB returns 413, MIME type validation on AI

## REMOVE FROM PRODUCTION

For each removed feature, ALL 8 checks must pass:

| Check                     | Requirement                      |
| ------------------------- | -------------------------------- |
| Nav entry                 | Hidden/removed                   |
| Route access (direct URL) | Guarded or redirects to 404      |
| Menu/button access        | Hidden                           |
| Stale badges/counts       | Removed                          |
| Help docs/tooltips        | Updated or removed               |
| API endpoint              | Returns 501 or removed           |
| Feature flag              | Not enabled in production        |
| Placeholder text          | No "coming soon" or fake success |

### 1. QuickBooks Sync (STORY-030)

- **Current location**: `AccountingPortal.tsx` — QB Sync section
- **Current API**: `POST /api/accounting/sync-qb` returns `{ message: "Sync queued", syncId }` (FAKE)
- **Removal**:
  - Hide QB Sync section entirely from AccountingPortal
  - Change endpoint to return `501 { error: "QuickBooks integration is not yet available." }`
  - Remove "Sync queued" text from codebase

### 2. IFTA Quarterly Filing (STORY-030)

- **Current location**: `IFTAManager.tsx` — filing submission form
- **Removal**:
  - Hide quarterly filing submission form (keep IFTA evidence review, that's real)
  - Remove all `alert()`, `confirm()`, `prompt()` calls in IFTA components
  - No fake "Posted to IFTA Payable" success messages

### 3. WebSocket Live Tracking (STORY-030)

- **Current state**: UI says "Live Asset Tracking" / "View Live Track" but uses polling
- **Removal**:
  - Relabel all "Live" / "Real-Time" tracking text to "Fleet Tracking" / "View Tracking"
  - Keep polling-based tracking functional
  - Remove any WebSocket connection attempts or references

### 4. Driver Certifications (STORY-030)

- **Current state**: UI elements for cert management, no backend
- **Removal**:
  - Hide certification management UI sections
  - No stale badges showing "0 certifications"

### 5. Load Templates (STORY-030)

- **Current state**: "Copy as template" or template selection UI, no backend
- **Removal**:
  - Hide template copy/create buttons
  - No "template saved" fake success messages
