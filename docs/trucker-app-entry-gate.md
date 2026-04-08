Trucker App Entry Gate

Purpose: this is the mandatory pre-dispatch checklist for trucker-app Ralph work. The master plan requires this gate before any trucker-app sprint is dispatched.

Status: pending completion

## Required confirmations

| Check | Required state | Current state | Evidence |
| --- | --- | --- | --- |
| Remediation sprint merged | `ralph/pre-demo-remediation` merged to `main` | pending | add merge commit SHA |
| BSD sprint merged | `ralph/bulletproof-sales-demo` merged to `main` | pending | add merge commit SHA |
| Main branch CI baseline documented | known green or known-red baseline recorded before dispatch | pending | add latest `gh run list --branch main --limit 5` snapshot |
| Worktree isolation verified | `17f8d99` or later confirmed to isolate `.claude/hooks`, `.claude/rules`, `.claude/settings.json` in a fresh worktree | pending | add command transcript or verification note |
| Current-path inventory verified | all `MODIFY` targets in the sprint plan still exist at the listed paths | pending | add `rg` or `Test-Path` verification |
| Brand default confirmed | `LoadPilot Driver` accepted or overridden before any mobile sprint | pending | note selected brand |
| Apple / Google account owner recorded | owning entity and credentials handoff path documented | pending | add owner name / account IDs |
| Twilio account owner recorded | sender strategy known before auth sprint | pending | add owner and sender type |
| Stripe account owner recorded | billing account owner known before tier-enforcement sprint | pending | add owner and workspace |
| Motive sandbox account recorded | sandbox credentials or registration owner known before ELD sprint | pending | add owner and app ID |

## Sprint A-specific checks

| Check | Required state | Current state | Evidence |
| --- | --- | --- | --- |
| Pre-monorepo layout still active | `components/IFTAManager.tsx` and `services/financialService.ts` still exist at root layout paths | pending | add `Test-Path` results |
| IFTA seed data source confirmed | seeded or reproducible Q4 fixture data exists for packet generation tests | pending | add fixture source |
| ZIP/PDF dependency policy confirmed | allowed server dependencies for `jszip` and PDF generation are approved | pending | add dependency decision |

## Completion rule

This entry gate is complete only when every row above has a non-pending Current state and attached evidence. Until then, trucker-app work stays at planning status and no Ralph worker should be dispatched against the trucker-app sprint plans.
