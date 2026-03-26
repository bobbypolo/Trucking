# Telematics Provider Setup Guide

This guide covers how to configure GPS/ELD telematics providers for the LoadPilot fleet tracking feature. It applies to the MVP release and documents supported providers, environment variable requirements, provider states, and troubleshooting steps.

---

## Supported Providers (MVP)

| Provider             | Status          | Integration Type | Required Credentials                    |
| -------------------- | --------------- | ---------------- | --------------------------------------- |
| Samsara              | **Implemented** | REST API polling | `SAMSARA_API_TOKEN`                     |
| Generic Webhook      | **Implemented** | Inbound webhook  | `GPS_WEBHOOK_SECRET` (for webhook auth) |

> **Note:** Only Samsara and Generic Webhook are supported in the MVP. The admin UI and backend reject unsupported provider names so the exposed provider list always matches actual support.

---

## Setup Instructions

### 1. Admin UI Setup (Recommended)

1. Log in as a company admin.
2. Navigate to **Company Settings > Telematics Setup**.
3. Select your GPS/ELD provider from the dropdown.
4. Enter your API credentials (token or key) for the selected provider.
5. Map each truck in your fleet to its corresponding provider vehicle ID.
6. Click **Test Connection** to verify credentials and connectivity.
7. Save the configuration.

Once saved, the Operations Center map will display live positions for all mapped vehicles.

### 2. Environment Variable Setup (Server Admin)

Set these variables in your `.env` file or your hosting environment. Never commit secrets to source control.

| Variable                   | Required              | Description                                                                                                         |
| -------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GPS_PROVIDER`             | Yes                   | Selects the active GPS provider. Accepted values: `samsara`, `webhook`.                                             |
| `SAMSARA_API_TOKEN`        | If using Samsara      | Samsara API bearer token. Obtained from the Samsara dashboard under Developer > API Tokens.                         |
| `GPS_WEBHOOK_SECRET`       | If using Webhook      | Shared secret for inbound webhook authentication. Must match the value configured on your GPS device or aggregator. |
| `FMCSA_API_KEY`            | If using FMCSA lookups | API key for FMCSA safety/authority lookups used by telematics and compliance surfaces when enabled.                  |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes (for map display) | Google Maps JavaScript API key. The key must have the **Maps JavaScript API** enabled in Google Cloud Console.      |

Example `.env` excerpt:

```
GPS_PROVIDER=samsara
SAMSARA_API_TOKEN=samsara-api-xxxxxxxxxxxx
GPS_WEBHOOK_SECRET=my-webhook-shared-secret
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
```

---

## Provider States

The Fleet Map displays a status badge based on the current provider state. The following states are possible:

| State             | What it means                                                            | What the user sees                                                               |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `not-configured`  | No provider has been set up                                              | "GPS tracking not configured" info banner with a prompt to open Telematics Setup |
| `configured-live` | Provider is configured and returning live vehicle positions              | Green "Live Tracking Active" badge with the provider name                        |
| `configured-idle` | Provider is configured but no vehicles are currently reporting positions | Amber "Tracking Idle" badge                                                      |
| `provider-error`  | Provider is configured but API calls are failing                         | Red "Tracking temporarily unavailable" warning                                   |

---

## Samsara Integration Details

| Property         | Value                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| API Base URL     | `https://api.samsara.com`                                                     |
| Endpoint         | `/fleet/vehicles/locations`                                                   |
| Auth method      | Bearer token (`Authorization: Bearer <SAMSARA_API_TOKEN>`)                    |
| Polling interval | 30-second frontend poll; 60-second server-side cache TTL                      |
| Request timeout  | 5 seconds                                                                     |
| Error behavior   | Returns empty positions array on API error — no crash, no stale data surfaced |

**Steps to obtain a Samsara API token:**

1. Log in to the Samsara dashboard at `https://cloud.samsara.com`.
2. Navigate to **Settings > Developer > API Tokens**.
3. Create a new token with `fleet:read` scope.
4. Copy the token value and set it as `SAMSARA_API_TOKEN` in your environment.

---

## Generic Webhook Integration Details

Use this provider type if your GPS/ELD device supports outbound HTTP webhooks and is not Samsara.

| Property    | Value                                 |
| ----------- | ------------------------------------- |
| Endpoint    | `POST /api/tracking/webhook`          |
| Auth header | `X-GPS-API-Key: <GPS_WEBHOOK_SECRET>` |
| Rate limit  | 1,000 requests per minute per API key |

### Required Payload Fields

| Field       | Type   | Description                          |
| ----------- | ------ | ------------------------------------ |
| `vehicleId` | string | Provider-assigned vehicle identifier |
| `latitude`  | number | Current latitude in decimal degrees  |
| `longitude` | number | Current longitude in decimal degrees |

### Optional Payload Fields

