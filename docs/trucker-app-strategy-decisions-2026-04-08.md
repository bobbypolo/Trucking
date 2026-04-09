# Trucker App & BSD Strategy — Consolidated Decisions Memo

Date: 2026-04-08
Status: Living document. Updated after 9-agent parallel research pass + session state reconciliation.

## Executive Summary

**Ship the demo and build the trucker-app in parallel.** Freemium 1-truck + tiered fleet pricing is the wedge. Motive is the Day-1 ELD partner (self-serve OAuth, no sales-led partnership). The durable moat is the internal trip-to-settlement loop plus a facility dwell-time index byproduct — **not** a broker ratings network. The BSD demo can execute in ~5 days (MVP: Phases 1+2+4+6) starting the moment STORY-005 and STORY-006 merge, with trucker-app planning happening in parallel to BSD execution. All three workstreams can run concurrently given the user's confirmed 100% capacity, bounded by one narrow technical constraint: Ralph's single-writer workflow state requires either sequential plans OR a two-repo-clone setup.

## State Snapshot (verified via workflow-state.json + git log at 2026-04-08)

**Remediation sprint — 4 of 6 passed**:
- ✅ STORY-001 Parties Schema Fix — `bcb8a6f`, verified `6335e16`
- ✅ STORY-002 Polling Layer — `8564ccb`, verified `fb3925e`
- ✅ STORY-003 Issue Board Create Handler — `f3019ba`, verified `b1f5bc2`
- ✅ STORY-004 Load Equipment + Dispatcher Intake — `a0ab793`, verified `9aded6e`
- 🟨 STORY-005 Driver Intake Flow — running now, attempt 1, checkpoint `9aded6e`
- ⏳ STORY-006 E2E Regression Suite — pending

**Notable mid-sprint infrastructure commit**: `17f8d99 chore(infra): track .claude/hooks + rules + settings for worktree dispatch`. This was committed during the current sprint and appears to track previously-gitignored `.claude/hooks/*.py` files. **If verified working**, the worktree isolation mechanism may now be functional — which unlocks true parallel Ralph dispatch. This needs verification before we plan on it.

**Working tree**: clean except for untracked ChatGPT research memo (`docs/trucker-app-feature-research-2026-04-08.md`).

## Decisions Locked In

### Pricing & Packaging — Option B validated

**Model**: Freemium 1-truck owner-op wedge + per-truck tiered fleet pricing
- **Free**: 1 truck, AI BOL capture + basic dispatch + 50 docs/month
- **Tier 1 ($19/truck/month)**: 2-5 trucks, full features, unlimited docs
- **Tier 2 ($39/truck/month)**: 6-50 trucks, full features + multi-user permissions
- **Enterprise (custom)**: 50+ trucks

**Rationale**:
- Owner-operators are already spending **$150-$400/month per truck** across 6-10 disconnected tools (ELD, accounting, load board, factoring, 2290 filing, maintenance). This is 3-4x higher than I'd assumed.
- Pain threshold for adding a NEW tool is $30-50/month — MUST replace existing line items. Our pitch becomes "consolidate 3 tools, save $100/month."
- **No incumbent owns the freemium position** in trucking SaaS. Rose Rocket and UROUTE have tried but didn't stick. The AI-first paperwork wedge is inherently PLG-compatible (driver installs app, captures BOL, value is immediate).
- Samsara's 3-year contract lock-in is our positioning anvil. "No hardware, no contract, free to start."

**Caveat**: the free tier's AI extraction cost must be capped hard (per-account monthly limit on Gemini calls) to prevent runaway infra cost. This is a 1-2 hour implementation.

**Sources**: Agent 1 pricing research (Motive, Samsara, TruckLogics, Verizon Connect, Trimble, McLeod, Geotab, RigBooks, ProTransport, Vektor, HOS247).

### ELD Partner — Motive wins Phase 1

