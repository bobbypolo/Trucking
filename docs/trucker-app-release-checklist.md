# LoadPilot Trucker App Release Checklist

This checklist tracks operator gates that must be cleared before each milestone release. Each gate has a unique ID prefix indicating its domain.

---

## Accounting Gates (OP-ACCT)

| Gate ID | Description | Owner | Status | Notes |
|---------|-------------|-------|--------|-------|
| OP-ACCT-01 | GL double-entry ledger verified against test dataset | Accounting Lead | Pending | Must match to the penny |
| OP-ACCT-02 | IFTA audit packet generates valid quarterly reports | Accounting Lead | Pending | Requires real jurisdiction data |
| OP-ACCT-03 | Invoice aging buckets compute correctly (Current/30/60/90/90+) | Accounting Lead | Pending | Nightly job must run at least once |
| OP-ACCT-04 | Settlement calculations match manual spreadsheet | Accounting Lead | Pending | Spot-check 10 settlements |
| OP-ACCT-05 | Broker credit scores align with payment history | Accounting Lead | Pending | Compare with manual AR analysis |

---

## Simulation and Load Testing Gates (OP-SIM)

| Gate ID | Description | Owner | Status | Notes |
|---------|-------------|-------|--------|-------|
| OP-SIM-01 | API load test passes at 100 concurrent users | DevOps | Pending | Use k6 or Artillery |
| OP-SIM-02 | Database query performance under load (p95 < 200ms) | DevOps | Pending | Monitor slow query log |
| OP-SIM-03 | WebSocket connections stable at 50 concurrent | DevOps | Pending | Test real-time messaging |
| OP-SIM-04 | File upload handles 10MB documents without timeout | DevOps | Pending | BOL and rate-con scans |
| OP-SIM-05 | Mobile app cold start under 3 seconds | Mobile Lead | Pending | Measure on mid-range Android |

---

## Development and CI Gates (OP-DEV)

| Gate ID | Description | Owner | Status | Notes |
|---------|-------------|-------|--------|-------|
| OP-DEV-01 | All unit tests pass (frontend + server) | Dev Lead | Pending | Zero flaky tests allowed |
| OP-DEV-02 | All integration tests pass | Dev Lead | Pending | Database and API integration |
| OP-DEV-03 | Type check passes (tsc --noEmit) | Dev Lead | Pending | Both frontend and server |
| OP-DEV-04 | Lint passes with zero warnings | Dev Lead | Pending | ESLint + Biome |
| OP-DEV-05 | No known security vulnerabilities (npm audit) | Dev Lead | Pending | Critical and high must be zero |
| OP-DEV-06 | Code coverage above 70% for new code | Dev Lead | Pending | Measured per sprint |

---

## EAS and Mobile Build Gates (OP-EAS)

| Gate ID | Description | Owner | Status | Notes |
|---------|-------------|-------|--------|-------|
| OP-EAS-01 | EAS Build succeeds for iOS (production profile) | Mobile Lead | Pending | Requires Apple Developer account |
| OP-EAS-02 | EAS Build succeeds for Android (production profile) | Mobile Lead | Pending | Requires Google Play Console |
| OP-EAS-03 | EAS Update (OTA) delivers correctly to staging | Mobile Lead | Pending | Test on physical devices |
| OP-EAS-04 | App passes TestFlight review | Mobile Lead | Pending | iOS-specific |
| OP-EAS-05 | App passes Google Play internal test track | Mobile Lead | Pending | Android-specific |

---

## App Store and Distribution Gates (OP-STORE)

| Gate ID | Description | Owner | Status | Notes |
|---------|-------------|-------|--------|-------|
| OP-STORE-01 | App Store screenshots and metadata prepared | Product | Pending | 6.5" and 5.5" iPhone, Pixel |
| OP-STORE-02 | Privacy policy URL published and linked | Legal | Pending | Must be publicly accessible |
| OP-STORE-03 | App Store review guidelines compliance check | Product | Pending | Especially data collection |
| OP-STORE-04 | Google Play data safety section completed | Product | Pending | Required for listing |
| OP-STORE-05 | Beta test group recruited (minimum 20 users) | Product | Pending | Mix of fleet sizes |

---

## Legal and Compliance Gates (OP-LEGAL)

| Gate ID | Description | Owner | Status | Notes |
|---------|-------------|-------|--------|-------|
| OP-LEGAL-01 | Terms of Service reviewed and published | Legal | Pending | Must cover SaaS + mobile |
| OP-LEGAL-02 | Privacy policy covers all data collection | Legal | Pending | ELD, location, camera, documents |
| OP-LEGAL-03 | FMCSA data handling compliance verified | Legal | Pending | Safety scores, driver records |
| OP-LEGAL-04 | Payment processing compliance (PCI if applicable) | Legal | Pending | Stripe handles PCI; verify scope |
| OP-LEGAL-05 | Data retention policy documented | Legal | Pending | Per-tenant data lifecycle |
| OP-LEGAL-06 | CCPA/state privacy law compliance | Legal | Pending | California and other states |
