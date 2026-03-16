# RC Evidence Bundle — LoadPilot rc-1.0.0

> **NOTE:** Replace `$PROD_PROJECT_ID` with your actual production GCP project ID before use.
> The staging project `gen-lang-client-0535844903` must NOT be used for production.

> **Generated:** PLACEHOLDER_DATE
> **Script:** scripts/freeze-rc.sh
> **Status:** Release Candidate Frozen

---

## 1. Release Metadata

| Field              | Value                                                |
| ------------------ | ---------------------------------------------------- |
| Git Tag            | `rc-1.0.0`                                           |
| Commit SHA (full)  | `PLACEHOLDER_SHA_FULL`                               |
| Commit SHA (short) | `PLACEHOLDER_SHA_SHORT`                              |
| Freeze Date        | PLACEHOLDER_DATE                                     |
| Branch             | `ralph/deployment-preparation-staging-qualification` |
| Tag Message        | Release Candidate 1.0.0 — frozen at PLACEHOLDER_DATE |

### Verify Tag

```bash
git show rc-1.0.0
git log --oneline rc-1.0.0 -1
```

---

## 2. Docker Image (Artifact Registry)

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Registry Path     | `us-central1-docker.pkg.dev/$PROD_PROJECT_ID/loadpilot/loadpilot-api:PLACEHOLDER_SHA_SHORT` |
| Artifact Registry | `us-central1-docker.pkg.dev/$PROD_PROJECT_ID/loadpilot`                                     |
| Image Digest      | `PLACEHOLDER_DIGEST`                                                                        |
| GCP Project       | `$PROD_PROJECT_ID (set via environment variable)`                                           |

### Verify Image

```bash
gcloud artifacts docker images describe \
  us-central1-docker.pkg.dev/$PROD_PROJECT_ID/loadpilot/loadpilot-api:PLACEHOLDER_SHA_SHORT \
  --project=$PROD_PROJECT_ID
```

---

## 3. Firebase Hosting

| Field       | Value                                             |
| ----------- | ------------------------------------------------- |
| Release ID  | `PLACEHOLDER_FIREBASE_RELEASE_ID`                 |
| Hosting URL | `https://$PROD_PROJECT_ID.web.app`                |
| GCP Project | `$PROD_PROJECT_ID (set via environment variable)` |

### Verify Hosting

```bash
firebase hosting:releases:list --project=$PROD_PROJECT_ID --limit=5
```

---

## 4. Staging Evidence Summary

The following staging evidence documents were reviewed before this RC freeze:

| Document                   | Location                                        |
| -------------------------- | ----------------------------------------------- |
| Staging Execution Evidence | `docs/deployment/STAGING_EXECUTION_EVIDENCE.md` |
| Rollback Drill Evidence    | `docs/deployment/ROLLBACK_DRILL_EVIDENCE.md`    |
| Go / No-Go Checklist       | `docs/deployment/GO_NO_GO_CHECKLIST.md`         |
| Deployment Runbook         | `docs/deployment/DEPLOYMENT_RUNBOOK.md`         |
| Rollout Plan               | `docs/deployment/ROLLOUT_PLAN.md`               |

> Staging qualification criteria passed locally. See STAGING_EXECUTION_EVIDENCE.md for live command output template.
> GO_NO_GO_CHECKLIST.md status: Demo/staging-ready. Production sign-off pending (see PRODUCTION_READINESS_VERDICT.md Section 9).

---

## 5. Test Suite Summary

| Suite                      | Count                    | Status                                      |
| -------------------------- | ------------------------ | ------------------------------------------- |
| Server (Vitest)            | 1,163                    | PASS (88 files, 0 failures)                 |
| Frontend (Vitest)          | 549                      | PASS (59 files, 0 failures)                 |
| E2E (Playwright)           | 186 passing / 95 skipped | EXISTS (not freshly run against live stack) |
| **Total unit/integration** | **1,870**                | **ALL GREEN (verified 2026-03-16)**         |

> **Note (2026-03-16)**: Playwright E2E tests exist and were last run locally on 2026-03-12.
> They have not been freshly executed against a live staging stack. A full E2E pass against
> staging is required before production sign-off.

### Reproduce

```bash
# Server tests
cd server && npx vitest run

# Frontend tests
npx vitest run

# E2E tests
npx playwright test
```

---

## 6. Open Defects

The following defects are tracked and do not block this release:

| ID    | Severity | Description                               | Status            |
| ----- | -------- | ----------------------------------------- | ----------------- |
| F-004 | Major    | LoadStatus 3-way mismatch (risk assessed) | ASSESSED/DEFERRED |
| F-005 | Major    | AuditLogs real /api/audit endpoint        | FIXED (PR merged) |

> F-005 was fixed and merged before this RC freeze.
> F-004 risk assessment confirms no live workflow impact.

---

## 7. Sign-Off

| Role             | Name | Date | Signature |
| ---------------- | ---- | ---- | --------- |
| Release Manager  |      |      |           |
| QA Lead          |      |      |           |
| Engineering Lead |      |      |           |

**Decision:** [ ] GO — Proceed to production deployment using scripts/deploy-production.sh
[ ] NO-GO — Hold. Document reason below.

**Reason (if NO-GO):**

---

_Generated by scripts/freeze-rc.sh | LoadPilot Production Rollout_