**Phase 1 partner**: **Motive** (formerly KeepTruckin)
- ~120,000 fleets, EXACTLY in our 5-50 truck ICP (Motive ACV $5k vs Samsara $17k → Motive is the SMB player)
- **Public self-serve developer portal** at `developer.gomotive.com`: OAuth 2.0, REST, webhooks, marketplace listing path
- **No sales-led partnership contract required** — we can register a dev account and start building immediately
- FMCSA-certified
- Quality: 5/5 (best-in-SMB developer experience)

**Phase 2 partner**: **Samsara** (for fleets that graduate to mid-market)
- Best-in-industry API docs and 150 req/s rate limits
- 350+ existing integrations, Technology Partner Program (application required)
- Skews enterprise, higher ACV

**Explicitly NOT recommended**:
- **Geotab**: Strong but RPC-style SDK (not REST), no OAuth 2.0. Mature but friction.
- **Verizon Connect**: Gated/legacy docs, declining SMB share
- **Omnitracs/Solera**: No public developer portal
- **Switchboard**: Growing but no public docs
- **Garmin eLog**: Data stays on phone via Bluetooth, no cloud API

**Action**: Register a Motive developer account this week. No negotiation, no sales call, no waiting.

**Sources**: Agent 2 ELD partner research.

### Driver Authentication UX

**Primary flow**: Dispatcher-invite via SMS deep link (branded `disbatch.me/i/AB12CD` or similar)
- 5 of 6 apps surveyed use dispatcher-invite exclusively (Samsara, Geotab, TruckLogics, EROAD, Motive for paid tier)
- Only Motive offers self-signup, and only for the free tier
- SMS > email for truckers (email deliverability and check frequency is poor)

**Secondary flow**: Self-signup for owner-operators (free tier)
- Owner asks for USDOT/MC number, light verification, single-user carrier account

**Language**: Spanish + English from day 1
- **23% of US truck drivers are Hispanic/Latino** (2022 data, up from 14.9% in 2010)
- None of Motive/Samsara/Geotab/EROAD ship Spanish UI — this is a cheap differentiator
- Language picker on the login screen itself, defaults to device locale

**Offline auth pattern**:
1. Long-lived refresh token (30-90 days) bound to device ID
2. Biometric unlock (Face ID / Touch ID) gates cached session
3. Access token rotates every 15 minutes when online
4. Background sync reconciles on reconnect

**Flow diagram**:
```
Dispatcher creates driver → SMS branded deep link →
Deep link opens app (or App Store deferred link) →
Language picker → Password + biometric setup →
CDL camera capture (queued offline-encrypted) →
Long-lived refresh token issued →
Offline session cached, biometric unlock thereafter
```

**Sources**: Agent 3 driver auth UX research.

### Owner-Operator Persona — Primary target confirmed

**Market size**: ~922,854 registered US owner-operators (late 2023)
- 16% of US truck drivers
- **91.5% of carriers operate ≤10 trucks, 99.3% <100** — our 1-50 truck ICP covers 99.3% of the market
- Under pressure (3-year freight recession, 2025 rev/mile -3.7%) but not shrinking structurally

**Persona**: Median age mid-40s to mid-50s, male, ex-company-driver-gone-independent
- Tech comfort is **bimodal**: 60-70% use smartphones daily, but only a minority use integrated back-office software
- Decision-making is price-sensitive and peer-driven (YouTube, TruckersReport forum, OOIDA)
- Distrusts enterprise sales pitches; responds to "built by truckers for truckers" framing
- High churn when tools break mid-load

**Top 5 pain points (2025, ranked by ATRI Critical Issues survey)**:
1. **Broker fraud and non-payment** — the #1 concern. Double-brokered loads, 60-90 day net terms killing cash flow. This is NEW to the top of the list in 2025.
2. **Thin/collapsing margins** — 5-15% net, diesel and insurance volatility
3. **Finding quality freight** — deadhead miles, load board fatigue
4. **Compliance admin overhead** — IFTA quarterly, 2290, IRP, UCR, Clearinghouse
5. **Maintenance surprises** — unplanned repairs erase a quarter's profit

