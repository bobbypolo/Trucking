# Trucker App Environment Matrix

All environment variables used by LoadPilot, grouped by category. Values shown are representative defaults or placeholders; real secrets live in `.env` (gitignored).

| Variable | Category | Local | Staging | Production | EAS Build-time | Scope | Rotation |
|---|---|---|---|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase | `.env` | Secret Manager | Secret Manager | No | Client | On compromise |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase | `.env` | Secret Manager | Secret Manager | No | Client | Never |
| `VITE_FIREBASE_PROJECT_ID` | Firebase | `.env` | Secret Manager | Secret Manager | No | Client | Never |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase | `.env` | Secret Manager | Secret Manager | No | Client | Never |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase | `.env` | Secret Manager | Secret Manager | No | Client | Never |
| `VITE_FIREBASE_APP_ID` | Firebase | `.env` | Secret Manager | Secret Manager | No | Client | Never |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase | `.env` | Secret Manager | Secret Manager | No | Client | Never |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps | `.env` | Secret Manager | Secret Manager | No | Client | 90 days |
| `VITE_WEATHER_API_KEY` | Weather | `.env` | Secret Manager | Secret Manager | No | Client | 90 days |
| `VITE_OPENWEATHER_API_KEY` | Weather | `.env` | Secret Manager | Secret Manager | No | Client | 90 days |
| `VITE_API_URL` | App Config | `/api` | `/api` | `https://api.loadpilot.com/api` | No | Client | Never |
| `VITE_PORT` | App Config | `3101` | N/A | N/A | No | Client | Never |
| `VITE_BACKEND_PORT` | App Config | `5000` | N/A | N/A | No | Client | Never |
| `DB_HOST` | Database | `127.0.0.1` | Cloud SQL IP | Cloud SQL IP | No | Server | Never |
| `DB_PORT` | Database | `3306` | `3306` | `3306` | No | Server | Never |
| `DB_USER` | Database | `loadpilot_user` | Secret Manager | Secret Manager | No | Server | 90 days |
| `DB_PASSWORD` | Database | `.env` | Secret Manager | Secret Manager | No | Server | 90 days |
| `DB_NAME` | Database | `loadpilot_production` | `loadpilot_staging` | `loadpilot_production` | No | Server | Never |
| `DB_SOCKET_PATH` | Database | N/A | Cloud SQL socket | Cloud SQL socket | No | Server | Never |
| `GOOGLE_APPLICATION_CREDENTIALS` | Firebase | `./server/serviceAccount.json` | Workload Identity | Workload Identity | No | Server | Never |
| `FIREBASE_PROJECT_ID` | Firebase | `.env` | Secret Manager | Secret Manager | No | Server | Never |
| `GEMINI_API_KEY` | Gemini | `.env` | Secret Manager | Secret Manager | No | Server | 90 days |
| `GOOGLE_MAPS_API_KEY` | Google Maps | `.env` | Secret Manager | Secret Manager | No | Server | 90 days |
| `WEATHER_API_KEY` | Weather | `.env` | Secret Manager | Secret Manager | No | Server | 90 days |
| `CORS_ORIGIN` | App Config | `*` | `https://staging.loadpilot.com` | `https://app.loadpilot.com` | No | Server | Never |
| `PORT` | App Config | `5000` | `8080` | `8080` | No | Server | Never |
| `NODE_ENV` | App Config | `development` | `staging` | `production` | No | Server | Never |
| `RATE_LIMIT_MAX` | App Config | `100` | `100` | `100` | No | Server | Never |
| `ALLOW_AUTO_PROVISION` | App Config | `false` | `false` | `false` | No | Server | Never |
| `SECRET_ENCRYPTION_KEY` | Security | `.env` | Secret Manager | Secret Manager | No | Server | 180 days |
| `STORAGE_BACKEND` | Storage | `disk` | `firebase` | `firebase` | No | Server | Never |
| `FIREBASE_STORAGE_BUCKET` | Firebase | `.env` | Secret Manager | Secret Manager | No | Server | Never |
| `JWT_SECRET` | JWT | `.env` | Secret Manager | Secret Manager | No | Server | 90 days |
| `LOG_LEVEL` | App Config | `info` | `info` | `warn` | No | Server | Never |
| `APP_VERSION` | App Config | `0.0.0` | CI-injected | CI-injected | No | Server | Never |
| `SENTRY_DSN` | Sentry | `.env` | Secret Manager | Secret Manager | No | Server | On compromise |
| `SMTP_HOST` | Email | `smtp.ethereal.email` | SES endpoint | SES endpoint | No | Server | Never |
| `SMTP_PORT` | Email | `587` | `587` | `587` | No | Server | Never |
| `SMTP_USER` | Email | `.env` | Secret Manager | Secret Manager | No | Server | 90 days |
| `SMTP_PASS` | Email | `.env` | Secret Manager | Secret Manager | No | Server | 90 days |
| `SMTP_FROM` | Email | `noreply@loadpilot.com` | `noreply@loadpilot.com` | `noreply@loadpilot.com` | No | Server | Never |
| `FMCSA_API_KEY` | FMCSA | `.env` | Secret Manager | Secret Manager | No | Server | Annual |
| `STRIPE_SECRET_KEY` | Stripe | `.env` | Secret Manager | Secret Manager | No | Server | On compromise |
| `STRIPE_WEBHOOK_SECRET` | Stripe | `.env` | Secret Manager | Secret Manager | No | Server | On rotation |
| `STRIPE_PRICE_RECORDS_VAULT` | Stripe | `.env` | Stripe Dashboard | Stripe Dashboard | No | Server | Never |
| `STRIPE_PRICE_AUTOMATION_PRO` | Stripe | `.env` | Stripe Dashboard | Stripe Dashboard | No | Server | Never |
| `STRIPE_PRICE_FLEET_CORE` | Stripe | `.env` | Stripe Dashboard | Stripe Dashboard | No | Server | Never |
| `STRIPE_PRICE_FLEET_COMMAND` | Stripe | `.env` | Stripe Dashboard | Stripe Dashboard | No | Server | Never |
| `TWILIO_ACCOUNT_SID` | Twilio | `.env` | Secret Manager | Secret Manager | No | Server | On compromise |
| `TWILIO_AUTH_TOKEN` | Twilio | `.env` | Secret Manager | Secret Manager | No | Server | On compromise |
| `TWILIO_FROM_NUMBER` | Twilio | `.env` | Twilio Console | Twilio Console | No | Server | Never |
| `QUICKBOOKS_CLIENT_ID` | QuickBooks | `.env` | Secret Manager | Secret Manager | No | Server | Annual |
| `QUICKBOOKS_CLIENT_SECRET` | QuickBooks | `.env` | Secret Manager | Secret Manager | No | Server | Annual |
| `QUICKBOOKS_TOKEN_ENCRYPTION_KEY` | QuickBooks | `.env` | Secret Manager | Secret Manager | No | Server | 180 days |
| `QUICKBOOKS_REDIRECT_URI` | QuickBooks | `localhost:5000/callback` | Staging URL | Prod URL | No | Server | Never |
| `QUICKBOOKS_ENVIRONMENT` | QuickBooks | `sandbox` | `sandbox` | `production` | No | Server | Never |
| `GPS_PROVIDER` | GPS/Telematics | `samsara` | `samsara` | `samsara` | No | Server | Never |
| `SAMSARA_API_TOKEN` | GPS/Telematics | `.env` | Secret Manager | Secret Manager | No | Server | 90 days |
| `GPS_WEBHOOK_SECRET` | GPS/Telematics | `.env` | Secret Manager | Secret Manager | No | Server | 90 days |
| `BIGQUERY_PROJECT_ID` | BigQuery | `.env` | GCP project ID | GCP project ID | No | Server | Never |

