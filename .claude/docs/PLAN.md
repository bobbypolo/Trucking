# Sprint B2 -- Mobile App Bootstrap + Shared Types + Baseline Debt Cleanup

> **Active sprint plan.** Full program roadmap: `docs/PLAN-trucker-app-master.md`
>
> This file contains ONLY the Sprint B2 execution contract. After B2
> merges, the handoff script replaces this file with Sprint C's contract.

## Goal

Establish the Expo + React Native mobile app project structure under `apps/trucker/`, extract shared TypeScript types into `packages/shared/` for dual consumption by web and mobile, stand up the mobile navigation shell with tab-based routing and authentication screens, configure EAS Build for development and preview profiles, and resolve the 3 baseline technical debt items from the B1 debt register.

## System Context

### Files Read

| File | Key Findings |
|------|-------------|
| `types.ts` (2130 lines) | 150 exports (types, interfaces, consts). Consumed by ~130 frontend files via `from '../types'` or `from '../../types'`. Zero server imports -- server has its own inline types. |
| `tsconfig.json` | Target ES2022, module ESNext, moduleResolution bundler, jsx react-jsx, paths `@/*: ["./*"]`. Excludes `server/`, `node_modules/`, `scripts/dev/`. |
| `server/tsconfig.json` | Target ES2020, module CommonJS, moduleResolution node, strict true. Includes `types/**/*.d.ts`. Server does NOT import root `types.ts`. |
| `package.json` | Root package `loadpilot`, type module, React 19.2, Vite 6.2, TS 5.8, Vitest 4.0. |
| `server/package.json` | `loadpilot-server`, type commonjs, Express 5.2, TS 5.9, Vitest 4.0, Zod 4.3. |
| `vite.config.ts` | Path alias `@: .`, proxy `/api` to backend. Manual chunks for vendor, maps, pdf, xlsx, charts, firebase. |
| `apps/trucker/` | 3 asset PNGs only (adaptive-icon, icon, splash). Zero code files. |
| `packages/` | Does not exist. |
| `.gitignore` | `.claude/` tracked via negation allowlist. `node_modules/`, `dist/`, coverage patterns. |
| `server/index.ts` | 39 route imports, Sentry init, helmet, cors, compression, rate-limit. Feature flags route mounted. |
| `e2e/ifta-audit-packet-smoke.spec.ts` | Uses `jszip` import -- TS2307 error (baseline debt item 1). |
| `docs/trucker-app-baseline-debt.md` | 3 entries: jszip types, Windows PORT env, missing hooks tests dir. |
| `.claude/workflow.json` | `project_test`: vitest both sides. `project_mode: host_project`. |

### Data Flow Diagram

```
[types.ts (root)]
  |
  |-- (extracted to) --> [packages/shared/src/types.ts]
  |                         |
  |                         |-- re-exported via --> [packages/shared/index.ts]
  |                         |
  |-- (consumed by) ------> [~130 frontend files via '../types']
  |                         (updated to '@loadpilot/shared')
  |
  |-- NOT consumed by ----> [server/] (has own inline types)

[apps/trucker/]
  |
  |-- package.json (new, depends on @loadpilot/shared)
  |-- app.json / app.config.ts (Expo config)
  |-- eas.json (EAS Build profiles)
  |-- src/
  |     |-- app/ (Expo Router file-based routing)
  |     |     |-- _layout.tsx (root layout with auth gate)
  |     |     |-- (auth)/ (login, signup screens)
  |     |     |-- (tabs)/ (home, loads, profile)
  |     |-- services/
  |     |     |-- api.ts (Express API client)
  |     |     |-- auth.ts (Firebase Auth wrapper)
  |     |-- components/ (shared mobile components)
```

### Existing Patterns

- **Import convention**: Frontend uses relative `../types` or `../../types`. Path alias `@/` resolves to project root.
- **Auth pattern**: `server/auth.ts` uses Firebase Admin `verifyIdToken` + SQL principal lookup. Frontend uses Firebase client SDK.
- **Test pattern**: Vitest + Testing Library (frontend), Vitest + supertest (server). Test files under `src/__tests__/` (frontend) and `server/__tests__/` (server).
- **Module system**: Root is ESM (`"type": "module"`), server is CJS (`"type": "commonjs"`).

### Blast Radius Assessment

| Area | Impact | Risk |
|------|--------|------|
| `types.ts` | MOVED to `packages/shared/src/types.ts`, original replaced with re-export barrel | HIGH -- 130+ files import this. Mitigated by keeping root `types.ts` as a re-export shim. |
| Root `tsconfig.json` | ADD path alias for `@loadpilot/shared` | LOW -- additive change only. |
| Root `package.json` | ADD workspace config + `@loadpilot/shared` dep | MEDIUM -- npm workspaces changes npm install behavior. |
| `apps/trucker/` | NEW directory, isolated npm project | LOW -- completely new, no existing code affected. |
| `packages/shared/` | NEW directory, new package | LOW -- new package, no existing code affected. |
| Frontend test files | May need import path adjustment if shim re-export breaks | MEDIUM -- mitigated by keeping original `types.ts` as pass-through. |
| `.gitignore` | May need `apps/trucker/node_modules/` + `packages/shared/dist/` | LOW -- additive. |
| `e2e/ifta-audit-packet-smoke.spec.ts` | Debt fix: add `@types/jszip` or fix import | LOW -- isolated. |

## Locked Decisions (applicable to B2)

1. **Package manager**: Root stays npm. `apps/trucker/` is an isolated npm
   subproject with its own `package.json`. Use `npm ci` (not `npm install`)
   in all verification and CI commands.

2. **Peer layout** -- `apps/trucker/` is a peer directory to root `src/`,
   `components/`, `services/`. Web app stays exactly where it is. No
   Turborepo. The master plan says "Turborepo monorepo restructure" but
   locked decision #2 from B1 supersedes: peer layout, npm workspaces for
   `packages/shared/` only.

3. **Shared types via npm workspace** -- `packages/shared/` is an npm
   workspace package (`@loadpilot/shared`). Root `types.ts` becomes a
   re-export shim (`export * from '@loadpilot/shared'`) so existing 130+
   imports continue working with zero changes to consuming files.