**Current tooling stack** (6-10 disconnected tools):
- ELD: Motive / Garmin eLog / Rand McNally
- Accounting: RigBooks / TruckLogics / QuickBooks
- Load boards: DAT / Truckstop / 123Loadboard
- Fuel cards: EFS / RTS / TCH
- Navigation: Trucker Path / Google Maps
- Factoring: Apex / Bobtail
- 2290 filing: eForm2290 / ExpressTruckTax

**Monthly SaaS spend**: $150-$400/truck/month total. Pain threshold for a new tool is $30-50/month (must replace existing).

**Strategic implication**: Owner-operators are **the trojan horse into small fleets**. A tool that starts with an owner-op (free tier), grows with them as they add trucks to 5-50, is both a primary target AND an acquisition funnel for the paid tier.

**Go-to-market channels**: OOIDA, TruckersReport.com, r/Truckers, r/OwnerOperator, YouTube (Red Viking Trucker, Smart Trucker, Trucker Josh, Large Car Rich), MATS/GATS trade shows, Overdrive magazine, Land Line (OOIDA publication), FreightWaves podcasts, Pilot/Loves/TA truck stop counter displays.

**Sources**: Agent 4 owner-operator segment research.

### Data Moat Strategy — Facility Dwell Index, NOT Broker Ratings

**DON'T invest in broker ratings as a moat.**
- CarrierAssure has 10,000 users at $149/mo and is publicly criticized for accuracy in Overdrive
- Highway, DAT, Truckstop own structural choke points (ELD networks, load board liquidity, tender feeds)
- A small-fleet SaaS can't meaningfully contribute to broker rating networks at sub-3,000 user scale
- The "Intelligence tab" already in the codebase (commit `fb16930`) is good PRODUCT but not a defensible MOAT

**DO invest in facility dwell-time index.**
- The market is fragmented (FourKites/ATRI own pieces; nobody at the SMB level)
- **FMCSA is actively soliciting this data** (Federal Register filing, 2024)
- Every dispatch event our fleets log is a data point nobody else captures for small carriers
- Treat it as a **byproduct of the trip-to-settlement loop** — no net-new work, just a repositioning of the data we already capture

**Durable moat (ranked by defensibility)**:
1. **Trip-to-settlement loop closure** (internal) — every doc captured creates value across IFTA, settlement, compliance, audit simultaneously. Competitors have organizational debt preventing them from retrofitting this.
2. **Trip-centered data model** (architectural) — schema decisions compound. Retrofitting to trip-primary requires a rewrite.
3. **Facility dwell-time index** (external byproduct) — unique at the small-fleet level, FMCSA-endorsed collection opportunity.
4. **AI-first paperwork intake** (sales wedge, NOT durable moat long-term — any team can replicate with Gemini/GPT/Claude in 6 months). The moat is the workflow integration AROUND the AI, not the AI itself.

**Sources**: Agent 5 broker network research.

## Strategic Pivots (things that changed)

### 1. Broker fraud is the #1 pain point — this shifts feature priority

The ATRI 2025 Critical Issues survey puts broker fraud/non-payment at #1 for small carriers. This wasn't on my radar. Implications:
- **Consider adding a "broker credit watchlist"** as a near-term feature — fed by our own tenants' invoice aging data. Every invoice we see gives us a data point on broker payment reliability. This is a byproduct of the trip-to-settlement loop.
- **Invoice aging + payment reliability scoring** could be a hero demo beat on its own.
- This might be the HIGHER-ROI near-term feature than audit packet export. Or they tie for #1.

### 2. The AI demo patch is simpler than I thought — 1-2 hours, not a sprint

Agent 7 found that `server/middleware/idempotency.ts` already has a SHA-256 request-hash utility (`computeRequestHash()`) that the demo-mode gate can reuse directly. The implementation is a ~40-line conditional block in `server/routes/ai.ts` plus 2-3 fixture extractions. **Zero architectural changes, zero Ralph sprint needed**. It's a plan edit + inline code change.

This means the BSD Phase 2 AI hero patch can happen AT THE SAME TIME the rest of BSD is being executed, not as a prerequisite.

