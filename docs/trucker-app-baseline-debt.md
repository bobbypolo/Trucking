# Baseline Debt Register

Known pre-existing failures captured during sprint B1 setup. Each entry documents a real test or infrastructure issue that predates the current sprint and is tracked for resolution within the stated expiry window.

| file | failure | owner | first-seen | expiry | justification |
| --- | --- | --- | --- | --- | --- |
| `e2e/ifta-audit-packet-smoke.spec.ts` | missing jszip types (TS2307) | infra | 2026-04-09 | 2026-05-09 | transitive type dep not installed; does not block runtime |
| `server/__tests__/integration/**` | PORT env variable incompatibility | infra | 2026-04-09 | 2026-05-09 | PORT=5000 shell syntax not Windows-native; CI runs Linux |
| `.claude/hooks/tests/` | directory absent after sprint reset | infra | 2026-04-09 | 2026-05-09 | pruned during sprint reset; new tests added as Ralph progresses |
