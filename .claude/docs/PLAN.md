# Plan: Mobile Sprints C+D+E — Trip Workspace, Document Capture, Offline Queue

## Goal

Deliver three sprints of driver-facing mobile functionality in a single Ralph session: (C) Trip Workspace with real load data, status updates, and pull-to-refresh; (D) Document Capture with camera, preview, upload, OCR trigger, and results viewing; (E) Offline Queue with local file storage, upload retry, background sync, connectivity state, and offline indicators. All work is mobile-only under `apps/trucker/` on the `mobile/trucker-app` branch. No server changes needed — all endpoints already exist.

## System Context

### Files Read

| File | Key Findings |
|------|-------------|
| `apps/trucker/src/services/api.ts` | Generic REST client with `get/post/put/patch/delete`, Bearer token via `getIdToken()`, 401 auto-signout, network error handling. Base URL from `EXPO_PUBLIC_API_URL`. No multipart support yet. |
| `apps/trucker/src/app/(tabs)/loads.tsx` | Placeholder screen: static "My Loads" / "No loads assigned yet" text. No API calls. |
| `apps/trucker/src/app/(tabs)/index.tsx` | Placeholder Home screen. |
| `apps/trucker/src/app/(tabs)/profile.tsx` | Placeholder Profile screen. |
| `apps/trucker/src/app/(tabs)/_layout.tsx` | 3-tab layout: Home / Loads / Profile. Uses `expo-router` Tabs. |
| `apps/trucker/src/app/_layout.tsx` | Root layout: AuthProvider wrapper, auth redirect logic via `useSegments()`. |
| `apps/trucker/src/contexts/AuthContext.tsx` | Firebase Auth context: login, signup, logout, onAuthStateChanged listener, error mapping. Exports `AuthProvider` and `useAuth`. |
| `apps/trucker/src/config/firebase.ts` | Firebase init from `EXPO_PUBLIC_FIREBASE_*` env vars. Exports `auth`. |
| `apps/trucker/package.json` | Expo 55, React 18.3.1, RN 0.76.9, expo-router 5. No camera/file-system/task-manager deps yet. |
| `apps/trucker/tsconfig.json` | Strict mode, `@/*` path alias to `./src/*`. |
| `apps/trucker/app.json` | SDK 55, portrait only, iOS+Android. No camera permission entries yet. |
| `packages/shared/src/types.ts` | `LoadStatus` type (8 values), `LOAD_STATUS` const with legacy aliases. |
| `server/routes/loads.ts` | `GET /api/loads` (list), `GET /api/loads/:id` (detail implied), `PATCH /api/loads/:id` (partial update), `PATCH /api/loads/:id/status` (status transition with state machine + idempotency). |
| `server/routes/documents.ts` | `GET /api/documents` (list with filters), `POST /api/documents` (multipart upload, field `file` + `document_type` + optional `load_id`), `GET /api/documents/:id`, `PATCH /api/documents/:id`, `GET /api/documents/:id/download`, `POST /api/documents/:id/process-ocr`, `GET /api/documents/:id/ocr`. |
| `server/services/load-state-machine.ts` | 8-state enum, 8 valid transitions. Driver-relevant: dispatched->in_transit, in_transit->arrived, arrived->delivered. |
| `scripts/verify-mobile-auth.cjs` | CJS verification pattern: `fs.readFileSync` + regex, `check(id, desc, condition)` helper, exit(1) on failures. |

### Data Flow Diagram

```
Sprint C: Trip Workspace
  Driver opens Loads tab
    -> GET /api/loads (with auth token)
    -> Render FlatList of LoadCard components
    -> Tap card -> navigate to LoadDetail screen
    -> GET /api/loads/:id (fetch full detail)
    -> Driver taps status button
    -> PATCH /api/loads/:id/status { status: "in_transit" }
    -> Optimistic UI update + error rollback
    -> Pull-to-refresh -> re-fetch GET /api/loads

Sprint D: Document Capture
  Driver on LoadDetail taps "Capture Document"
    -> expo-camera launches CameraScreen
    -> Driver takes photo -> preview screen
    -> Accept: compress via expo-image-manipulator
    -> POST /api/documents (multipart: file + document_type + load_id)
    -> POST /api/documents/:id/process-ocr (trigger OCR)
    -> Poll GET /api/documents/:id/ocr (view results)
    -> GET /api/documents?load_id=X (document list per load)
    Error: camera permission denied -> show permission prompt
    Error: upload fails -> show retry button (Sprint E queues it)

Sprint E: Offline Queue
  Network goes offline (NetInfo detects)
    -> Offline banner shown on all screens
    -> Photo captured -> saved to expo-file-system local path
    -> Upload queued in AsyncStorage queue
    -> Network returns -> expo-task-manager background task fires
    -> Queue processes: read file, upload, delete local copy
    -> Retry with exponential backoff on failure
    -> Queue status UI shows pending/failed/completed counts
    Error: background task killed by OS -> resumes on next app open
    Error: file read fails -> mark item as failed in queue
```

### Existing Patterns