## EXPO_PUBLIC_* rule

When the trucker mobile app is built with EAS (Expo Application Services), any environment variable prefixed with `EXPO_PUBLIC_` is embedded directly into the JavaScript bundle that ships to end-user devices. This means the value is visible to anyone who inspects the app binary.

**Mobile public keys MUST use the `EXPO_PUBLIC_` prefix.** Variables that the React Native runtime needs at build time (e.g., Firebase config for the mobile client, API base URL, analytics write keys) must be named `EXPO_PUBLIC_<NAME>` so the Expo bundler includes them.

**Server secrets MUST NOT use the `EXPO_PUBLIC_` prefix.** Any variable that holds a secret (database credentials, API secret keys, webhook signing secrets, encryption keys) must never be prefixed with `EXPO_PUBLIC_`. Doing so would leak the secret into every mobile binary distributed to users.

### Quick decision guide

| Question | Prefix | Example |
|---|---|---|
| Does the mobile app need this value at runtime? | `EXPO_PUBLIC_` | `EXPO_PUBLIC_FIREBASE_API_KEY` |
| Is this a server-only secret? | No prefix (plain name) | `STRIPE_SECRET_KEY` |
| Is this a Vite web-only variable? | `VITE_` | `VITE_FIREBASE_API_KEY` |

### Secret rotation procedure

1. Generate a new secret value in the provider dashboard (Stripe, Twilio, etc.).
2. Update the secret in GCP Secret Manager for staging; deploy and verify.
3. Update the secret in GCP Secret Manager for production; deploy and verify.
4. Revoke the old secret value in the provider dashboard.
5. Update the local `.env` file for development.