### 3. The audit packet MVP is 5-6 days — surprisingly cheap

Agent 8 found that the IFTA data model is essentially complete (tables `mileage_jurisdiction`, `fuel_ledger`, `ifta_trips_audit`, `ifta_trip_evidence`, `documents` all exist). IFTA routes exist. The PDF export service exists (`services/exportService.ts` uses jsPDF). The only missing pieces are:
- JSZip for bundling (npm install)
- Cover letter PDF template
- 1 new table `ifta_audit_packets`
- "Generate Audit Packet" button in IFTAManager
- `POST /api/accounting/ifta-audit-packet` route

**5-6 days MVP, 25-30 days polished state-specific version.** Demo wow factor 4/5 because "audit packet in 3 seconds" is a tangible outcome any owner-op immediately understands.

**This should be the trucker-app's Phase 1 "quick win" feature**, not deferred to Phase 2 as ChatGPT's memo suggested. It's cheaper than I thought and its ROI is immediate.

### 4. The demo hero has a "continuity wow" moment I hadn't identified

Agent 6 surfaced that **ACME Logistics LLC appearing in TWO contexts** (as the broker on the hero load LP-DEMO-RC-001, then again in the Network Portal CRM with 6 tabs of depth) is the demo's killer moment. Same object, two views, different beats — this registers as "it's all one system, not a bunch of bolted-on tools."

This should be the central narrative of every BSD demo run. The BSD plan already enables this via Phases 2 and 4 — I just didn't see the narrative device before.

### 5. Spanish-first onboarding is cheap and differentiating

None of the majors (Motive, Samsara, Geotab, EROAD) ship Spanish UI. TruckX and Dispatch Science do, as niche differentiators. With 23% of US drivers being Hispanic/Latino, this is table stakes for new entrants. Budget: ~3-5 days of i18n infrastructure + translation work. Major competitive advantage for cost.

### 6. The worktree mechanism may already be fixed

Commit `17f8d99 chore(infra): track .claude/hooks + rules + settings for worktree dispatch` landed during this sprint. If this successfully tracks the previously-gitignored hook files, the Agent-tool `isolation: worktree` mechanism may be working again. **Needs verification** before we count on it, but if verified, this means:
- The `feedback_worktree_isolation_override_2026_04_07.md` memory can be retired
- Parallel Ralph dispatch becomes technically feasible again
- Task #1 (investigate broken worktree isolation) may already be partially done

**Verification action**: After STORY-005/006 finish, run a test worktree dispatch and confirm all 17 `.claude/hooks/*.py` files are present in the worktree.

## Execution Plan (given 100% user capacity)

### Phase 0 — NOW (hours, not days)

- STORY-005 is currently running. STORY-006 follows. **Do not interfere.**
- The user can use this time for strategic decisions (answering the open questions at the bottom of this memo) and for non-Ralph prep work (registering Motive developer account, setting up OOIDA reader account, outreach list building).

### Phase 1 — Remediation PR Merge (Day 0-1 after remediation finishes)

- Review remediation sprint PR
- Run `/audit` on the final state
- Merge `ralph/pre-demo-remediation` → `main`
- Verify worktree fix commit `17f8d99` actually works (test dispatch)
- If worktree works: retire the override memory, update Task #1 as resolved
- If worktree does not work: keep branch-inline mode, escalate Task #1

### Phase 2 — BSD Patch & Dispatch (Day 1-2)

**Inline plan edits (human, ~1-2 hours)**:
1. Patch `PLAN-bulletproof-sales-demo.md` Phase 2 to add the AI paper-to-load hero demo gate (~40 lines + 3-4 new R-markers)
2. Regenerate `prd.json` via `prd_generator.py`
3. Commit as `fix(plan): add AI hero demo moment to BSD Phase 2`

**Optional pre-BSD additions (user decision)**:
- Add "broker credit watchlist" as a new BSD Phase 8 OR as a post-BSD Phase 1 trucker-app feature
- Add "IFTA audit packet MVP" as a new BSD Phase 8 OR as a post-BSD Phase 1 trucker-app feature