4. **Expo Router** -- File-based routing via `expo-router` (not React
   Navigation manually configured). Aligns with Expo SDK 55 defaults.

5. **Windows-safe tooling only** -- Same as B1. All verification commands
   use cross-platform tools. All R-marker assertions that read a file use
   `fs.readFileSync` + regex.

6. **Migration-number management**: B2 has no new SQL migrations. Max
   existing = 054.

7. **SaaS non-regression gate**: YES -- `packages/shared/` extraction
   touches the type system consumed by all frontend code. Must verify
   existing tests still pass after extraction.

## SaaS Regression Protection Strategy

The shared types extraction replaces the root `types.ts` content with a
re-export shim. This ensures:
1. All existing `import { X } from '../types'` paths continue resolving.
2. No behavioral changes to any frontend component.
3. Server code is unaffected (does not import root `types.ts`).
4. Existing test suite runs identically before and after extraction.

---

## Phase 1 -- Shared Types Package Extraction (foundation)

Extract the 2130-line `types.ts` into `packages/shared/` as an npm workspace
package. Root `types.ts` becomes a re-export shim. All existing imports
continue working unchanged.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `packages/shared/package.json` | npm package `@loadpilot/shared`, version 0.0.1, main/types entry | `scripts/verify-shared-package.cjs` | unit |
| ADD | `packages/shared/tsconfig.json` | TS config for shared package (ES2022, declaration, composite) | N/A | N/A |
| ADD | `packages/shared/src/types.ts` | Full content moved from root `types.ts` (2130 lines) | `scripts/verify-shared-package.cjs` | unit |
| ADD | `packages/shared/src/index.ts` | Barrel re-export: `export * from './types'` | `scripts/verify-shared-package.cjs` | unit |
| MODIFY | `types.ts` | Replace content with `export * from '@loadpilot/shared'` re-export shim (1 line) | `scripts/verify-shared-package.cjs` | unit |
| MODIFY | `package.json` | Add `"workspaces": ["packages/*"]` and `@loadpilot/shared` dependency | `scripts/verify-shared-package.cjs` | unit |
| MODIFY | `tsconfig.json` | Add path alias `"@loadpilot/shared": ["./packages/shared/src"]` | `scripts/verify-shared-package.cjs` | unit |
| ADD | `scripts/verify-shared-package.cjs` | Verification script: reads files, asserts structure, re-export shim, workspace config | `scripts/verify-shared-package.cjs` | unit |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `packages/shared/tsconfig.json` | Config-only JSON | TypeScript compilation via `npx tsc --noEmit` in verification command |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `packages/shared/src/index.ts` | `export * from './types'` | N/A (barrel re-export) | All 150 type/interface/const exports from types.ts | TS compilation errors if types.ts has syntax errors | All frontend files via shim, `apps/trucker/` directly | `./types` |
| `types.ts` (root, modified) | `export * from '@loadpilot/shared'` | N/A (re-export shim) | All 150 type/interface/const exports | Module resolution error if workspace not linked | ~130 frontend files | `@loadpilot/shared` |

### Data Flow

