# IFTA Rate Governance Process

Date: 2026-03-23
Status: Active
Owner: Team 03 — Commercial & Finance Lead

## 1. Purpose

This document defines the owner, cadence, update mechanism, and verification path for quarterly IFTA fuel tax rate maintenance in LoadPilot.

## 2. Source of Truth

- **Production rates**: `server/migrations/036_ifta_tax_rates.sql`
- **Seed script**: `scripts/dev/server/seed_ifta.js`
- **Intelligence upgrade**: `scripts/dev/server/upgrade_ifta_intelligence.js`
- **Test coverage**: `server/__tests__/routes/ifta-rates.test.ts`

## 3. Quarterly Update Owner

- **Primary owner**: Team 03 finance lead (or designated finance operations engineer)
- **Signoff authority**: Architect or product owner must approve the update record before release

## 4. Update Cadence

- Review begins within **5 business days** of official quarterly jurisdiction publication by IFTA Inc.
- Production update ships within **10 business days** of review start, unless jurisdictions publish no rate changes for the quarter.

## 5. Update Mechanism

### Step 1: Obtain official rates

- Download the quarterly IFTA tax rate schedule from the official IFTA Inc. publication or state DOT sources.

### Step 2: Create a new migration

- Create a new SQL migration file (e.g., `server/migrations/03X_ifta_rates_QXYYYY.sql`) that updates the `ifta_tax_rates` table with the new quarter's rates.
- Do NOT modify the existing `036_ifta_tax_rates.sql` — each quarter gets its own migration.

### Step 3: Verify against official publication

- Compare every changed jurisdiction row against the official quarterly publication.
- Document the comparison in the migration file header as a comment.

### Step 4: Run automated tests

```bash
cd server && npx vitest run __tests__/routes/ifta-rates.test.ts
```

### Step 5: Run sample calculation regression

- If settlement or fuel-tax calculation flows are affected, run one sample calculation regression to verify end-to-end correctness.

### Step 6: Release signoff

- Attach signed update notes to the release packet.
- Architect or product owner signs off before merge.

## 6. Verification Checklist

- [ ] New migration file created with quarter identifier
- [ ] All changed jurisdiction rows match official IFTA Inc. quarterly publication
- [ ] `server/__tests__/routes/ifta-rates.test.ts` passes
- [ ] Sample settlement calculation regression passes (if applicable)
- [ ] Update notes attached to release packet
- [ ] Architect or product owner signoff obtained

## 7. Emergency Rate Corrections

If a rate error is discovered post-release:

1. Create a hotfix migration immediately
2. Follow the same verification checklist
3. Tag the release with a patch version increment
4. Notify all tenants via the admin notification channel

## 8. Test Coverage

The following test file provides automated verification:

- `server/__tests__/routes/ifta-rates.test.ts` — validates rate lookups, quarter boundaries, and jurisdiction coverage

This test must pass as part of every CI/CD pipeline run. Rate changes that break these tests must not be merged.