| Field       | Type   | Description                                      |
| ----------- | ------ | ------------------------------------------------ |
| `speed`     | number | Speed in miles per hour                          |
| `heading`   | number | Heading in degrees (0–360)                       |
| `driverId`  | string | Internal driver ID                               |
| `companyId` | string | Tenant company ID (for multi-tenant deployments) |

### Example Payload

```json
{
  "vehicleId": "truck-abc-123",
  "latitude": 41.8781,
  "longitude": -87.6298,
  "speed": 62,
  "heading": 270,
  "driverId": "drv-00042",
  "companyId": "tenant-001"
}
```

Configure your GPS device or aggregator to POST this payload to:

```
https://<your-server>/api/tracking/webhook
```

with the header:

```
X-GPS-API-Key: <GPS_WEBHOOK_SECRET>
```

---

## Vehicle Mapping

Each truck in the LoadPilot system can be mapped to a vehicle ID in your GPS provider's system. This mapping is:

- **Per-tenant** — each company manages its own mappings independently.
- **Per-provider** — mappings are stored against the active provider type.
- **Used for correlation** — when position data arrives from the provider, LoadPilot uses the vehicle mapping to link the provider's vehicle ID to the correct internal truck record.

Vehicle mappings are managed through the **Telematics Setup** admin screen. Vehicles that are not mapped will not appear on the Fleet Map even if the provider returns data for them.

---

## What Is NOT Implemented in MVP

The following features are planned for a future release and are not available in the current MVP:

- **Real-time WebSocket streaming** — all position updates are delivered via polling only. There is no push-based streaming.
- **Geofence auto-creation from load stops** — geofences must be created manually; they are not automatically derived from load pickup/delivery addresses.
- **Multi-provider per tenant** — each tenant may have only one active provider at a time. Switching providers replaces the previous configuration.
- **Historical playback / trip replay** — only the current position of each vehicle is stored and displayed. No historical route data is retained.

---

## Troubleshooting

### Current branch-local live tracking blocker

If `/api/tracking/live` returns `500` with `TIER_DB_ERROR_001`, that is a shared backend entitlement/database blocker, not a telematics UI configuration failure.

Current Team 3 validation uses:

- Frontend: `http://localhost:3103`
- Backend: `http://localhost:5103`

Known reproduction:

1. Sign in with a valid admin account such as `test@test.com / Test123`.
2. Open **Operations Center**.
3. Observe the red `Tracking temporarily unavailable` banner or the equivalent provider error state.

Expected post-fix behavior:

- the API should return `200` from `/api/tracking/live`
- the frontend should show either `Live Tracking Active` or `Tracking Idle`
- the map should continue to render even if the provider is configured but idle

### Map not showing / blank map tile

**Cause:** The `VITE_GOOGLE_MAPS_API_KEY` environment variable is not set, or the key does not have the Maps JavaScript API enabled.

**Fix:**

1. Verify the variable is set in `.env` and that the Vite build was run after setting it.
2. Open the Google Cloud Console, navigate to **APIs & Services > Credentials**, and confirm the key has **Maps JavaScript API** enabled.
3. Check the browser console for a Google Maps error message — it will cite the specific restriction or billing issue.

### No live positions / all vehicles show last-known or no position

**Cause:** The provider connection is failing or no vehicles are mapped.

**Fix:**

1. Open **Company Settings > Telematics Setup** and click **Test Connection**.
2. If the test fails, verify the API token is valid and has not expired.
3. Confirm that at least one truck has been mapped to a provider vehicle ID.
4. For Samsara, confirm the token has `fleet:read` scope.

### Webhook not receiving data

**Cause:** The GPS device is not configured to POST to the correct URL, or the shared secret does not match.

**Fix:**

1. Confirm the device is configured to POST to `https://<your-server>/api/tracking/webhook`.
2. Confirm the device is sending the `X-GPS-API-Key` header with a value that matches `GPS_WEBHOOK_SECRET` in your environment.
3. Check server logs for 401 responses on `/api/tracking/webhook` — a 401 indicates a secret mismatch.
4. Verify the payload includes the required `vehicleId`, `latitude`, and `longitude` fields.

### Provider state shows `provider-error` after valid configuration

**Cause:** The provider API is unreachable or returning errors at poll time.

**Fix:**

1. Verify network connectivity from the server to `https://api.samsara.com` (or your provider's API host).
2. Check server logs for the specific error returned by the provider.
3. The Fleet Map will continue to function without position data — it will display the `provider-error` badge and an empty map rather than crashing.

---

## Security Notes

- Never commit `SAMSARA_API_TOKEN` or `GPS_WEBHOOK_SECRET` to source control.
- Rotate the webhook secret immediately if it is exposed.
- Samsara API tokens should be scoped to `fleet:read` only — do not use tokens with write or admin scopes.
- The Google Maps API key should be restricted by HTTP referrer in the Google Cloud Console to prevent unauthorized use.