```
packages/shared/src/types.ts (canonical source, 2130 lines)
  --> packages/shared/src/index.ts (barrel: export *)
    --> types.ts (root shim: export * from '@loadpilot/shared')
      --> ~130 frontend files (unchanged import paths)
    --> apps/trucker/ (direct: import { X } from '@loadpilot/shared')

Error paths:
  - npm workspace not linked: `npm install` fails to resolve @loadpilot/shared
    --> Fix: run `npm install` from root after adding workspaces
  - TypeScript path alias missing: tsc cannot find module
    --> Fix: tsconfig.json paths entry required
  - Circular re-export: if shim imports from itself
    --> Prevention: shim imports package name, not relative path
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Shared package structure exists | unit | Real | Pure file assertions via fs.readFileSync, no mocking needed | `scripts/verify-shared-package.cjs` |
| Re-export shim content correct | unit | Real | Regex assertion on single-line shim via fs.readFileSync | `scripts/verify-shared-package.cjs` |
| Workspace config in root package.json | unit | Real | Structural assertion via JSON.parse + fs.readFileSync | `scripts/verify-shared-package.cjs` |
| TypeScript compilation succeeds | unit | Real | Must compile with new paths via npx tsc --noEmit | verification command |
| Existing frontend tests still pass | integration | Real | SaaS non-regression via npx vitest run | verification command |

**Assertion blueprints:**
- `assert(JSON.parse(rootPkg).workspaces.includes('packages/*'))` -- workspace config present
- `assert(/^export \* from ['"]@loadpilot\/shared['"]/.test(shimContent))` -- re-export shim correct
- `assert(fs.existsSync('packages/shared/src/types.ts'))` -- canonical types file exists
- `assert(JSON.parse(sharedPkg).name === '@loadpilot/shared')` -- package name correct

### Acceptance Criteria (R-markers)

- R-P1-01 [frontend]: `packages/shared/package.json` exists with `"name": "@loadpilot/shared"` and `"version": "0.0.1"`; verified by `scripts/verify-shared-package.cjs` reading file via `fs.readFileSync` and asserting via JSON.parse
- R-P1-02 [frontend]: `packages/shared/src/types.ts` contains all 150 exported symbols from the original `types.ts`; verified by `scripts/verify-shared-package.cjs` reading both files via `fs.readFileSync` and comparing export counts via regex `export (type|interface|const|enum|function)` match count
- R-P1-03 [frontend]: `packages/shared/src/index.ts` contains barrel re-export `export * from './types'`; verified by `scripts/verify-shared-package.cjs` reading file and matching regex
- R-P1-04 [frontend]: Root `types.ts` contains exactly one line: re-export shim `export * from '@loadpilot/shared'`; verified by `scripts/verify-shared-package.cjs` reading file and asserting line count equals 1 and content matches regex
- R-P1-05 [frontend]: Root `package.json` contains `"workspaces": ["packages/*"]`; verified by `scripts/verify-shared-package.cjs` reading file via `fs.readFileSync` and asserting JSON.parse result
- R-P1-06 [frontend]: Root `tsconfig.json` contains path alias `"@loadpilot/shared"` pointing to `"./packages/shared/src"`; verified by `scripts/verify-shared-package.cjs` reading file and asserting paths entry exists
- R-P1-07 [integration]: `npx tsc --noEmit` exits with code 0 from project root (existing frontend types resolve through shim); verified by `scripts/verify-shared-package.cjs` spawning process via `child_process.spawnSync` and asserting exit code

### Verification Command

```bash
npm install --ignore-scripts
node scripts/verify-shared-package.cjs
```

---

## Phase 2 -- Expo Project Initialization (foundation)

Initialize the Expo + React Native project under `apps/trucker/` using
`create-expo-app` defaults. Configure `app.json`, `eas.json`, and basic
project structure. This phase creates a buildable Expo project with no
navigation or auth yet.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/package.json` | Expo project package.json with expo, react-native, expo-router deps | `scripts/verify-expo-project.cjs` | unit |
| ADD | `apps/trucker/tsconfig.json` | TypeScript config extending Expo defaults | N/A | N/A |
| ADD | `apps/trucker/app.json` | Expo app config: name, slug, scheme, sdkVersion, platforms | `scripts/verify-expo-project.cjs` | unit |
| ADD | `apps/trucker/eas.json` | EAS Build profiles: development (internal), preview (internal), production | `scripts/verify-expo-project.cjs` | unit |
| ADD | `apps/trucker/babel.config.js` | Babel config with expo preset | N/A | N/A |
| ADD | `apps/trucker/src/app/_layout.tsx` | Root layout placeholder (Slot from expo-router) | `scripts/verify-expo-project.cjs` | unit |
| ADD | `apps/trucker/src/app/index.tsx` | Root screen placeholder (welcome text) | `scripts/verify-expo-project.cjs` | unit |
| MODIFY | `.gitignore` | Add `apps/trucker/node_modules/`, `apps/trucker/.expo/`, `packages/shared/dist/` | `scripts/verify-expo-project.cjs` | unit |
| ADD | `scripts/verify-expo-project.cjs` | Verification script: asserts Expo project structure, app.json fields, eas.json profiles | `scripts/verify-expo-project.cjs` | unit |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `apps/trucker/tsconfig.json` | Config-only JSON | TypeScript compilation via verification command |
| `apps/trucker/babel.config.js` | Config-only JS | Expo project loads correctly |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `apps/trucker/app.json` | Expo config object | N/A | `{ expo: { name, slug, scheme, sdkVersion, platforms, ... } }` | Invalid config: Expo CLI errors on build | EAS Build, expo start | N/A |
| `apps/trucker/eas.json` | EAS config object | N/A | `{ build: { development, preview, production } }` | Invalid profile: EAS Build errors | EAS Build CLI | N/A |
| `apps/trucker/src/app/_layout.tsx` | `export default function RootLayout()` | N/A | JSX: `<Slot />` | Import errors if expo-router not installed | Expo Router | `expo-router` |

### Data Flow

```
apps/trucker/package.json
  --> npm install (isolated project, own node_modules)
  --> app.json (Expo SDK config: name, scheme, platforms)
  --> eas.json (build profiles: dev/preview/prod)
  --> src/app/_layout.tsx (Expo Router root layout)
    --> src/app/index.tsx (root screen)

Error paths:
  - npm install fails: missing peer deps for Expo SDK
    --> Fix: use exact Expo SDK 55 compatible versions
  - Expo Router not found: missing expo-router in deps
    --> Fix: included in package.json dependencies
  - EAS Build fails: invalid eas.json schema
    --> Fix: use documented default structure from Expo docs
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Expo project files exist | unit | Real | File existence and content assertions via fs.readFileSync | `scripts/verify-expo-project.cjs` |
| app.json has required fields | unit | Real | Structural assertion via JSON.parse on config | `scripts/verify-expo-project.cjs` |
| eas.json has 3 build profiles | unit | Real | Structural assertion via JSON.parse | `scripts/verify-expo-project.cjs` |
| Root layout exports default function | unit | Real | Code structure assertion via fs.readFileSync + regex | `scripts/verify-expo-project.cjs` |
| .gitignore updated | unit | Real | Pattern presence check via fs.readFileSync + regex | `scripts/verify-expo-project.cjs` |

**Assertion blueprints:**
- `assert(expo.name === 'LoadPilot Trucker')` -- app name correct
- `assert(expo.sdkVersion === '55.0.0' || expo.sdkVersion.startsWith('55'))` -- SDK version
- `assert(Object.keys(easBuild).includes('development'))` -- dev profile exists
- `assert(Object.keys(easBuild).includes('preview'))` -- preview profile exists
- `assert(Object.keys(easBuild).includes('production'))` -- production profile exists
- `assert(/export default function RootLayout/.test(layoutContent))` -- root layout exists

### Acceptance Criteria (R-markers)

- R-P2-01 [frontend]: `apps/trucker/package.json` exists with `"expo"`, `"react-native"`, and `"expo-router"` as 3 required keys in `dependencies`; verified by `scripts/verify-expo-project.cjs` reading file via `fs.readFileSync` and asserting all 3 keys present in `JSON.parse(content).dependencies`
- R-P2-02 [frontend]: `apps/trucker/app.json` contains `expo.name`, `expo.slug`, `expo.scheme`, and `expo.platforms` including both `"ios"` and `"android"`; verified by `scripts/verify-expo-project.cjs` reading file and asserting JSON structure
- R-P2-03 [frontend]: `apps/trucker/eas.json` contains `build.development`, `build.preview`, and `build.production` profiles; verified by `scripts/verify-expo-project.cjs` reading file and asserting all 3 keys exist
- R-P2-04 [frontend]: `apps/trucker/src/app/_layout.tsx` exports `export default function RootLayout` that renders Expo Router `Slot` or `Stack`; verified by `scripts/verify-expo-project.cjs` reading file via `fs.readFileSync` and matching `/export default function RootLayout/` regex returning exactly 1 match
- R-P2-05 [frontend]: `apps/trucker/src/app/index.tsx` exists and contains `export default` matching `/export default/` regex with exactly 1 match; verified by `scripts/verify-expo-project.cjs` reading file via `fs.readFileSync`
- R-P2-06 [frontend]: `.gitignore` contains entries for `apps/trucker/node_modules/` and `apps/trucker/.expo/`; verified by `scripts/verify-expo-project.cjs` reading `.gitignore` via `fs.readFileSync` and asserting both patterns present via regex (at minimum these 2, additional entries allowed)

### Verification Command

```bash
node scripts/verify-expo-project.cjs
```

---

## Phase 3 -- Mobile Navigation Shell (module)

Build the tab-based navigation shell with Expo Router. Three tabs: Home,
Loads, Profile. Add an auth gate in the root layout that redirects
unauthenticated users to the (auth) group. No actual Firebase Auth yet --
just the navigation structure with a mock auth context.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/src/contexts/AuthContext.tsx` | React context with `isAuthenticated`, `user`, `login`, `logout` stubs | `scripts/verify-mobile-nav.cjs` | unit |
| MODIFY | `apps/trucker/src/app/_layout.tsx` | Wrap with AuthProvider, redirect to (auth) when not authenticated. NOTE: file created in Phase 2 | `scripts/verify-mobile-nav.cjs` | unit |
| ADD | `apps/trucker/src/app/(tabs)/_layout.tsx` | Tab navigator layout with Home, Loads, Profile tabs | `scripts/verify-mobile-nav.cjs` | unit |
| ADD | `apps/trucker/src/app/(tabs)/index.tsx` | Home tab screen placeholder | `scripts/verify-mobile-nav.cjs` | unit |
| ADD | `apps/trucker/src/app/(tabs)/loads.tsx` | Loads tab screen placeholder | `scripts/verify-mobile-nav.cjs` | unit |
| ADD | `apps/trucker/src/app/(tabs)/profile.tsx` | Profile tab screen placeholder | `scripts/verify-mobile-nav.cjs` | unit |
| ADD | `apps/trucker/src/app/(auth)/_layout.tsx` | Auth group layout (Stack navigator for login/signup) | `scripts/verify-mobile-nav.cjs` | unit |
| ADD | `apps/trucker/src/app/(auth)/login.tsx` | Login screen placeholder (form shell, no Firebase yet) | `scripts/verify-mobile-nav.cjs` | unit |
| ADD | `apps/trucker/src/app/(auth)/signup.tsx` | Signup screen placeholder (form shell, no Firebase yet) | `scripts/verify-mobile-nav.cjs` | unit |
| ADD | `scripts/verify-mobile-nav.cjs` | Verification script: asserts all route files exist, tab layout has 3 tabs, auth group has login/signup, AuthContext structure | `scripts/verify-mobile-nav.cjs` | unit |

### Untested Files

None -- all files have test coverage.

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `AuthContext` | `{ isAuthenticated: boolean, user: null \| AuthUser, login: (email, pw) => Promise<void>, logout: () => Promise<void> }` | Provider wraps app tree | Context value accessible via `useAuth()` hook | None (stub -- always succeeds) | `_layout.tsx` (root), all screens | React Context API |
| `(tabs)/_layout.tsx` | `export default function TabLayout()` | N/A | JSX: `<Tabs>` with 3 `<Tabs.Screen>` entries (index, loads, profile) | N/A | Expo Router (auto-detected from file path) | `expo-router/Tabs` |
| `(auth)/_layout.tsx` | `export default function AuthLayout()` | N/A | JSX: `<Stack>` with login/signup screens | N/A | Expo Router | `expo-router/Stack` |
| `login.tsx` | `export default function LoginScreen()` | N/A | JSX: form with email/password inputs + submit button | N/A | Expo Router (file-based) | `AuthContext.login()` |

### Data Flow

```
App launches
  --> _layout.tsx checks AuthContext.isAuthenticated
    --> false: redirect to (auth)/login
      --> login.tsx: user fills form, calls login()
        --> AuthContext sets isAuthenticated = true
          --> redirect to (tabs)/index (Home)
    --> true: render (tabs)/_layout.tsx
      --> Tab navigator: Home | Loads | Profile

Error paths:
  - AuthContext not wrapped: useAuth() throws "Must be within AuthProvider"
    --> Prevention: root _layout.tsx wraps entire tree
  - Missing tab route file: Expo Router shows 404 screen
    --> Prevention: all 3 tab files created in this phase
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| AuthContext provides default state | unit | Real | Pure React context, no external deps; renderHook | `apps/trucker/__tests__/contexts/AuthContext.test.tsx` |
| AuthContext login/logout toggles state | unit | Real | State management test via renderHook + act | `apps/trucker/__tests__/contexts/AuthContext.test.tsx` |
| Route files exist with correct exports | unit | Real | File structure assertions via fs.readFileSync | `scripts/verify-mobile-nav.cjs` |
| Tab layout has 3 tabs | unit | Real | Structural assertion via fs.readFileSync + regex | `scripts/verify-mobile-nav.cjs` |
| Auth group has login + signup | unit | Real | Structural assertion via fs.readFileSync + regex | `scripts/verify-mobile-nav.cjs` |

**Assertion blueprints:**
- `expect(result.current.isAuthenticated).toBe(false)` -- default unauthenticated
- `act(() => { result.current.login('test@test.com', 'pass') })` then `expect(result.current.isAuthenticated).toBe(true)` -- login works
- `assert(fs.existsSync('apps/trucker/src/app/(tabs)/loads.tsx'))` -- loads tab exists
- `assert(/Tabs\.Screen.*name.*index/.test(tabLayoutContent))` -- tab layout has index screen
- `assert(/Tabs\.Screen.*name.*loads/.test(tabLayoutContent))` -- tab layout has loads screen

### Acceptance Criteria (R-markers)

- R-P3-01 [frontend]: `apps/trucker/src/contexts/AuthContext.tsx` exports `AuthProvider` and `useAuth` hook; verified by `scripts/verify-mobile-nav.cjs` reading file via `fs.readFileSync` and asserting `/export.*AuthProvider/` and `/export.*useAuth/` regexes each return >= 1 match
- R-P3-02 [frontend]: `AuthContext.tsx` defines `isAuthenticated` state with default `false` and exposes `login` and `logout` functions; verified by `scripts/verify-mobile-nav.cjs` reading file and asserting `/isAuthenticated.*false/` and both `/login/` and `/logout/` patterns present
- R-P3-03 [frontend]: Tab layout at `apps/trucker/src/app/(tabs)/_layout.tsx` renders `Tabs` component with screen entries for `index`, `loads`, and `profile`; verified by `scripts/verify-mobile-nav.cjs` reading file via `fs.readFileSync` and asserting `/Tabs/` regex returns >= 1 match and file contains all 3 screen name strings
- R-P3-04 [frontend]: Auth group contains exactly 2 route files: `(auth)/login.tsx` and `(auth)/signup.tsx`; verified by `scripts/verify-mobile-nav.cjs` asserting `fs.existsSync` returns `true` for both paths under `apps/trucker/src/app/`
- R-P3-05 [frontend]: Root layout at `apps/trucker/src/app/_layout.tsx` wraps content with `<AuthProvider>` and contains redirect logic for unauthenticated users; verified by `scripts/verify-mobile-nav.cjs` reading file and asserting `/AuthProvider/` regex returns >= 1 match and `/Redirect|router\.replace/` returns >= 1 match
- R-P3-06 [frontend]: Login screen at `apps/trucker/src/app/(auth)/login.tsx` contains at least 2 `TextInput` components and 1 submit button (`Pressable` or `TouchableOpacity`); verified by `scripts/verify-mobile-nav.cjs` reading file and asserting `/TextInput/g` returns >= 2 matches and `/Pressable|TouchableOpacity/` returns >= 1 match
- R-P3-07 [frontend]: Signup screen at `apps/trucker/src/app/(auth)/signup.tsx` contains at least 2 `TextInput` components and 1 submit button; verified by `scripts/verify-mobile-nav.cjs` reading file and asserting `/TextInput/g` returns >= 2 matches and `/Pressable|TouchableOpacity/` returns >= 1 match

### Verification Command

```bash
node scripts/verify-mobile-nav.cjs
cd apps/trucker && npx tsc --noEmit && cd ../..
```

---

## Phase 4 -- Mobile Auth Integration (module)

Wire Firebase Auth into the mobile app's AuthContext. Create an API client
service for communicating with the Express backend. Login and signup screens
call Firebase Auth SDK and then validate the JWT against the existing
`server/auth.ts` middleware.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `apps/trucker/src/contexts/AuthContext.tsx` | Replace stubs with real Firebase Auth calls (signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut). NOTE: file created in Phase 3 | `scripts/verify-mobile-auth.cjs` | unit |
| ADD | `apps/trucker/src/services/api.ts` | Fetch wrapper: base URL from env, auto-attach Firebase ID token to Authorization header, error interceptor | `scripts/verify-mobile-auth.cjs` | unit |
| ADD | `apps/trucker/src/services/auth.ts` | Firebase Auth wrapper: initializeApp from env, getAuth, onAuthStateChanged listener | `scripts/verify-mobile-auth.cjs` | unit |
| ADD | `apps/trucker/src/config/firebase.ts` | Firebase config from `EXPO_PUBLIC_*` env vars (no hardcoded keys) | `scripts/verify-mobile-auth.cjs` | unit |
| ADD | `scripts/verify-mobile-auth.cjs` | Verification: AuthContext imports Firebase, api.ts attaches token, firebase config uses EXPO_PUBLIC_ prefix, 401 handling, network error wrapping | `scripts/verify-mobile-auth.cjs` | unit |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `apps/trucker/src/config/firebase.ts` | Config-only file, reads env vars | Integration: AuthContext.firebase.test.tsx mocks Firebase, which validates the config is consumed correctly |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `AuthContext.login` | `(email: string, password: string) => Promise<void>` | email, password strings | Sets `user` and `isAuthenticated: true` | `FirebaseError` with `code` (auth/wrong-password, auth/user-not-found, etc.) -- propagated to UI | `login.tsx` | `signInWithEmailAndPassword` (Firebase) |
| `AuthContext.signup` | `(email: string, password: string) => Promise<void>` | email, password strings | Sets `user` and `isAuthenticated: true` | `FirebaseError` with `code` (auth/email-already-in-use, auth/weak-password) | `signup.tsx` | `createUserWithEmailAndPassword` (Firebase) |
| `AuthContext.logout` | `() => Promise<void>` | None | Clears `user`, sets `isAuthenticated: false` | None expected | Profile tab, any screen | `signOut` (Firebase) |
| `api.ts` (default export) | `{ get, post, put, patch, delete }` | URL path, optional body/params | Response data (JSON parsed) | 401: triggers logout + redirect. Network error: throws with message. 4xx/5xx: throws with status + message | All mobile screens/services | `fetch` with Firebase ID token |
| `auth.ts` service | `{ initAuth, onAuthStateChanged, getCurrentUser }` | N/A | Auth state listener | Firebase init failure if config missing | `AuthContext` | Firebase Auth SDK |

### Data Flow

```
User taps Login button
  --> login.tsx calls AuthContext.login(email, password)
    --> AuthContext calls signInWithEmailAndPassword(auth, email, password)
      --> Firebase Auth returns UserCredential
        --> AuthContext stores user, sets isAuthenticated = true
          --> Root layout detects auth state change, navigates to (tabs)
    --> Error: Firebase returns auth/wrong-password
      --> AuthContext catches, sets error state
        --> login.tsx displays error message

API call from authenticated screen:
  --> Screen calls api.get('/api/loads')
    --> api.ts gets current user's ID token via getIdToken()
      --> Attaches as Authorization: Bearer <token>
        --> Express server verifyFirebaseToken middleware validates
          --> 200: returns data
          --> 401: api.ts calls AuthContext.logout(), redirect to login
          --> 500: api.ts throws error with message

Error paths:
  - Firebase config missing EXPO_PUBLIC_ vars: initializeApp fails
    --> Error boundary shows "Configuration error" screen
  - Network offline: fetch throws TypeError
    --> api.ts wraps in user-friendly "Network unavailable" error
  - Token expired: server returns 401
    --> api.ts auto-refreshes token (Firebase handles this), retries once
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| AuthContext.login calls Firebase | unit | Mock | External service: mock signInWithEmailAndPassword | `apps/trucker/__tests__/contexts/AuthContext.firebase.test.tsx` |
| AuthContext.login error propagation | unit | Mock | Simulate auth/wrong-password error from Firebase | `apps/trucker/__tests__/contexts/AuthContext.firebase.test.tsx` |
| AuthContext.signup calls Firebase | unit | Mock | External service: mock createUserWithEmailAndPassword | `apps/trucker/__tests__/contexts/AuthContext.firebase.test.tsx` |
| AuthContext.logout calls signOut | unit | Mock | External service: mock signOut | `apps/trucker/__tests__/contexts/AuthContext.firebase.test.tsx` |
| api.ts attaches auth header | unit | Mock | Network + external service: mock fetch + getIdToken | `apps/trucker/__tests__/services/api.test.ts` |
| api.ts intercepts 401 with logout | unit | Mock | Simulated error response: mock fetch returns 401 | `apps/trucker/__tests__/services/api.test.ts` |
| api.ts wraps network error | unit | Mock | Simulated network failure: mock fetch throws TypeError | `apps/trucker/__tests__/services/api.test.ts` |
| auth service initializes Firebase | unit | Mock | External service: mock Firebase SDK | `apps/trucker/__tests__/services/auth.test.ts` |
| Firebase config uses EXPO_PUBLIC_ prefix | unit | Real | Security requirement: fs.readFileSync + regex on config file | `scripts/verify-mobile-auth.cjs` |

**Assertion blueprints:**
- `expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'test@test.com', 'password')` -- login calls Firebase
- `expect(result.current.error).toBe('Invalid email or password')` -- error mapped
- `expect(mockFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: { Authorization: 'Bearer mock-token' } }))` -- token attached
- `expect(result.current.isAuthenticated).toBe(false)` -- logout clears state
- `assert(/EXPO_PUBLIC_FIREBASE/.test(configContent))` -- env var prefix correct

### Acceptance Criteria (R-markers)

- R-P4-01 [frontend]: `AuthContext.tsx` imports `signInWithEmailAndPassword` from Firebase Auth and calls it in the `login` function; verified by `scripts/verify-mobile-auth.cjs` reading file via `fs.readFileSync` and asserting `/signInWithEmailAndPassword/` regex returns >= 2 matches (import + call)
- R-P4-02 [frontend]: `AuthContext.tsx` contains error handling that maps Firebase error codes to user-friendly messages (at least `auth/wrong-password` and `auth/user-not-found`); verified by `scripts/verify-mobile-auth.cjs` asserting `/auth\/wrong-password|auth\/user-not-found/` regex returns >= 1 match
- R-P4-03 [frontend]: `AuthContext.tsx` imports `createUserWithEmailAndPassword` from Firebase Auth and calls it in the `signup` function; verified by `scripts/verify-mobile-auth.cjs` reading file and asserting `/createUserWithEmailAndPassword/` regex returns >= 2 matches (import + call)
- R-P4-04 [frontend]: `AuthContext.tsx` imports `signOut` from Firebase Auth and calls it in the `logout` function; verified by `scripts/verify-mobile-auth.cjs` reading file and asserting `/signOut/` regex returns >= 2 matches (import + call)
- R-P4-05 [frontend]: `apps/trucker/src/services/api.ts` attaches `Authorization: Bearer` header using Firebase ID token; verified by `scripts/verify-mobile-auth.cjs` reading file via `fs.readFileSync` and asserting `/Authorization.*Bearer/` regex returns >= 1 match and `/getIdToken/` returns >= 1 match
- R-P4-06 [frontend]: `api.ts` handles HTTP 401 responses by triggering logout or auth state clearing; verified by `scripts/verify-mobile-auth.cjs` reading file and asserting `/401/` and `/logout|signOut|clearAuth/` regexes each return >= 1 match
- R-P4-07 [frontend]: `api.ts` catches network errors (TypeError from fetch) and wraps them in user-friendly messages; verified by `scripts/verify-mobile-auth.cjs` reading file and asserting `/catch/` and `/network|Network|TypeError/` regexes each return >= 1 match
- R-P4-08 [frontend]: Firebase config at `apps/trucker/src/config/firebase.ts` reads all 6 Firebase config values from `EXPO_PUBLIC_FIREBASE_*` env vars and contains 0 hardcoded API key strings; verified by `scripts/verify-mobile-auth.cjs` reading file via `fs.readFileSync` and asserting `/EXPO_PUBLIC_FIREBASE/g` returns >= 6 matches and `/AIza[a-zA-Z0-9_-]{35}/` returns 0 matches

### Verification Command

```bash
node scripts/verify-mobile-auth.cjs
cd apps/trucker && npx tsc --noEmit && cd ../..
```

---

## Phase 5 -- Baseline Debt Cleanup (foundation)

Resolve the 3 baseline technical debt items from `docs/trucker-app-baseline-debt.md`:
1. jszip types for e2e spec
2. Windows PORT env compatibility
3. Missing `.claude/hooks/tests/` directory

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `e2e/tsconfig.json` or Playwright config | Add `@types/jszip` to e2e TypeScript compilation so `e2e/ifta-audit-packet-smoke.spec.ts` resolves JSZip import | `scripts/verify-baseline-debt-resolved.cjs` | unit |
| ADD | `server/__tests__/helpers/port-env.ts` | Helper that sets PORT env var cross-platform for integration tests (uses `process.env.PORT = '5000'` in JS, not shell syntax) | `scripts/verify-baseline-debt-resolved.cjs` | unit |
| ADD | `.claude/hooks/tests/__init__.py` | Create hooks tests directory with init file so pytest collection does not fail on absent directory | `scripts/verify-baseline-debt-resolved.cjs` | unit |
| MODIFY | `docs/trucker-app-baseline-debt.md` | Mark all 3 entries as resolved with resolution date and method | `scripts/verify-baseline-debt-resolved.cjs` | unit |
| ADD | `scripts/verify-baseline-debt-resolved.cjs` | Verification script: asserts each debt item is resolved | `scripts/verify-baseline-debt-resolved.cjs` | unit |

### Untested Files

None -- all files have test coverage via verification script.

### Interface Contracts

N/A -- Debt cleanup changes are isolated fixes with no new public interfaces.

### Data Flow

N/A -- No new data flows. Each fix is an isolated correction.

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| jszip types resolve in e2e | unit | Real | Compilation must succeed; fs.existsSync + tsc check | `scripts/verify-baseline-debt-resolved.cjs` |
| PORT env helper exists | unit | Real | File content assertion via fs.readFileSync + regex | `scripts/verify-baseline-debt-resolved.cjs` |
| hooks/tests/ directory exists | unit | Real | Directory existence check via fs.existsSync | `scripts/verify-baseline-debt-resolved.cjs` |
| Debt register updated | unit | Real | Content assertion via fs.readFileSync + regex | `scripts/verify-baseline-debt-resolved.cjs` |

**Assertion blueprints:**
- `assert(fs.existsSync('.claude/hooks/tests/__init__.py'))` -- hooks tests dir created
- `assert(fs.existsSync('server/__tests__/helpers/port-env.ts'))` -- port helper exists
- `assert(/resolved|closed|fixed/i.test(debtContent))` -- debt register shows resolution

### Acceptance Criteria (R-markers)

- R-P5-01 [integration]: `e2e/ifta-audit-packet-smoke.spec.ts` can resolve JSZip import without TS2307 error; verified by `scripts/verify-baseline-debt-resolved.cjs` checking that `@types/jszip` is in devDependencies or that a type declaration exists for jszip
- R-P5-02 [backend]: `server/__tests__/helpers/port-env.ts` exists and sets `process.env.PORT` to a test port value via JavaScript (not shell `PORT=5000` syntax); verified by `scripts/verify-baseline-debt-resolved.cjs` reading file via `fs.readFileSync` and asserting `process.env.PORT` assignment pattern
- R-P5-03 [integration]: `.claude/hooks/tests/` directory exists (created locally); verified by `scripts/verify-baseline-debt-resolved.cjs` asserting `fs.existsSync('.claude/hooks/tests/')` returns true. NOTE: directory is gitignored — worker creates it locally but does NOT stage it
- R-P5-04 [integration]: `docs/trucker-app-baseline-debt.md` contains resolution annotations for all 3 debt entries; verified by `scripts/verify-baseline-debt-resolved.cjs` reading file and asserting each original failure description has an adjacent resolution note

### Verification Command

```bash
node scripts/verify-baseline-debt-resolved.cjs
```

---

## Phase 6 -- SaaS Non-Regression Verification (e2e)

Run the full existing test suite to confirm the shared types extraction
(Phase 1) and workspace changes did not break any existing functionality.
Update sprint history and program docs.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `docs/trucker-app-sprint-history.md` | Append B2 entry with merge SHA, story count, summary | `scripts/verify-b2-completion.cjs` | unit |
| ADD | `scripts/verify-b2-completion.cjs` | Final verification: runs SaaS non-regression (existing vitest suites), confirms sprint history updated, validates all Phase 1-5 verification scripts pass | `scripts/verify-b2-completion.cjs` | unit |

### Untested Files

None.

### Interface Contracts

N/A -- This phase creates no new interfaces. It validates existing ones work.

### Data Flow

```
verify-b2-completion.cjs
  --> Spawns: npx vitest run (root frontend tests)
    --> Exit 0: PASS
    --> Exit non-0: FAIL (regression detected)
  --> Spawns: cd server && npx vitest run (server tests, excluding integration/regression/performance)
    --> Exit 0: PASS
    --> Exit non-0: FAIL (regression detected)
  --> Reads: docs/trucker-app-sprint-history.md
    --> Asserts: B2 entry present
  --> Runs: all verify-*.cjs scripts from Phases 1-5
    --> All exit 0: PASS
    --> Any exit non-0: FAIL