- **API client**: `api.get<T>()` / `api.post<T>()` etc. in `apps/trucker/src/services/api.ts`. Needs multipart extension for file upload.
- **Navigation**: expo-router file-based routing. Tabs under `(tabs)/`, auth under `(auth)/`. New screens go under `(tabs)/` or as stack routes.
- **Styling**: StyleSheet.create with inline styles. Blue primary (#2563eb), white background.
- **Auth**: `useAuth()` hook provides `user`, `isAuthenticated`. All API calls auto-attach Bearer token.
- **CJS verification**: `check(id, desc, condition)` pattern from Sprint B2. Read files, regex match, exit(1) on any failure.
- **Shared types**: `@loadpilot/shared` exports `LoadStatus`, `LOAD_STATUS`, used across frontend and server.

### Blast Radius Assessment

| Area | Impact | Risk |
|------|--------|------|
| `apps/trucker/src/` | PRIMARY — all new screens, services, hooks | Low (isolated from web app) |
| `apps/trucker/package.json` | ADD dependencies (expo-camera, expo-image-manipulator, expo-file-system, expo-task-manager, @react-native-community/netinfo) | Low (isolated package.json) |
| `apps/trucker/app.json` | ADD camera permission descriptions | Low |
| `scripts/` | ADD CJS verification scripts | None (additive) |
| `packages/shared/` | No changes | None |
| `server/` | No changes | None |
| Web frontend (`components/`, `services/`) | No changes | None |

---

## Phase 1: Load List Service + Load List Screen (Sprint C Foundation)

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/src/services/loads.ts` | Add `fetchLoads()`, `fetchLoadById()`, `updateLoadStatus()` calling `api.get`/`api.patch` | `scripts/verify-trip-workspace.cjs` | unit |
| ADD | `apps/trucker/src/types/load.ts` | Define `Load` interface with `id`, `status`, `origin_city`, `destination_city`, `pickup_date` fields | `scripts/verify-trip-workspace.cjs` | unit |
| ADD | `apps/trucker/src/components/LoadCard.tsx` | Add `LoadCard` component rendering load reference, origin, destination, `StatusBadge` | `scripts/verify-trip-workspace.cjs` | unit |
| MODIFY | `apps/trucker/src/app/(tabs)/loads.tsx` | Replace placeholder with `FlatList` of `LoadCard`, `ActivityIndicator`, error state, `onRefresh` | `scripts/verify-trip-workspace.cjs` | unit |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `fetchLoads()` | `() => Promise<Load[]>` | none | `Load[]` array (server returns raw array, not wrapped) | ApiError (network, 401, 500) | `loads.tsx` | `api.get('/loads')` |
| `fetchLoadById(id)` | `(id: string) => Promise<Load>` | load ID string | single `Load` filtered from list | ApiError (not-found if no match, network) | Phase 2 `LoadDetailScreen` | `fetchLoads()` then `.find(l => l.id === id)` (no GET /loads/:id endpoint exists) |
| `updateLoadStatus(id, status)` | `(id: string, status: LoadStatus) => Promise<Load>` | load ID, target status | updated `Load` | ApiError (422 invalid transition, network) | Phase 3 `StatusUpdateFlow` | `api.patch('/loads/${id}/status', { status })` |
| `LoadCard` | `(props: { load: Load; onPress: (id: string) => void }) => JSX.Element` | Load object + press handler | Rendered card | none (pure component) | `loads.tsx` FlatList | none |

### Data Flow

```
loads.tsx mount -> useEffect calls fetchLoads()
  -> api.get('/loads') -> server GET /api/loads
  -> success: setLoads(data), setLoading(false)
  -> error: setError(message), setLoading(false)
  -> 401: api client auto-signout, redirect to login
Pull-to-refresh: onRefresh -> setRefreshing(true) -> fetchLoads() -> setRefreshing(false)
Empty state: loads.length === 0 && !loading -> "No loads assigned" message
```

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|-------------------|
| loads.ts exports fetchLoads, fetchLoadById, updateLoadStatus | unit | Real | Verify function signatures exist via regex on source | `scripts/verify-trip-workspace.cjs` | `check('R-P1-01', '...', countMatches(content, /export.*function fetchLoads/) >= 1)` |
| Load type has required fields | unit | Real | Type definition must include id, status, origin, destination | `scripts/verify-trip-workspace.cjs` | `check('R-P1-02', '...', /id.*string/.test(content) && /status.*LoadStatus/.test(content))` |
| LoadCard component renders load data | unit | Real | Component must accept load prop and render origin/destination | `scripts/verify-trip-workspace.cjs` | `check('R-P1-03', '...', /load\.origin/.test(content) || /origin_city/.test(content))` |
| loads.tsx uses FlatList with LoadCard | unit | Real | Screen must import FlatList and LoadCard | `scripts/verify-trip-workspace.cjs` | `check('R-P1-04', '...', /FlatList/.test(content) && /LoadCard/.test(content))` |
| loads.tsx has pull-to-refresh | unit | Real | FlatList must have refreshing prop and onRefresh handler | `scripts/verify-trip-workspace.cjs` | `check('R-P1-05', '...', /refreshing/.test(content) && /onRefresh/.test(content))` |
| loads.tsx has loading state | unit | Real | Must show ActivityIndicator or loading indicator when loading | `scripts/verify-trip-workspace.cjs` | `check('R-P1-06', '...', /ActivityIndicator/.test(content) || /loading/.test(content))` |
| loads.tsx has error state | unit | Real | Must display error message when fetch fails | `scripts/verify-trip-workspace.cjs` | `check('R-P1-07', '...', /error/.test(content))` |

### Done When

- R-P1-01 [frontend]: `loads.ts` exports 3 functions: `fetchLoads()` calling `api.get("/loads")` returning the raw array, `fetchLoadById(id)` calling `fetchLoads()` then filtering by `id`, and `updateLoadStatus(id, status)` calling `api.patch`
- R-P1-02 [frontend]: `load.ts` defines a `Load` interface with `id`, `status`, `pickup_date`, and a `legs` array of `LoadLeg` objects (each with `type`, `city`, `state`, `facility_name`, `date`, `sequence_order`). Also exports `getOrigin(load)` and `getDestination(load)` helpers that extract the first Pickup and last Dropoff leg's city+state
- R-P1-03 [frontend]: `LoadCard.tsx` renders a `Pressable` card showing origin (from `getOrigin(load)`), destination (from `getDestination(load)`), and a color-coded status badge
- R-P1-04 [frontend]: `loads.tsx` renders 1 `FlatList` of `LoadCard` components with `renderItem` fed by `fetchLoads()` response data array
- R-P1-05 [frontend]: `loads.tsx` passes 2 refresh props (`refreshing={refreshing}` and `onRefresh`) to `FlatList` that re-call `fetchLoads()`
- R-P1-06 [frontend]: `loads.tsx` renders `<ActivityIndicator />` when `loading` state is `true` during initial fetch
- R-P1-07 [frontend]: `loads.tsx` renders an error `<Text>` and a "Retry" `<Pressable>` when `fetchLoads()` returns an error

### Verification Command

```bash
node scripts/verify-trip-workspace.cjs
```

---

## Phase 2: Load Detail Screen + Navigation

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MOVE | `apps/trucker/src/app/(tabs)/loads/index.tsx` | Move ALL content from Phase 1's `(tabs)/loads.tsx` into `(tabs)/loads/index.tsx` (delete `loads.tsx` after move). The FlatList, fetchLoads, LoadCard rendering, and pull-to-refresh from Phase 1 must be preserved exactly. | `scripts/verify-load-detail.cjs` | unit |
| ADD | `apps/trucker/src/app/(tabs)/loads/[id].tsx` | Add `LoadDetailScreen` calling `fetchLoadById` to render origin, destination, dates, `StatusBadge` | `scripts/verify-load-detail.cjs` | unit |
| ADD | `apps/trucker/src/app/(tabs)/loads/_layout.tsx` | Add `Stack` navigator layout with `index` and `[id]` screen routes | `scripts/verify-load-detail.cjs` | unit |
| MODIFY | `apps/trucker/src/app/(tabs)/_layout.tsx` | Update Loads `Tabs.Screen` to point to nested `loads/` `Stack` layout | `scripts/verify-load-detail.cjs` | unit |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `LoadDetailScreen` | `() => JSX.Element` (route component) | `id` from route params via `useLocalSearchParams()` | Rendered detail view | ApiError display on fetch failure | loads list navigation | `fetchLoadById(id)` from Phase 1 |
| `loads/_layout.tsx` | Stack navigator layout | none | Stack with `index` and `[id]` routes | none | tabs layout | none |

### Data Flow

```
LoadCard press -> router.push(`/loads/${load.id}`)
  -> loads/[id].tsx mounts -> useLocalSearchParams() gets id
  -> fetchLoadById(id) -> api.get(`/loads/${id}`)
  -> success: render detail sections (origin, destination, stops, dates, status)
  -> error: show error with back button
  -> 404: "Load not found" message
Back button -> router.back() -> returns to load list
```

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|-------------------|
| [id].tsx calls fetchLoadById | unit | Real | Detail screen must fetch by ID | `scripts/verify-load-detail.cjs` | `check('R-P2-01', ..., countMatches(content, /fetchLoadById/) >= 1)` |
| [id].tsx renders origin and destination | unit | Real | Must display both addresses | `scripts/verify-load-detail.cjs` | `check('R-P2-02', ..., /origin/.test(content) && /destination/.test(content))` |
| [id].tsx renders load status | unit | Real | Status badge visible on detail | `scripts/verify-load-detail.cjs` | `check('R-P2-03', ..., /status/.test(content) && /LoadStatus/.test(content))` |
| _layout.tsx defines Stack with index and [id] | unit | Real | Stack navigator must have both routes | `scripts/verify-load-detail.cjs` | `check('R-P2-04', ..., /Stack/.test(content) && /index/.test(content))` |
| LoadCard navigates to detail on press | unit | Real | LoadCard must use router.push to loads/id | `scripts/verify-load-detail.cjs` | `check('R-P2-05', ..., /router\.push.*loads/.test(content))` |

### Done When

- R-P2-01 [frontend]: `loads/[id].tsx` calls `fetchLoadById(id)` on mount via `useEffect` and renders 1 `Load` object (fetched by filtering the full loads list since no GET /loads/:id endpoint exists)
- R-P2-02 [frontend]: `loads/[id].tsx` renders 4 labeled sections: origin (via `getOrigin(load)` from first Pickup leg), destination (via `getDestination(load)` from last Dropoff leg), `pickup_date`, and delivery date (from last Dropoff leg's `date` field)
- R-P2-03 [frontend]: `loads/[id].tsx` renders 1 status badge component with the `load.status` value mapped to a distinct background color per status
- R-P2-04 [frontend]: `loads/_layout.tsx` defines a `Stack` navigator with 2 screens: `index` (list) and `[id]` (detail)
- R-P2-05 [frontend]: `LoadCard` calls `router.push("/loads/${load.id}")` on `Pressable` press to navigate to detail

### Verification Command

```bash
node scripts/verify-load-detail.cjs
```

---

## Phase 3: Status Update Flow

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/src/components/StatusUpdateButton.tsx` | Add `StatusUpdateButton` component accepting `currentStatus` and `onStatusChange` props | `scripts/verify-status-update.cjs` | unit |
| MODIFY | `apps/trucker/src/app/(tabs)/loads/[id].tsx` | Integrate `StatusUpdateButton` with `useLoadStatus` hook for optimistic status transition | `scripts/verify-status-update.cjs` | unit |
| ADD | `apps/trucker/src/hooks/useLoadStatus.ts` | Add `useLoadStatus` hook with `transitionTo()` calling `updateLoadStatus()`, optimistic rollback on error | `scripts/verify-status-update.cjs` | unit |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `StatusUpdateButton` | `(props: { loadId: string; currentStatus: LoadStatus; onStatusChange: (newStatus: LoadStatus) => void }) => JSX.Element` | load ID, current status, callback | Rendered button(s) for valid transitions | none (delegates errors to hook) | `loads/[id].tsx` | none (calls onStatusChange) |
| `useLoadStatus` | `(loadId: string, initialStatus: LoadStatus) => { status, updating, error, transitionTo }` | load ID, initial status | status state + transition function | ApiError (422 invalid, network) | `loads/[id].tsx` | `updateLoadStatus()` from Phase 1 |

### Data Flow

```
LoadDetail renders StatusUpdateButton with currentStatus
  -> StatusUpdateButton shows valid next states (e.g., "Start Trip", "Arrive", "Deliver")
  -> Driver taps button -> calls onStatusChange(nextStatus)
  -> useLoadStatus.transitionTo(nextStatus):
    -> Optimistic: set status locally
    -> PATCH /api/loads/:id/status { status: nextStatus }
    -> Success: status stays at new value, show success toast/feedback
    -> Error 422 (invalid transition): rollback to previous status, show error
    -> Network error: rollback, show retry prompt
```

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|-------------------|
| StatusUpdateButton renders transition buttons | unit | Real | Must show buttons based on current status | `scripts/verify-status-update.cjs` | `check('R-P3-01', ..., /StatusUpdateButton/.test(content) && countMatches(content, /onStatusChange/) >= 1)` |
| useLoadStatus hook exports transitionTo | unit | Real | Hook must provide transition function | `scripts/verify-status-update.cjs` | `check('R-P3-02', ..., /export.*useLoadStatus/.test(content) && /transitionTo/.test(content))` |
| useLoadStatus implements optimistic update | unit | Real | Must set status before API call and rollback on error | `scripts/verify-status-update.cjs` | `check('R-P3-03', ..., /setStatus/.test(content) && /catch|rollback|previous/.test(content))` |
| [id].tsx integrates StatusUpdateButton | unit | Real | Detail screen imports and renders the button | `scripts/verify-status-update.cjs` | `check('R-P3-04', ..., countMatches(detailContent, /StatusUpdateButton/) >= 2)` |
| StatusUpdateButton shows driver-relevant transitions only | unit | Real | Must filter to dispatched->in_transit, in_transit->arrived, arrived->delivered | `scripts/verify-status-update.cjs` | `check('R-P3-05', ..., /in_transit/.test(content) && /arrived/.test(content) && /delivered/.test(content))` |
| Error feedback displayed on failed transition | unit | Real | Must show error state to user | `scripts/verify-status-update.cjs` | `check('R-P3-06', ..., /error/.test(hookContent) && /Text.*error/.test(hookContent))` |

### Done When

- R-P3-01 [frontend]: `StatusUpdateButton` accepts 2 props (`currentStatus: LoadStatus`, `onStatusChange`) and renders 1+ `Pressable` buttons for valid next statuses
- R-P3-02 [frontend]: `useLoadStatus` hook exports 1 function `transitionTo(status)` that calls `updateLoadStatus(loadId, status)` from `loads.ts`
- R-P3-03 [frontend]: `useLoadStatus` sets status optimistically before the API call and reverts to `previousStatus` in the `catch` block on error
- R-P3-04 [frontend]: `loads/[id].tsx` renders 1 `StatusUpdateButton` with 2 props: `currentStatus={status}` and `onStatusChange={transitionTo}`
- R-P3-05 [frontend]: `StatusUpdateButton` filters to 3 driver transitions: "dispatched" to "in_transit", "in_transit" to "arrived", "arrived" to "delivered"
- R-P3-06 [frontend]: A failed transition renders an error `<Text>` showing the server's `message` field from the 422 response body
- R-P3-07 [frontend]: `useLoadStatus` rejects an invalid transition by rolling back optimistic state and displaying the "Invalid load transition" 422 error

### Verification Command

```bash
node scripts/verify-status-update.cjs
```

---

## Phase 4: Camera Capture + Image Preview (Sprint D Foundation)

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `apps/trucker/package.json` | Add `expo-camera` and `expo-image-manipulator` to `dependencies` | `scripts/verify-camera-capture.cjs` | unit |
| MODIFY | `apps/trucker/app.json` | Add `NSCameraUsageDescription` plugin entry and Android `CAMERA` permission | `scripts/verify-camera-capture.cjs` | unit |
| ADD | `apps/trucker/src/app/(camera)/_layout.tsx` | Add `Stack` navigator layout for camera flow with `camera`, `preview`, `upload`, and `ocr-result` screens | `scripts/verify-camera-capture.cjs` | unit |
| ADD | `apps/trucker/src/app/(camera)/camera.tsx` | Add `CameraScreen` with viewfinder using `CameraView`, capture via `takePictureAsync()` | `scripts/verify-camera-capture.cjs` | unit |
| ADD | `apps/trucker/src/app/(camera)/preview.tsx` | Add `PreviewScreen` with captured photo display, `Retake` and `Use Photo` buttons | `scripts/verify-camera-capture.cjs` | unit |
| ADD | `apps/trucker/src/services/imageService.ts` | Add `compressImage()` using `manipulateAsync` to `resize` and JPEG compress | `scripts/verify-camera-capture.cjs` | unit |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `(camera)/_layout.tsx` | Stack navigator layout | none | Stack with camera, preview, upload, ocr-result routes | none | LoadDetail "Capture" nav | none |
| `CameraScreen` | Route component at `(camera)/camera.tsx` | `loadId` from navigation params | Navigates to preview with photo URI | Camera permission denied -> show settings prompt | LoadDetail "Capture" button | expo-camera `takePictureAsync()` |
| `PreviewScreen` | Route component at `(camera)/preview.tsx` | `photoUri`, `loadId` from navigation params | Navigates to upload flow (Phase 5) or back to camera | none | CameraScreen after capture | `compressImage()` |
| `compressImage(uri)` | `(uri: string) => Promise<string>` | local file URI | compressed file URI | ImageManipulatorError | PreviewScreen | expo-image-manipulator |

### Data Flow

```
LoadDetail -> "Capture Document" button -> navigate to CameraScreen({ loadId })
  -> Request camera permission (expo-camera)
    -> Denied: show "Camera permission required" with link to settings
    -> Granted: show camera viewfinder
  -> Driver taps capture button -> camera.takePictureAsync({ quality: 1 })
    -> Photo saved to temp URI
  -> Navigate to PreviewScreen({ photoUri, loadId })
  -> Driver sees preview:
    -> "Retake" -> navigate back to CameraScreen
    -> "Use Photo" -> compressImage(photoUri) -> compressed URI
    -> Navigate to upload step (Phase 5)
  Error: takePictureAsync fails -> show "Capture failed, please try again"
```

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|-------------------|
| expo-camera in package.json | unit | Real | Dependency must be declared | `scripts/verify-camera-capture.cjs` | `check('R-P4-01', '...', pkgJson.dependencies['expo-camera'] !== undefined)` |
| app.json has camera permission | unit | Real | iOS Info.plist entry required | `scripts/verify-camera-capture.cjs` | `check('R-P4-02', '...', /NSCameraUsageDescription/.test(appJsonContent) || /usesPermissions.*CAMERA/.test(appJsonContent))` |
| CameraScreen uses expo-camera | unit | Real | Must import and render Camera component | `scripts/verify-camera-capture.cjs` | `check('R-P4-03', '...', /expo-camera/.test(content) && /takePictureAsync/.test(content))` |
| PreviewScreen shows retake/accept | unit | Real | Must have both action buttons | `scripts/verify-camera-capture.cjs` | `check('R-P4-04', '...', /[Rr]etake/.test(content) && /[Uu]se|[Aa]ccept/.test(content))` |
| imageService compresses images | unit | Real | Must call manipulateAsync with resize/compress | `scripts/verify-camera-capture.cjs` | `check('R-P4-05', '...', /manipulateAsync/.test(content) && /resize/.test(content))` |
| CameraScreen handles permission denial | unit | Real | Must check permission and show prompt | `scripts/verify-camera-capture.cjs` | `check('R-P4-06', '...', /permission/.test(content) && /denied|settings/.test(content))` |

### Done When

- R-P4-01 [frontend]: `package.json` declares 2 new dependencies: `"expo-camera"` and `"expo-image-manipulator"` in the `dependencies` object
- R-P4-02 [frontend]: `app.json` includes `"NSCameraUsageDescription"` string and Android `"CAMERA"` permission in the `plugins` or `permissions` section
- R-P4-03 [frontend]: `CameraScreen.tsx` imports `CameraView` from `expo-camera` and calls `takePictureAsync()` on a "Capture" `Pressable` press
- R-P4-04 [frontend]: `PreviewScreen.tsx` renders the photo via `<Image source={{ uri }}>` with 2 buttons: "Retake" (navigates back) and "Use Photo" (proceeds)
- R-P4-05 [frontend]: `imageService.ts` exports `compressImage(uri)` calling `manipulateAsync` with `resize` action (max 1920px) and `compress: 0.7`
- R-P4-06 [frontend]: `CameraScreen.tsx` calls `useCameraPermissions()` and renders a "Grant Permission" prompt when `status` is "denied"

### Verification Command

```bash
node scripts/verify-camera-capture.cjs
```

---

## Phase 5: Document Upload + OCR Integration

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/src/services/documents.ts` | Add `uploadDocument()`, `triggerOcr()`, `getOcrResult()`, `listDocuments()` service functions | `scripts/verify-doc-upload.cjs` | unit |
| MODIFY | `apps/trucker/src/services/api.ts` | Add `uploadFile(urlPath, formData)` method sending `FormData` via `fetch()` without manual `Content-Type` | `scripts/verify-doc-upload.cjs` | unit |
| ADD | `apps/trucker/src/app/(camera)/upload.tsx` | Add `UploadScreen` with document type picker, `uploadDocument()` call, auto `triggerOcr()` | `scripts/verify-doc-upload.cjs` | unit |
| ADD | `apps/trucker/src/app/(camera)/ocr-result.tsx` | Add `OcrResultScreen` calling `getOcrResult()` to render extracted fields from dynamic `fields[]` array | `scripts/verify-doc-upload.cjs` | unit |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `uploadDocument(params)` | `(params: { uri: string; loadId: string; documentType: string }) => Promise<{ id: string }>` | file URI, load ID, doc type | document ID | ApiError (413 too large, 400 bad type, network) | `UploadScreen` | `api.uploadFile()` |
| `triggerOcr(docId)` | `(docId: string) => Promise<OcrResult>` | document ID | OCR processing result | ApiError (404, 500) | `UploadScreen` | `api.post('/documents/${docId}/process-ocr')` |
| `getOcrResult(docId)` | `(docId: string) => Promise<OcrResult>` | document ID | OCR extracted data | ApiError (404) | `OcrResultScreen` | `api.get('/documents/${docId}/ocr')` |
| `listDocuments(loadId)` | `(loadId: string) => Promise<Document[]>` | load ID | array of documents | ApiError (network) | Phase 6 `DocumentList` | `api.get('/documents?load_id=${loadId}')` |
| `api.uploadFile(path, formData)` | `(urlPath: string, formData: FormData) => Promise<T>` | URL path, FormData object | server response | ApiError (network, 401, 413) | `uploadDocument()` | `fetch()` with multipart headers |
| `UploadScreen` | Route component at `(camera)/upload.tsx` | `photoUri`, `loadId` from params | Navigates to OcrResultScreen or back to load detail | Upload/OCR errors shown inline | PreviewScreen "Use Photo" | `uploadDocument()`, `triggerOcr()` |
| `OcrResultScreen` | Route component at `(camera)/ocr-result.tsx` | `documentId` from params | Renders dynamic `fields[]` array from server OCR response | Fetch error shown | UploadScreen after OCR | `getOcrResult()` |

### Data Flow

```
PreviewScreen "Use Photo" -> navigate to UploadScreen({ photoUri, loadId })
  -> Driver selects document type (BOL, Rate Con, POD, Scale Ticket)
  -> Driver taps "Upload"
  -> Compress image (if not already done) via compressImage()
  -> Build FormData: file blob + document_type + load_id
  -> api.uploadFile('/documents', formData)
    -> Success: receive { id: documentId }
    -> Auto-trigger: triggerOcr(documentId)
      -> Success: navigate to OcrResultScreen({ documentId })
      -> Error: show "OCR failed" with option to view document without OCR
    -> Error 413: "File too large, please retake at lower quality"
    -> Network error: "Upload failed" with retry button
OcrResultScreen mount -> getOcrResult(documentId)
  -> Display extracted fields (shipper, consignee, weight, reference numbers)
  -> "Done" button -> navigate back to load detail
```

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|-------------------|
| documents.ts exports uploadDocument, triggerOcr, getOcrResult, listDocuments | unit | Real | All document service functions must exist | `scripts/verify-doc-upload.cjs` | `check('R-P5-01', ..., countMatches(content, /export.*function/) >= 4)` |
| api.ts has uploadFile method | unit | Real | Multipart support required for file upload | `scripts/verify-doc-upload.cjs` | `check('R-P5-02', ..., /uploadFile/.test(content) && /FormData/.test(content))` |
| UploadScreen has document type selector | unit | Real | Driver must select BOL/RateCon/POD type | `scripts/verify-doc-upload.cjs` | `check('R-P5-03', ..., /BOL/.test(content) && /Rate.*Con/.test(content) && /POD/.test(content))` |
| UploadScreen calls uploadDocument | unit | Real | Must invoke the upload service | `scripts/verify-doc-upload.cjs` | `check('R-P5-04', ..., countMatches(content, /uploadDocument/) >= 1)` |
| UploadScreen triggers OCR after upload | unit | Real | Must call triggerOcr after successful upload | `scripts/verify-doc-upload.cjs` | `check('R-P5-05', ..., countMatches(content, /triggerOcr/) >= 1)` |
| OcrResultScreen displays extracted data | unit | Real | Must call getOcrResult and render fields | `scripts/verify-doc-upload.cjs` | `check('R-P5-06', ..., countMatches(content, /getOcrResult/) >= 1)` |
| UploadScreen has error handling for upload failure | unit | Real | Must show error and retry option | `scripts/verify-doc-upload.cjs` | `check('R-P5-07', ..., /error/.test(content) && /[Rr]etry/.test(content))` |
| api.ts uploadFile omits Content-Type | unit | Real | RN sets multipart boundary automatically | `scripts/verify-doc-upload.cjs` | `check('R-P5-08', ..., !/Content-Type.*multipart/.test(content))` |

### Done When

- R-P5-01 [frontend]: `documents.ts` exports 4 functions: `uploadDocument`, `triggerOcr`, `getOcrResult`, `listDocuments`
- R-P5-02 [frontend]: `api.ts` exports `uploadFile(urlPath, formData)` that sends `FormData` via `fetch()` without setting "Content-Type" header
- R-P5-03 [frontend]: `upload.tsx` renders a picker with 5 document types: "BOL", "Rate Confirmation", "POD", "Fuel Receipt", "Scale Ticket" (matching server's supported document types)
- R-P5-04 [frontend]: `UploadScreen.tsx` calls `uploadDocument()` with 3 params: compressed photo `uri`, `loadId`, and selected `documentType`
- R-P5-05 [frontend]: `upload.tsx` calls `triggerOcr(documentId)` using the `documentId` field from the upload response (NOT `document.id`) and navigates to `ocr-result` screen. Note: server also auto-fires OCR for eligible types, so this is a redundant-but-safe explicit trigger
- R-P5-06 [frontend]: `ocr-result.tsx` calls `getOcrResult(documentId)` on mount and renders the server's `fields[]` array using a `FlatList` or `map()` showing each item's `field_name`, `extracted_value`, and `confidence` score
- R-P5-07 [frontend]: `UploadScreen.tsx` renders an error `<Text>` and a "Retry" `<Pressable>` when `uploadDocument()` returns an error
- R-P5-08 [frontend]: `api.ts` `uploadFile` deletes the "Content-Type" key from headers so the runtime sets the multipart boundary automatically
- R-P5-09 [frontend]: `UploadScreen.tsx` renders "File too large" error text when the server returns status code 413

### Verification Command

```bash
node scripts/verify-doc-upload.cjs
```

---

## Phase 6: Document List per Load

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/src/components/DocumentList.tsx` | Add `DocumentList` component calling `listDocuments(loadId)` with `FlatList` of document items | `scripts/verify-doc-list.cjs` | unit |
| MODIFY | `apps/trucker/src/app/(tabs)/loads/[id].tsx` | Add `DocumentList` section and "Capture Document" `Pressable` navigating to `CameraScreen` | `scripts/verify-doc-list.cjs` | unit |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `DocumentList` | `(props: { loadId: string }) => JSX.Element` | load ID | Rendered list of documents | ApiError displayed inline | `loads/[id].tsx` | `listDocuments(loadId)` from Phase 5 |

### Data Flow

```
LoadDetail mounts/refreshes -> DocumentList receives loadId
  -> listDocuments(loadId) -> api.get('/documents?load_id=${loadId}')
  -> success: render FlatList of document items (name, type, status, date)
  -> empty: "No documents yet" message
  -> error: show error inline
"Capture Document" button -> navigate to CameraScreen({ loadId })
  -> After upload completes -> return to LoadDetail -> DocumentList refreshes
```

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|-------------------|
| DocumentList component calls listDocuments | unit | Real | Must fetch documents for the load | `scripts/verify-doc-list.cjs` | `check('R-P6-01', ..., countMatches(content, /listDocuments/) >= 1)` |
| DocumentList renders document items | unit | Real | Must display document type and name | `scripts/verify-doc-list.cjs` | `check('R-P6-02', ..., /FlatList/.test(content) && /document_type/.test(content))` |
| LoadDetail has Capture Document button | unit | Real | Button must navigate to camera screen | `scripts/verify-doc-list.cjs` | `check('R-P6-03', ..., /[Cc]apture/.test(detailContent) && /[Cc]amera/.test(detailContent))` |
| DocumentList shows empty state | unit | Real | Must handle empty document list gracefully | `scripts/verify-doc-list.cjs` | `check('R-P6-04', ..., /[Nn]o documents/.test(content))` |

### Done When

- R-P6-01 [frontend]: `DocumentList.tsx` calls `listDocuments(loadId)` on mount via `useEffect` and re-fetches on screen focus using `useFocusEffect` from `expo-router` (so new documents appear after camera capture flow returns)
- R-P6-02 [frontend]: `DocumentList.tsx` renders each document in a `FlatList` showing 3 fields: `document_type`, `filename`, `created_at`
- R-P6-03 [frontend]: `loads/[id].tsx` renders a "Capture Document" `Pressable` that navigates to `CameraScreen` with `loadId` param
- R-P6-04 [frontend]: `DocumentList.tsx` renders "No documents yet" `<Text>` when the documents array has length 0

### Verification Command

```bash
node scripts/verify-doc-list.cjs
```

---

## Phase 7: Connectivity Service + Offline Banner (Sprint E Foundation)

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `apps/trucker/package.json` | Add `@react-native-community/netinfo` to `dependencies` | `scripts/verify-offline-core.cjs` | unit |
| ADD | `apps/trucker/src/services/connectivity.ts` | Add connectivity service subscribing to `NetInfo.addEventListener` exposing `isOnline` state | `scripts/verify-offline-core.cjs` | unit |
| ADD | `apps/trucker/src/contexts/ConnectivityContext.tsx` | Add `ConnectivityProvider` context and `useConnectivity` hook returning `{ isOnline }` | `scripts/verify-offline-core.cjs` | unit |
| ADD | `apps/trucker/src/components/OfflineBanner.tsx` | Add `OfflineBanner` rendering "You are offline" banner when `useConnectivity().isOnline` is false | `scripts/verify-offline-core.cjs` | unit |
| MODIFY | `apps/trucker/src/app/_layout.tsx` | Wrap app tree in `ConnectivityProvider`, render `OfflineBanner` at top level | `scripts/verify-offline-core.cjs` | unit |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `connectivityService` | `{ isOnline(): boolean; subscribe(cb): unsubscribe }` | none | boolean connectivity state | none | `ConnectivityContext` | `@react-native-community/netinfo` |
| `ConnectivityProvider` | `({ children }) => JSX.Element` | React children | Context with `isOnline` value | none | `_layout.tsx` | `connectivityService` |
| `useConnectivity` | `() => { isOnline: boolean }` | none | `{ isOnline }` | throws if outside provider | Any screen/component | none |
| `OfflineBanner` | `() => JSX.Element \| null` | none (reads context) | Banner or null | none | `_layout.tsx` | `useConnectivity()` |

### Data Flow

```
App starts -> ConnectivityProvider mounts
  -> connectivityService subscribes to NetInfo
  -> NetInfo reports connectivity state changes
  -> isOnline updates in context
  -> All screens re-render based on isOnline
  -> OfflineBanner shows/hides based on isOnline

Network drops:
  -> NetInfo fires event -> isOnline = false
  -> OfflineBanner appears with "You are offline" message
  -> Upload attempts queue locally (Phase 9)

Network returns:
  -> NetInfo fires event -> isOnline = true
  -> OfflineBanner hides
  -> Background sync triggers (Phase 9)
```

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|-------------------|
| @react-native-community/netinfo in dependencies | unit | Real | Dependency must be declared | `scripts/verify-offline-core.cjs` | `check('R-P7-01', '...', pkgJson.dependencies['@react-native-community/netinfo'] !== undefined)` |
| connectivity.ts uses NetInfo | unit | Real | Must import and subscribe to NetInfo | `scripts/verify-offline-core.cjs` | `check('R-P7-02', '...', /NetInfo/.test(content) && /addEventListener/.test(content))` |
| ConnectivityContext exports provider and hook | unit | Real | Must export ConnectivityProvider and useConnectivity | `scripts/verify-offline-core.cjs` | `check('R-P7-03', '...', /ConnectivityProvider/.test(content) && /useConnectivity/.test(content))` |
| OfflineBanner reads connectivity context | unit | Real | Must call useConnectivity and conditionally render | `scripts/verify-offline-core.cjs` | `check('R-P7-04', '...', /useConnectivity/.test(content) && /offline|Offline/.test(content))` |
| Root layout wraps with ConnectivityProvider | unit | Real | _layout.tsx must include ConnectivityProvider | `scripts/verify-offline-core.cjs` | `check('R-P7-05', '...', /ConnectivityProvider/.test(content))` |

### Done When

- R-P7-01 [frontend]: `package.json` declares `"@react-native-community/netinfo"` in the `dependencies` object
- R-P7-02 [frontend]: `connectivity.ts` calls `NetInfo.addEventListener` and exports 1 boolean `isOnline` tracking connectivity state changes
- R-P7-03 [frontend]: `ConnectivityContext.tsx` exports 2 items: `ConnectivityProvider` component and `useConnectivity` hook returning `{ isOnline: boolean }`
- R-P7-04 [frontend]: `OfflineBanner.tsx` calls `useConnectivity()` and renders "You are offline" `<Text>` only when `isOnline === false`
- R-P7-05 [frontend]: Root `_layout.tsx` wraps app tree with 1 `<ConnectivityProvider>` wrapper and renders 1 `<OfflineBanner />` at top level

### Verification Command

```bash
node scripts/verify-offline-core.cjs
```

---

## Phase 8: Local File Storage + Upload Queue

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `apps/trucker/package.json` | Add `expo-file-system` and `@react-native-async-storage/async-storage` to `dependencies` | `scripts/verify-upload-queue.cjs` | unit |
| ADD | `apps/trucker/src/services/fileStorage.ts` | Add `saveFileLocally()` using `FileSystem.copyAsync` and `deleteLocalFile()` using `deleteAsync` | `scripts/verify-upload-queue.cjs` | unit |
| ADD | `apps/trucker/src/services/uploadQueue.ts` | Add `addToQueue()`, `processQueue()`, `getQueueItems()` with `AsyncStorage` persistence and exponential backoff | `scripts/verify-upload-queue.cjs` | unit |
| ADD | `apps/trucker/src/types/queue.ts` | Define `QueueItem` interface with `id`, `filePath`, `status`, `retryCount`, `createdAt` fields | `scripts/verify-upload-queue.cjs` | unit |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `saveFileLocally(uri)` | `(uri: string) => Promise<string>` | temp photo URI | permanent local path | FileSystemError | Upload flow (when offline) | `expo-file-system.copyAsync()` |
| `deleteLocalFile(path)` | `(path: string) => Promise<void>` | local file path | void | FileSystemError (silent) | Queue after successful upload | `expo-file-system.deleteAsync()` |
| `addToQueue(item)` | `(item: Omit<QueueItem, 'id' \| 'status' \| 'retryCount' \| 'createdAt'>) => Promise<QueueItem>` | file path, load ID, doc type | queued item with ID | AsyncStorage write error | Upload flow (offline fallback) | `AsyncStorage.setItem()` |
| `processQueue()` | `() => Promise<void>` | none | processes all pending items | individual item errors caught internally | Background task, app foreground | `uploadDocument()`, `deleteLocalFile()` |
| `getQueueItems()` | `() => Promise<QueueItem[]>` | none | all queue items | AsyncStorage read error | Phase 10 QueueStatusUI | `AsyncStorage.getItem()` |

### Data Flow

```
Online upload attempt fails OR device is offline:
  -> saveFileLocally(compressedPhotoUri) -> permanent path in documentDirectory
  -> addToQueue({ filePath, loadId, documentType })
  -> QueueItem saved to AsyncStorage with status: 'pending'

processQueue() runs (triggered by network return or background task):
  -> getQueueItems() -> filter status === 'pending' or (status === 'failed' && retryCount < maxRetries)
  -> For each item:
    -> Update status to 'uploading'
    -> uploadDocument({ uri: item.filePath, loadId: item.loadId, documentType: item.documentType })
      -> Success: deleteLocalFile(item.filePath), update status to 'completed'
      -> Failure: increment retryCount, set status to 'failed'
        -> retryCount >= maxRetries (5): leave as 'failed' permanently
        -> retryCount < 5: will be retried on next processQueue() call
  -> Exponential backoff between retries: 2^retryCount * 1000ms (1s, 2s, 4s, 8s, 16s)
```

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|-------------------|
| expo-file-system in dependencies | unit | Real | Dependency must be declared | `scripts/verify-upload-queue.cjs` | `check('R-P8-01', '...', pkgJson.dependencies['expo-file-system'] !== undefined)` |
| fileStorage.ts exports save/delete functions | unit | Real | Must provide local file management | `scripts/verify-upload-queue.cjs` | `check('R-P8-02', '...', /saveFileLocally/.test(content) && /deleteLocalFile/.test(content))` |
| uploadQueue.ts exports addToQueue and processQueue | unit | Real | Queue management functions must exist | `scripts/verify-upload-queue.cjs` | `check('R-P8-03', '...', /addToQueue/.test(content) && /processQueue/.test(content))` |
| uploadQueue.ts implements retry with backoff | unit | Real | Must have retry count logic and exponential delay | `scripts/verify-upload-queue.cjs` | `check('R-P8-04', '...', /retryCount/.test(content) && /backoff|Math\.pow|2.*retryCount/.test(content))` |
| QueueItem type has required fields | unit | Real | Type must include status, retryCount, filePath | `scripts/verify-upload-queue.cjs` | `check('R-P8-05', '...', /status.*pending.*uploading.*failed.*completed/.test(content))` |
| uploadQueue.ts uses AsyncStorage for persistence | unit | Real | Queue must persist across app restarts | `scripts/verify-upload-queue.cjs` | `check('R-P8-06', '...', /AsyncStorage/.test(content))` |
| fileStorage.ts uses expo-file-system | unit | Real | Must use FileSystem API for file operations | `scripts/verify-upload-queue.cjs` | `check('R-P8-07', '...', /expo-file-system/.test(content) && /copyAsync|moveAsync/.test(content))` |

### Done When

- R-P8-01 [frontend]: `package.json` declares both `"expo-file-system"` and `"@react-native-async-storage/async-storage"` in the `dependencies` object
- R-P8-02 [frontend]: `fileStorage.ts` exports 2 functions: `saveFileLocally(uri)` returning the permanent path and `deleteLocalFile(path)` removing the file
- R-P8-03 [frontend]: `uploadQueue.ts` exports 3 functions: `addToQueue()`, `processQueue()`, and `getQueueItems()`
- R-P8-04 [frontend]: `uploadQueue.ts` computes retry delay as `Math.pow(2, retryCount) * 1000` ms (exponential backoff: 1s, 2s, 4s, 8s, 16s)
- R-P8-05 [frontend]: `queue.ts` defines `QueueItem` with 7 fields: `id`, `filePath`, `loadId`, `documentType`, `status`, `retryCount`, `createdAt`
- R-P8-06 [frontend]: `uploadQueue.ts` calls `AsyncStorage.setItem("uploadQueue", JSON.stringify(items))` to persist queue state
- R-P8-07 [frontend]: `fileStorage.ts` calls `FileSystem.copyAsync` with 2 params `{ from: uri, to: permanentPath }` to save files from temp storage
- R-P8-08 [frontend]: `processQueue()` marks items with `retryCount >= 5` as `status: "failed"` permanently and skips them

### Verification Command

```bash
node scripts/verify-upload-queue.cjs
```

---

## Phase 9: Background Sync Task

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `apps/trucker/package.json` | Add `expo-task-manager` to `dependencies` | `scripts/verify-background-sync.cjs` | unit |
| ADD | `apps/trucker/src/services/backgroundSync.ts` | Add `registerBackgroundSync()` calling `TaskManager.defineTask` with `processQueue()` handler | `scripts/verify-background-sync.cjs` | unit |
| MODIFY | `apps/trucker/src/services/connectivity.ts` | Add `processQueue()` call on offline-to-online transition in `NetInfo` listener | `scripts/verify-background-sync.cjs` | unit |
| MODIFY | `apps/trucker/src/app/_layout.tsx` | Call `registerBackgroundSync()` in root layout `useEffect` on mount | `scripts/verify-background-sync.cjs` | unit |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `registerBackgroundSync()` | `() => Promise<void>` | none | void (task registered) | TaskManager registration error (logged, not thrown) | `_layout.tsx` on mount | `expo-task-manager.defineTask()`, `TaskManager.registerTaskAsync()` |
| `UPLOAD_TASK_NAME` | `const string` | none | `'loadpilot-upload-sync'` | none | `backgroundSync.ts`, `_layout.tsx` | none |
| Network restore listener | internal | connectivity change event | triggers `processQueue()` | processQueue errors caught internally | `connectivity.ts` NetInfo callback | `processQueue()` from Phase 8 |

### Data Flow

```
App startup -> _layout.tsx mounts
  -> registerBackgroundSync() called
  -> TaskManager.defineTask(UPLOAD_TASK_NAME, async () => {
       await processQueue();
       return BackgroundFetch.BackgroundFetchResult.NewData;
     })
  -> TaskManager.registerTaskAsync(UPLOAD_TASK_NAME, { minimumInterval: 15*60 })
  -> Task fires every ~15 minutes when app is backgrounded

Network connectivity restored (NetInfo event):
  -> connectivity.ts detects online transition (was offline, now online)
  -> Immediately calls processQueue()
  -> Queue items uploaded in order
```

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|-------------------|
| expo-task-manager in dependencies | unit | Real | Dependency must be declared | `scripts/verify-background-sync.cjs` | `check('R-P9-01', '...', pkgJson.dependencies['expo-task-manager'] !== undefined)` |
| backgroundSync.ts defines task | unit | Real | Must use TaskManager.defineTask | `scripts/verify-background-sync.cjs` | `check('R-P9-02', '...', /defineTask/.test(content) && /UPLOAD/.test(content))` |
| backgroundSync.ts calls processQueue | unit | Real | Background task must invoke queue processing | `scripts/verify-background-sync.cjs` | `check('R-P9-03', '...', /processQueue/.test(content))` |
| connectivity.ts triggers processQueue on reconnect | unit | Real | Must call processQueue when going from offline to online | `scripts/verify-background-sync.cjs` | `check('R-P9-04', '...', /processQueue/.test(connContent))` |
| _layout.tsx registers background task | unit | Real | Must call registerBackgroundSync on mount | `scripts/verify-background-sync.cjs` | `check('R-P9-05', '...', /registerBackgroundSync/.test(layoutContent))` |

### Done When

- R-P9-01 [frontend]: `package.json` declares `"expo-task-manager"` in the `dependencies` object
- R-P9-02 [frontend]: `backgroundSync.ts` calls `TaskManager.defineTask("loadpilot-upload-sync", handler)` with a handler that runs `processQueue()`
- R-P9-03 [frontend]: The background task handler calls 1 function `processQueue()` and returns `BackgroundFetch.BackgroundFetchResult.NewData`
- R-P9-04 [frontend]: `connectivity.ts` calls `processQueue()` when `NetInfo` transitions from `isConnected === false` to `isConnected === true`
- R-P9-05 [frontend]: Root `_layout.tsx` calls `registerBackgroundSync()` inside 1 `useEffect` hook with empty dependency array `[]` during mount

### Verification Command

```bash
node scripts/verify-background-sync.cjs
```

---

## Phase 10: Queue Status UI + Offline Upload Integration

**Phase Type**: `integration`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/src/components/QueueStatusBadge.tsx` | Add `QueueStatusBadge` calling `getQueueItems()` to display pending+failed count | `scripts/verify-queue-ui.cjs` | unit |
| ADD | `apps/trucker/src/app/(tabs)/queue.tsx` | Add `QueueScreen` as a tab with `FlatList` of queue items, `Retry` button for failed, status per item | `scripts/verify-queue-ui.cjs` | unit |
| MODIFY | `apps/trucker/src/app/(camera)/upload.tsx` | Add `isOnline` check via `useConnectivity()`; when offline OR when direct upload fails with network error, call `saveFileLocally()` then `addToQueue()` as fallback | `scripts/verify-queue-ui.cjs` | unit |
| MODIFY | `apps/trucker/src/app/(tabs)/_layout.tsx` | Add `QueueStatusBadge` to tab bar or add Queue `Tabs.Screen` | `scripts/verify-queue-ui.cjs` | unit |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `QueueStatusBadge` | `() => JSX.Element \| null` | none (reads queue) | Badge with pending count or null | none | tabs layout | `getQueueItems()` from Phase 8 |
| `QueueScreen` | Route component | none | List of queue items with actions | AsyncStorage read error | Tab bar or navigation | `getQueueItems()`, `processQueue()` |

### Data Flow

```
UploadScreen detects offline state (useConnectivity):
  -> Instead of direct upload:
    -> compressImage(photoUri) -> compressed URI
    -> saveFileLocally(compressedUri) -> permanent path
    -> addToQueue({ filePath: permanentPath, loadId, documentType })
    -> Show "Document queued for upload when online" toast
    -> Navigate back to load detail

QueueScreen mount:
  -> getQueueItems() -> display list grouped by status
  -> Pending: show "Waiting for connection"
  -> Uploading: show progress
  -> Failed: show "Retry" button -> retries single item
  -> Completed: show "Clear" button -> removes from list

QueueStatusBadge:
  -> getQueueItems() -> count pending + failed
  -> count > 0: show red badge with count
  -> count === 0: render null (no badge)
```

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|-------------------|
| QueueStatusBadge reads queue items | unit | Real | Must access queue to show count | `scripts/verify-queue-ui.cjs` | `check('R-P10-01', ..., countMatches(content, /getQueueItems/) >= 1)` |
| QueueScreen displays queue items | unit | Real | Must list items with status | `scripts/verify-queue-ui.cjs` | `check('R-P10-02', ..., /getQueueItems/.test(content) && /FlatList/.test(content))` |
| QueueScreen has retry button for failed items | unit | Real | Failed items must have manual retry | `scripts/verify-queue-ui.cjs` | `check('R-P10-03', ..., /[Rr]etry/.test(content) && /failed/.test(content))` |
| UploadScreen uses offline fallback | unit | Real | Must check connectivity and queue when offline | `scripts/verify-queue-ui.cjs` | `check('R-P10-04', ..., /useConnectivity/.test(uploadContent) && /addToQueue/.test(uploadContent))` |
| Tab layout shows queue indicator | unit | Real | Must integrate QueueStatusBadge or queue visibility | `scripts/verify-queue-ui.cjs` | `check('R-P10-05', ..., countMatches(tabContent, /[Qq]ueue/) >= 1)` |

### Done When

- R-P10-01 [frontend]: `QueueStatusBadge.tsx` calls `getQueueItems()` and renders a red badge with the count of items where `status === "pending"` or `status === "failed"`
- R-P10-02 [frontend]: `QueueScreen.tsx` renders all queue items in a `FlatList` showing 4 fields: filename, `documentType`, `status`, `retryCount`
- R-P10-03 [frontend]: `QueueScreen.tsx` renders a "Retry" `<Pressable>` for each item with `status === "failed"` that re-triggers upload
- R-P10-04 [frontend]: `upload.tsx` checks `useConnectivity().isOnline`; when `isOnline === false`, calls `saveFileLocally()` then `addToQueue()` instead of direct upload; when online upload fails with a network error, falls back to the same queue path
- R-P10-05 [frontend]: Tab `_layout.tsx` adds a 4th `Tabs.Screen` for `queue` with `QueueStatusBadge` rendering the pending count as a tab badge number (visible when count > 0)

### Verification Command

```bash
node scripts/verify-queue-ui.cjs
```

---

## Phase 11: Combined Verification + Home Screen Dashboard

**Phase Type**: `e2e`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `scripts/verify-sprint-cde.cjs` | Add combined verification script that runs all phase `verify-*.cjs` scripts and reports aggregate pass/fail | `scripts/verify-sprint-cde.cjs` | e2e |
| MODIFY | `apps/trucker/src/app/(tabs)/index.tsx` | Replace placeholder with dashboard calling `fetchLoads()` for active count and `getQueueItems()` for pending uploads | `scripts/verify-sprint-cde.cjs` | unit |
| MODIFY | `apps/trucker/src/app/(tabs)/profile.tsx` | Add queue status section calling `getQueueItems()` to show pending upload count | `scripts/verify-sprint-cde.cjs` | unit |

### Untested Files

| File | Reason | Tested Via |
|------|--------|-----------|
| `scripts/verify-sprint-cde.cjs` | Verification script itself | Manual execution (self-testing) |

### Interface Contracts

N/A -- This phase wires existing components together and adds a combined verification script. No new function signatures.

### Data Flow

```
Home screen mount:
  -> fetchLoads() -> count active loads (status in dispatched/in_transit/arrived)
  -> Find next upcoming pickup by pickup_date
  -> getQueueItems() -> count pending uploads
  -> Display dashboard cards: Active Loads (count), Next Pickup (date+destination), Pending Uploads (count)

Profile screen:
  -> getQueueItems() -> show "N documents pending upload" summary
  -> If queue has failed items, show warning

Combined verification (verify-sprint-cde.cjs):
  -> Runs all 11 phase verification checks sequentially
  -> Reports total pass/fail count
  -> Exit 0 if all pass, exit 1 if any fail
```

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|-------------------|
| Home screen shows load counts | e2e | Real | Dashboard must display active load data | `scripts/verify-sprint-cde.cjs` | `check('R-P11-01', ..., /fetchLoads/.test(homeContent) && countMatches(homeContent, /active/) >= 1)` |
| Home screen shows pending queue | e2e | Real | Dashboard must show upload queue status | `scripts/verify-sprint-cde.cjs` | `check('R-P11-02', ..., /getQueueItems/.test(homeContent))` |
| All phase verification scripts exist | e2e | Real | All CJS scripts must be present | `scripts/verify-sprint-cde.cjs` | `check('R-P11-03', ..., fs.existsSync(path.join(ROOT, 'scripts/verify-trip-workspace.cjs')) === true)` |
| Combined script exits with correct code | e2e | Real | Aggregated pass/fail must match | `scripts/verify-sprint-cde.cjs` | `assert(process.exitCode === (failures > 0 ? 1 : 0))` |

### Done When

- R-P11-01 [frontend]: `index.tsx` calls `fetchLoads()` and renders an "Active Loads" card counting loads with status in `["dispatched", "in_transit", "arrived"]`
- R-P11-02 [frontend]: `index.tsx` calls `getQueueItems()` and renders a "Pending Uploads" card showing the count when count > 0
- R-P11-03 [frontend]: `scripts/verify-sprint-cde.cjs` exists and invokes all 10 phase `verify-*.cjs` scripts, reporting aggregated pass/fail totals
- R-P11-04 [frontend]: `scripts/verify-sprint-cde.cjs` calls `process.exit(1)` when `failures > 0` and `process.exit(0)` when all checks pass

### Verification Command

```bash
node scripts/verify-sprint-cde.cjs
```

---

### API Contracts

All endpoints already exist on the server. The mobile app is a pure consumer. No server changes required.

| Method | Endpoint | Request Schema | Response Schema | Auth | Status Codes |
|--------|----------|---------------|-----------------|------|-------------|
| GET | `/api/loads` | Query: `?for=schedule&start=DATE&end=DATE` (optional) | Raw `Load[]` array (NOT wrapped — server returns `res.json(result)` directly). Each load includes `legs[]` array of `LoadLeg` objects and derived `dropoff_date`. | Bearer JWT | 200, 401, 500 |
| ~~GET~~ | ~~`/api/loads/:id`~~ | ~~N/A~~ | **DOES NOT EXIST** — use client-side filter from `GET /api/loads` response: `loads.find(l => l.id === id)` | N/A | N/A |
| PATCH | `/api/loads/:id/status` | Body: `{ status: LoadStatus }` | Updated load object directly (NOT wrapped in `{ load }`) | Bearer JWT | 200, 401, 404, 422 (invalid transition), 500 |
| GET | `/api/documents` | Query: `?load_id=X&document_type=Y` (optional filters) | `{ documents: Document[] }` | Bearer JWT | 200, 401, 500 |
| POST | `/api/documents` | Multipart: field `file` (binary) + `document_type` (string) + `load_id` (string, optional) | `{ message, documentId, storagePath, status, sanitizedFilename }` (note: uses `documentId` NOT `document.id`) | Bearer JWT | 201, 400 (missing fields), 401, 413 (too large), 500 |
| POST | `/api/documents/:id/process-ocr` | Path param: `id` (string) | `{ status: string, result?: OcrData }` | Bearer JWT | 200, 202 (processing), 401, 404, 500 |
| GET | `/api/documents/:id/ocr` | Path param: `id` (string) | `{ result: OcrData }` | Bearer JWT | 200, 401, 404 (no result), 500 |

**Note on MODIFY files**: All files marked MODIFY in Changes tables exist on the `mobile/trucker-app` branch, not on `main`. Ralph will base work on that branch.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| expo-camera permission flow differs between iOS simulator and real device | Medium | Medium | CJS tests verify source patterns only; manual device testing for permissions |
| Large image uploads fail on cellular | Medium | High | Image compression in Phase 4 (max 1920px, 0.7 quality). Offline queue in Phase 8 provides retry. |
| Background task killed by OS before completing upload | High | Medium | expo-task-manager re-registers on app open. Queue persists in AsyncStorage. processQueue() resumes on foreground. |
| expo-file-system storage fills up with queued images | Low | Medium | deleteLocalFile() removes files after successful upload. QueueScreen allows manual clearing. |
| 14 stories exceeds Ralph comfort zone | Medium | Medium | Stories are small (4-8 criteria each). CJS static analysis tests are fast. Circuit breaker at 3 consecutive failures. |
| multipart upload FormData may differ between Expo/RN and browser | Medium | High | Use standard FormData API without manually setting Content-Type header. Test on device. |

## Dependencies

### Internal
- `apps/trucker/src/services/api.ts` (Phase 1 uses, Phase 5 extends)
- `apps/trucker/src/contexts/AuthContext.tsx` (all phases use for auth state)
- `packages/shared/src/types.ts` (Phase 1 uses LoadStatus type)

### External (new dependencies to add)
- `expo-camera` (Phase 4)
- `expo-image-manipulator` (Phase 4)
- `expo-file-system` (Phase 8)
- `expo-task-manager` (Phase 9)
- `@react-native-community/netinfo` (Phase 7)
- `@react-native-async-storage/async-storage` (Phase 8, may already be transitive)

### Existing server endpoints (no changes needed)
- `GET /api/loads` -- list loads
- `GET /api/loads/:id` -- load detail
- `PATCH /api/loads/:id/status` -- status transition
- `POST /api/documents` -- upload document (multipart)
- `POST /api/documents/:id/process-ocr` -- trigger OCR
- `GET /api/documents/:id/ocr` -- get OCR results
- `GET /api/documents?load_id=X` -- list documents per load

## Rollback Plan

Each phase is additive (new files under `apps/trucker/`) with minimal modifications to existing files. Rollback for any phase:
1. `git revert` the phase's commit
2. No server-side changes to roll back
3. No database migrations to reverse
4. Dependencies added to `apps/trucker/package.json` only (isolated from root)

Full sprint rollback: `git reset --hard` to the pre-sprint commit on `mobile/trucker-app` branch.

## Explicitly Out of Scope (Deferred)

These items from the v1 product plan and strategy decisions are intentionally NOT in this sprint. They are acknowledged here to prevent scope confusion:

| Item | v1 Phase | Why Deferred |
|------|----------|-------------|
| **i18n (Spanish + English)** | Phase 2 | i18n infrastructure (i18next, translation files, language picker) is foundational work that should be done once for all screens. Adding it mid-sprint to 15+ screens is scope creep. Deferred to a dedicated i18n sprint. |
| **Offline load cache (SQLite)** | Phase 4 | Trip workspace offline mode requires SQLite cache + sync. Sprint E covers document upload offline only. Full offline-first loads will come in a hardening sprint. |
| **Biometric auth + offline session** | Phase 3 | Requires expo-local-authentication + secure token caching. Auth works via Firebase cached state for now. |
| **Stop sequence UI** | Phase 4 | Multi-stop visualization is enhancement over basic load detail. Deferred. |
| **Navigation handoff (Maps)** | Phase 4 | expo-linking to Apple/Google Maps. Enhancement. Deferred. |
| **OCR result editing** | Phase 5 | v1 has ExtractionConfirmation with edit controls. Our OCR screen is read-only display. Editing deferred. |
| **Crop/rotate in preview** | Phase 5 | v1 specifies crop/rotate controls. We do resize+compress only. Enhancement. Deferred. |
| **Document duplicate detection** | Phase 5 | Perceptual hashing to detect re-captures. Enhancement. Deferred. |
| **SQLite upload queue** | Phase 5 | v1 uses SQLite. We use AsyncStorage (simpler, adequate for MVP queue sizes). May upgrade later. |
| **requireTier handling for OCR** | Phase 5 | `POST /api/documents/:id/process-ocr` has `requireTier` middleware. Free-tier users get auto-OCR from server's fire-and-forget but cannot manually trigger. The mobile app should handle 403 gracefully — deferred to tier enforcement sprint (master plan Sprint K). |

## Master Plan Alignment Note

The master plan's Sprint C is titled "Mobile document intake and camera integration." This sprint plan resequences the work:
- Our **Sprint C** = Trip Workspace (master plan has no explicit sprint for this — it's embedded in v1 Phase 4)
- Our **Sprint D** = Document Capture (= master plan's Sprint C core deliverable)
- Our **Sprint E** = Offline Queue (= master plan's Sprint C offline support)

The master plan (`docs/PLAN-trucker-app-master.md`) should be updated after this sprint to reflect the actual sprint naming and sequencing. This does NOT block execution.

## Open Questions

None. All critical issues resolved. API response shapes verified against source code. Field names corrected to match database schema (legs-based origin/destination). File paths use expo-router conventions.