**Start BSD Ralph dispatch**: `/ralph` targeting `ralph/bulletproof-sales-demo` branch. Estimated: 5 days for MVP (Phases 1+2+4+6), 10-14 days for full 7 phases.

### Phase 3 — BSD Execution + Trucker-App Planning IN PARALLEL (Days 2-10)

**Track A (Ralph)**: BSD execution on `ralph/bulletproof-sales-demo`. This is Ralph's autonomous work — user reviews commits and approves gates.

**Track B (Human + conversation)**: Draft `.claude/docs/PLAN-trucker-app.md`. I'll write this in parallel with BSD execution. It doesn't conflict with BSD because it's a new file in a different part of `.claude/docs/`. Target structure:
- Phase 1 Foundation: Monorepo setup (`apps/web` + `apps/trucker` + `packages/shared`), Expo + RN scaffold, shared API client
- Phase 2 Core mobile: Trip workspace, auth flow (SMS deep link + biometric + Spanish), offline-first doc capture queue
- Phase 3 ELD integration: Motive OAuth + HOS data sync
- Phase 4 Audit packet export: MVP (5-6 days) — highest-ROI quick win
- Phase 5 Compliance hub: IRP, UCR, 2290, permit manager, Clearinghouse reminders
- Phase 6 Broker credit watchlist: invoice aging + payment reliability scoring (fed by tenant data)
- Phase 7 Pricing tier integration: freemium limits, Stripe integration
- Phase 8 Facility dwell index: trip-to-settlement loop data export + FMCSA submission pipeline

**Track C (Non-code human work)**:
- Register Motive developer account
- Register Samsara Technology Partner application (longer approval cycle — start early)
- Outreach list building: OOIDA, TruckersReport.com, YouTube channels, podcasts
- Customer interviews for pricing validation (10 owner-ops)
- Trademark search for "DisbatchMe" / "LoadPilot" / whatever the trucker-app brand will be
- Domain registration for the trucker-app landing page

### Phase 4 — BSD Merge + Trucker-App Sprint Kickoff (Day 10-14)

- BSD PR merges to main
- Sales demo is ready
- Start running demos to prospects (cold outreach + OOIDA community)
- `/ralph` dispatches on `PLAN-trucker-app.md` targeting `ralph/trucker-app` branch
- **Note**: If the worktree fix landed, this can happen in a single repo. If not, consider the two-clones workaround (clone the repo to `F:/Trucking/DisbatchMe-trucker-app`, run Ralph there independently).

### Phase 5 — Trucker-App Build + Sales Motion IN PARALLEL (Weeks 2-10)

Ralph builds trucker-app phases sequentially. Meanwhile:
- Sales demo runs on BSD
- Customer discovery interviews inform trucker-app Phase 2+ priorities
- Early access / design partner program for the trucker-app (free for 3-6 months in exchange for feedback)

## Minimum Viable Demo (if the user wants to accelerate)

If "demo ready this week" takes priority over polish:

**Skip** Phase 3 (IFTA walkthrough) and Phase 5 (automated regression) and Phase 7 (Windows certify) from BSD. Run the critical path only:
- **Phase 1**: Seed pipeline (non-negotiable — no demo without this)
- **Phase 2**: Hero load + broker + AI demo gate (non-negotiable — this IS the hero)
- **Phase 4**: CRM Registry Depth (non-negotiable — this is the "continuity wow" moment)
- **Phase 6**: Demo shell with nav allowlist + reset button (non-negotiable — demo looks broken without it)

**Estimated time**: 5 Ralph days (3-4 for a practiced operator). Ships a usable but narrative-thinner demo. CAN HAPPEN AT THE SAME TIME AS trucker-app planning doc drafting.

**Recommendation**: Do the MVP BSD (Phases 1+2+4+6) NOT the full 7-phase BSD. It's 50% faster and still delivers both hero beats (AI extraction + CRM continuity). Add Phases 3/5/7 in a follow-up polish sprint if needed after closing the first 3-5 customers.

## Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Worktree fix (17f8d99) doesn't actually work | Medium | Low | Fall back to branch-inline sequential dispatch. Two-clones workaround for parallelism. |
| 2 | BSD MVP skips Phase 3 (IFTA) and prospects ask about IFTA | Medium | Medium | Have a screenshot or Loom video ready as a backup. Phase 3 is ~2 days to add back if needed. |
| 3 | Gemini model variability in AI demo even with caching | Low | High | Demo-mode gate bypasses Gemini entirely for demo tenant. Test thoroughly with the exact fixture BOL. |
| 4 | Motive developer account application delayed | Low | Medium | Self-serve portal, no approval queue known. If blocked, proceed with Samsara application in parallel. |
| 5 | Trucker-app planning drifts from BSD demo scope | Medium | Medium | Trucker-app PLAN's first section is "what this is NOT" referencing BSD Phase 6 nav allowlist verbatim. |
| 6 | Solo engineer burnout despite 100% capacity claim | Low (user asserted) | High | Buffer between BSD completion and trucker-app start. Don't stack two Ralph sprints back-to-back. |
| 7 | Free tier AI extraction costs exceed budget | Medium | Medium | Per-account monthly limit on Gemini calls. Rate-limit at API layer. Show upgrade prompt when limit hit. |
| 8 | Spanish translation inaccuracies in compliance UI | Medium | High (legal) | Use professional translator for legal/compliance strings, not machine translation. Separate i18n layer for user-facing vs legal strings. |

## Open Questions Requiring User Decision

1. **BSD scope — full 7 phases or MVP (1+2+4+6)?** MVP is 5 days vs. 10-14 days for full. MVP ships 2x faster but loses IFTA walkthrough, automated regression, and Windows certification. Both paths lead to a working demo.

2. **Which feature ships first in trucker-app Phase 1 — audit packet export or broker credit watchlist?** Audit packet export is 5-6 days and has the clearest demo wow. Broker credit watchlist targets the #1 pain point in 2025 (broker fraud) but implementation complexity is unknown (needs its own research pass).

3. **Trucker-app stack — React Native (Expo) or Capacitor or PWA?** Agent 9 recommends RN+Expo because of offline-first and native APIs. This is a hard decision by Week 4 of the execution plan. I recommend RN+Expo.

4. **Monorepo or separate repo for trucker-app?** Agent 9 recommends monorepo (`apps/web` + `apps/trucker` + `packages/shared`) because it's simpler for a solo dev. Separate repo doubles CI/CD surface. I recommend monorepo.

5. **BSD Phase 2 AI hero patch — plan edit only, or plan edit + Ralph verification mini-sprint?** Plan edit is ~1-2 hours. Ralph verification adds another 4-6 hours but guarantees determinism in tests.

6. **Register Motive developer account now or after BSD ships?** Zero cost to register now; early access to API docs; can start prototyping the ELD integration plan while BSD executes.

7. **Add broker fraud / payment reliability as a new BSD phase (Phase 8) before BSD dispatch?** Would add ~3-5 days to BSD. Could be a powerful demo beat given ATRI's #1 pain point finding. OR defer to trucker-app Phase 6.

8. **Should I write `PLAN-trucker-app.md` right now (while STORY-005/006 are running) or wait until BSD dispatch?** Writing now means the plan is ready the moment BSD dispatches. Writing later means I'll have seen BSD's actual output to inform the trucker-app plan. I recommend: **write a DRAFT now, refine after BSD Phase 2 lands**.

## Critical Next Actions

In order of execution readiness:

1. **User decision** (answers to 8 questions above) — unblocks everything else
2. **STORY-005 completion** — Ralph handles, no user action needed until review
3. **STORY-006 completion** — same
4. **Remediation PR review + merge** — user action, estimated 30-60 min
5. **Verify worktree fix `17f8d99`** — I can run a test dispatch post-merge (15 min)
6. **Retire or keep the worktree override memory** based on verification
7. **Patch BSD Phase 2 with AI hero demo gate** — I can do this inline (~1-2 hours of plan editing)
8. **Optionally add BSD Phase 8 (broker credit watchlist)** if user chooses — adds 3-5 days to BSD
9. **Write `PLAN-trucker-app.md` draft** — I can start this while STORY-005/006 run if user approves
10. **Register Motive developer account** — user action, ~30 min
11. **Dispatch BSD Ralph sprint** — I handle
12. **Run BSD + draft trucker-app PLAN refinement in parallel** — Ralph + I handle
13. **BSD merges to main** — user action (review + approve)
14. **Dispatch trucker-app Ralph sprint** — I handle (single repo if worktree works, two-clones workaround if not)
15. **Start sales motion while trucker-app builds** — user action, parallel with Ralph

## Architectural Decisions (summarized for the trucker-app plan file)

These go into `PLAN-trucker-app.md` when it gets drafted:

- **Backend**: One backend (existing Node.js + Express + Firebase + MySQL). No fork. Trucker-app consumes the same API as the web dispatch console.
- **Frontend structure**: Monorepo with `apps/web` (existing Vite + React web app), `apps/trucker` (new Expo + React Native mobile app), `packages/shared` (API client, types, utilities, design tokens).
- **Mobile stack**: Expo SDK (latest stable) + React Native. TypeScript. React Navigation. React Query for API state. Zustand for local state. Tamagui or NativeWind for styling (TBD).
- **Offline-first architecture**: Local SQLite cache (via `expo-sqlite`) + action queue for offline writes + background sync. Document intake captures images locally-encrypted and queues for upload.
- **Auth**: Firebase Auth (existing) + SMS deep link invite flow + biometric unlock + 30-90 day refresh tokens.
- **Push notifications**: Expo Push Service (native). Used for detention alerts, appointment changes, load offers, driver messages.
- **ELD**: Motive API Phase 1, Samsara API Phase 2. OAuth per-tenant-admin authorization. HOS + GPS + DVIR + driver identity data.
- **I18n**: English + Spanish from day 1. Professional translation for legal/compliance strings.
- **Build/deploy**: EAS Build for OTA updates, App Store + Play Store submission, separate staging/production bundles.
- **Testing**: React Native Testing Library + Jest for unit; Detox for E2E on emulator; manual device testing on both iOS and Android.

## Appendix: Where to find the full agent reports

All 9 agent reports are in the conversation history (not yet persisted to disk). Key data:

- **Agent 1 (Pricing)**: Competitor pricing matrix, owner-op budget reality, freemium example (Rose Rocket), 3 pricing options with Option B recommended
- **Agent 2 (ELD)**: 8 ELD providers compared, Motive as Phase 1 pick with rationale, integration complexity matrix
- **Agent 3 (Driver Auth UX)**: Competitive scan of 5 driver apps, offline auth patterns, invite vs self-signup analysis, multi-language research
- **Agent 4 (Owner-Op Persona)**: FMCSA market sizing, persona profile, top 5 pain points (broker fraud #1), tooling stack, GTM channels
- **Agent 5 (Broker Network Moat)**: Competitive scan of broker rating platforms, network effect analysis, facility dwell index as alternative moat
- **Agent 6 (Demo Beats)**: 12 candidate demo beats ranked, hero flow validation, continuity wow moment identification, demo-killers to avoid
- **Agent 7 (AI Feasibility)**: End-to-end flow mapping, idempotency infrastructure reuse, 1-2 hour implementation sketch, zero dependencies on STORY-004+
- **Agent 8 (Audit Packet)**: IFTA data model audit, 5-6 day MVP vs 25-30 day polished version, state-specific compliance requirements
- **Agent 9 (Parallel Execution)**: File contention analysis, 4-week Gantt, minimum viable BSD breakdown, point-of-no-return decisions

Next revision of this memo should include the full agent reports as appendices if they need to be preserved for future reference.

---

*Last updated: 2026-04-08 by orchestrator consolidation pass after 9 parallel research agents returned + workflow state reconciliation*