Error paths:
  - Regression found: test reports which test(s) failed
    --> Fix required before B2 can merge
  - Sprint history not updated: verification fails
    --> Must add B2 entry before final verification
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Existing frontend tests pass | e2e | Real | SaaS non-regression requirement via npx vitest run | `scripts/verify-b2-completion.cjs` |
| Existing server tests pass | e2e | Real | SaaS non-regression requirement via server vitest | `scripts/verify-b2-completion.cjs` |
| Sprint history has B2 entry | unit | Real | Documentation requirement via fs.readFileSync + regex | `scripts/verify-b2-completion.cjs` |
| All phase verify scripts pass | e2e | Real | End-to-end validation via child_process.spawnSync | `scripts/verify-b2-completion.cjs` |

**Assertion blueprints:**
- `assert(vitestFrontend.status === 0, 'Frontend tests failed')` -- non-regression
- `assert(vitestServer.status === 0, 'Server tests failed')` -- non-regression
- `assert(/## Sprint B2/.test(historyContent))` -- sprint history updated
- `assert(/Shipped|Complete/i.test(b2Section))` -- status recorded

### Acceptance Criteria (R-markers)

- R-P6-01 [frontend]: `npx vitest run` from project root exits with code 0, confirming all existing frontend tests pass after shared types extraction; verified by `scripts/verify-b2-completion.cjs` spawning process and asserting exit code
- R-P6-02 [backend]: `cd server && npx vitest run --exclude=__tests__/integration/** --exclude=__tests__/regression/** --exclude=__tests__/performance/**` exits with code 0, confirming all existing server tests pass; verified by `scripts/verify-b2-completion.cjs` spawning process and asserting exit code
- R-P6-03 [integration]: `docs/trucker-app-sprint-history.md` contains a `## Sprint B2` section with `Stories` row showing "6" and `Status` showing "Engineering Complete"; verified by `scripts/verify-b2-completion.cjs` reading file via `fs.readFileSync` and asserting `/## Sprint B2/` heading exists and `/Stories.*6/` pattern matches
- R-P6-04 [integration]: All 5 Phase 1-5 verification scripts (`verify-shared-package.cjs`, `verify-expo-project.cjs`, `verify-mobile-nav.cjs`, `verify-mobile-auth.cjs`, `verify-baseline-debt-resolved.cjs`) exit with code 0; verified by `scripts/verify-b2-completion.cjs` spawning each and asserting all 5 exit codes equal 0
- R-P6-05 [integration]: If any existing test fails during regression run, `verify-b2-completion.cjs` returns non-zero exit code and reports the failing test name in stdout; verified by the script's error-path logic that captures stderr from vitest and includes it in the failure message

