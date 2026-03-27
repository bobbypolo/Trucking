# Deployment Environment Requirements

Quick reference for getting LoadPilot running. Copy `.env.example` to `.env` and
fill in the values described below.

For the full authoritative inventory with staging/production sources and sensitivity
classification, see `docs/deployment/ENV_INVENTORY.md`.

---

## Minimum Required to Start

These variables must be set before the server will boot. The server performs
fail-fast validation at startup and throws with a descriptive message if any are
missing.

### Database (MySQL)

| Variable      | Example                  | Notes                                |
|---------------|--------------------------|--------------------------------------|
| `DB_HOST`     | `127.0.0.1`              | MySQL host. Use socket path on Cloud Run (see `DB_SOCKET_PATH` in `.env.example`). |
| `DB_PORT`     | `3306`                   | Optional — defaults to 3306.         |
| `DB_USER`     | `loadpilot_user`         |                                      |
| `DB_PASSWORD` | `your_password`          | Never commit.                        |
| `DB_NAME`     | `loadpilot_production`   |                                      |

### Firebase (Server Admin SDK)

At least one of these must be set:

| Variable                        | Notes                                                   |
|---------------------------------|---------------------------------------------------------|
| `FIREBASE_PROJECT_ID`           | Sufficient for Cloud Run with Workload Identity.        |
| `GOOGLE_APPLICATION_CREDENTIALS`| Path to service account JSON. Use for local dev.        |

### Firebase (Frontend — Vite)

All six are required for authentication to work:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Get these from: Firebase Console > Project Settings > Your Apps.

---

## CORS Configuration

| Variable       | Required       | Default (dev)                   | Notes                                          |
|----------------|----------------|---------------------------------|------------------------------------------------|
| `CORS_ORIGIN`  | Required in staging/production | localhost origins | Set to your frontend domain. Comma-separate multiple origins. |
| `NODE_ENV`     | Recommended    | `development`                   | Set to `production` or `staging` to enforce CORS validation. |

**Behavior:**
- `NODE_ENV=development` (or unset): `CORS_ORIGIN` is optional. Localhost origins (`localhost:3000`, `localhost:5173`, `localhost:5000`, and `127.0.0.1` variants) are allowed automatically.
- `NODE_ENV=staging` or `NODE_ENV=production`: `CORS_ORIGIN` is **required**. Server refuses to start without it.
- Multiple origins: `CORS_ORIGIN=https://app.loadpilot.com,https://staging.loadpilot.com`

Implemented in `server/lib/env.ts` (`getCorsOrigin()` / `validateEnv()`).

---

## Optional but Needed for Key Features

| Variable                  | Feature                         | Graceful degradation                        |
|---------------------------|---------------------------------|---------------------------------------------|
| `VITE_GOOGLE_MAPS_API_KEY`| Fleet Map, route display, geocoding | Map pages show a configuration prompt   |
| `VITE_WEATHER_API_KEY`    | Weather overlay on map          | Overlay disabled                            |
| `GEMINI_API_KEY`          | AI BOL/Rate-Con parsing         | `/api/ai/*` endpoints return 503            |
| `STRIPE_SECRET_KEY`       | Subscription billing            | Falls back to trial mode                    |
| `STRIPE_WEBHOOK_SECRET`   | Stripe webhook verification     | Webhooks rejected                           |

---

## Dev Server Ports

These control the Vite dev server and its proxy to the backend.

| Variable             | Default | Notes                                              |
|----------------------|---------|----------------------------------------------------|
| `VITE_PORT`          | `3101`  | Frontend dev server port.                          |
| `VITE_BACKEND_PORT`  | `5101`  | Backend port that Vite proxies `/api` requests to. |
| `PORT`               | `5000`  | Express server listen port.                        |
| `VITE_API_URL`       | `/api`  | Frontend API base URL. Override for non-local setups. |

In development, Vite proxies all `/api` requests to `http://127.0.0.1:${VITE_BACKEND_PORT}`.
In production builds, `VITE_API_URL=/api` resolves to the same origin (served behind a
reverse proxy that routes `/api` to the Express server).

---

## Rate Limiting

| Variable          | Default | Notes                                          |
|-------------------|---------|------------------------------------------------|
| `RATE_LIMIT_MAX`  | `100`   | Max API requests per IP per 15-minute window.  |

---

## Migration Numbering

The database migration runner (`server/lib/migrator.ts`) sorts migration files by
filename using lexicographic order. Each migration must have a unique three-digit
prefix (`NNN_description.sql`).

Current sequence (as of 2026-03-26):

```
001 – 037  baseline through fix_parties_fk
038        accounting_tenant_to_company_id
039        companies_subscription_tier
040        parties_tags             (renumbered from 038 conflict)
041        tracking_provider_configs (renumbered from 039 conflict)
```

Run migrations: `cd server && npx ts-node scripts/migrate.ts up`

---

## Production Checklist

Before deploying to staging or production:

1. `NODE_ENV=production` or `NODE_ENV=staging`
2. `CORS_ORIGIN` set to your frontend domain(s)
3. All six `VITE_FIREBASE_*` vars set
4. `DB_*` vars pointing to production Cloud SQL instance
5. `FIREBASE_PROJECT_ID` or `GOOGLE_APPLICATION_CREDENTIALS` set
6. `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` set (or accept trial-mode degradation)
7. Frontend built with `npx vite build` and `VITE_API_URL=/api`

See `docs/deployment/GO_NO_GO_CHECKLIST.md` for the full go/no-go gate.
