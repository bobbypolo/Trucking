Trucker App Ralph Dispatch Runbook

Purpose: operational sequence for taking the trucker-app work from planning state to an active Ralph sprint.

## Current artifact set

- Master roadmap: `docs/PLAN-trucker-app.md`
- Entry gate: `docs/trucker-app-entry-gate.md`
- Dispatch-ready Sprint A plan: `docs/PLAN-trucker-app-sprint-a.md`
- Preview story JSON for Sprint A: `docs/trucker-app-sprint-a.prd.preview.json`

## Preconditions

1. `docs/trucker-app-entry-gate.md` is fully filled out and no row is still marked `pending`.
2. `ralph/pre-demo-remediation` is merged to `main`.
3. `ralph/bulletproof-sales-demo` is merged to `main`.
4. The repo is on the branch that will be used to create the next Ralph sprint branch.

## Dispatch sequence for Sprint A

1. Validate the sprint plan:

```powershell
python .claude/hooks/plan_validator.py --plan docs/PLAN-trucker-app-sprint-a.md
```

Expected result: `PASS`.

2. Copy the sprint plan into the active Ralph location:

```powershell
Copy-Item docs/PLAN-trucker-app-sprint-a.md .claude/docs/PLAN.md -Force
```

3. Generate the active story JSON:

```powershell
python .claude/hooks/prd_generator.py --plan .claude/docs/PLAN.md --output .claude/prd.json
```

4. Verify that the generated stories match expectations:

```powershell
Get-Content .claude/prd.json -TotalCount 160
```

Expected result for Sprint A:

- exactly `1` story
- story id `STORY-001`
- `15` acceptance criteria `R-P1-01` through `R-P1-15`

5. Create the sprint branch and start the Ralph loop using your normal orchestration entrypoint.

6. After Sprint A merges, repeat the same pattern for the next sprint extraction rather than reusing the master roadmap directly.

## Sequencing rule

Do not dispatch directly from `docs/PLAN-trucker-app.md`. That file is the roadmap. Ralph should dispatch from a sprint extraction such as `docs/PLAN-trucker-app-sprint-a.md`.

## Next planned sprint order

1. Sprint A: Phase 1 only - `docs/PLAN-trucker-app-sprint-a.md`
2. Sprint B: Phase 0 only - monorepo/bootstrap after the manual pre-Phase-0 move is complete
3. Sprint C: Phases 2-4
4. Sprint D: Phase 5
5. Sprint E: Phase 6
6. Sprint F: Phases 7-8
7. Sprint G: Phases 9-10
8. Sprint H: Phase 11