### Verification Command

```bash
node scripts/verify-b2-completion.cjs
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Shared types extraction breaks existing frontend imports | Medium | High | Root `types.ts` becomes re-export shim; zero import changes needed in consuming files. Phase 6 runs full test suite. |
| npm workspaces change `npm install` behavior for existing devs | Low | Medium | Workspace scope is `packages/*` only. Root and server `npm install` unchanged. |
| Expo SDK version conflicts with React 19 | Low | High | `apps/trucker/` has its own `package.json` with own React Native version. Completely isolated from web app. |
| EAS Build requires paid Expo account | Low | Low | EAS config is file-only (eas.json). Local dev build works without account. EAS cloud is an operator gate, not an R-marker. |
| React Native version mismatch with Expo SDK | Low | Medium | Use `create-expo-app` for version-locked initialization. Pin to Expo SDK 55. |
| Firebase Auth in mobile differs from web Firebase SDK | Low | Medium | Both use `firebase/auth` package. Mobile uses same signInWithEmailAndPassword API. |
| jszip types fix may need new devDependency | Very Low | Low | `@types/jszip` already available on npm; additive devDep change only. |

## Dependencies

### Internal
- Sprint B1 complete (confirmed -- PR #60, SHA `8a1e9b2`)
- `types.ts` (root) -- canonical source for shared types
- `server/auth.ts` -- Firebase Admin token verification (consumed by mobile via API)
- `.gitignore` -- must be updated for new directories

### External
- Expo SDK 55 (latest stable)
- `expo-router` v4+ (file-based routing)
- Firebase JS SDK (same version as web: `^12.7.0`)
- `@types/jszip` (for baseline debt fix)

## Rollback Plan

1. **Shared types extraction**: Restore original `types.ts` content from git, remove `packages/shared/`, remove workspace config from root `package.json`, remove path alias from `tsconfig.json`.
2. **Expo project**: Delete `apps/trucker/` directory entirely. No other files affected.
3. **Baseline debt**: Revert individual file changes. Debt items return to open status.
4. **Full rollback**: `git revert` the merge commit. All changes are on a feature branch; main is untouched until merge.

## Open Questions

None -- all decisions are locked from B1 (peer layout, npm, no Turborepo) and brainstorm analysis confirmed Option 1 (B2 alone) as the recommended approach.

## Parallelism Strategy

```
Phase 1 (Shared Types)  |  Phase 2 (Expo Init)  |  Phase 5 (Baseline Debt)
         |                        |
         v                        v
Phase 3 (Nav Shell) -- depends on Phase 2
         |
         v
Phase 4 (Mobile Auth) -- depends on Phase 3
         |
         v
Phase 6 (SaaS Non-Regression) -- depends on ALL above
```

**Parallel group A**: Phases 1, 2, 5 (independent, no shared files)
**Sequential after A**: Phase 3 depends on Phase 2
**Sequential after 3**: Phase 4 depends on Phase 3
**Final gate**: Phase 6 depends on all phases

## Sprint B2 Contract

**Branch**: `ralph/trucker-app-sprint-b2`
**Phases**: 6
**Story count**: 6 stories / 37 R-markers
**Dispatch gate**: Sprint B1 merged (confirmed -- PR #60, SHA `8a1e9b2`)
**External accounts**: None required for R-markers (EAS Build is operator gate)
**Parallelism**: STORY-001, STORY-002, STORY-005 parallel; STORY-003 depends on 002; STORY-004 depends on 003; STORY-006 depends on all
**SaaS non-regression gate**: YES -- Phase 1 touches type system
**Mobile domain layering rule**: `apps/trucker/` is peer to root web app

### Files NOT touched
- `server/index.ts` (FROZEN for B2)
- `server/routes/*` (FROZEN)
- `server/services/*` (FROZEN)
- `server/migrations/*` (FROZEN)
- `components/*` (FROZEN -- web UI untouched)
- `services/*` (FROZEN -- web services untouched)
- `App.tsx` (FROZEN)

### Targeted verification command (Windows-safe)
```bash
node scripts/verify-shared-package.cjs
node scripts/verify-expo-project.cjs
node scripts/verify-mobile-nav.cjs
node scripts/verify-mobile-auth.cjs
node scripts/verify-baseline-debt-resolved.cjs
node scripts/verify-b2-completion.cjs
```

### Exit artifact
- PR `Sprint B2: Mobile app bootstrap + shared types + baseline debt`
- All 31 R-markers green (R-P1-01..R-P6-05)
- `docs/trucker-app-sprint-history.md` appended with B2 merge SHA

## Ralph dispatch invariants

1. Worktree isolation per story worker
2. Checkpoint hash before each story
3. Feature branch `ralph/trucker-app-sprint-b2`
4. 4-checkpoint TDD (Red -> Green -> Refactor -> Gate)
5. Selective staging (no `git add -A`)
6. Format before commit
7. Fixture validation (collect-only)
8. Circuit breaker (3 consecutive skips -> halt)
9. `needs_verify` cleared before next sprint dispatch
10. `npm ci` (not `npm install`) in all verifications
11. All R-marker assertions use `fs.readFileSync` + regex (no shell `grep`)
