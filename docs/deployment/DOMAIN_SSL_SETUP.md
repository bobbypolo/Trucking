# Domain & SSL Setup Guide

## Overview

This guide covers adding the custom domain `app.loadpilot.com` to Firebase Hosting
and mapping `api.loadpilot.com` to the production Cloud Run service. Firebase Hosting
automatically provisions SSL certificates via Let's Encrypt — no manual certificate
management is required.

## Prerequisites

- DNS access to the `loadpilot.com` zone (registrar or DNS provider control panel)
- Firebase project owner role on `gen-lang-client-0535844903`
- `firebase` CLI installed and authenticated (`firebase login`)
- `gcloud` CLI installed and authenticated

---

## Step 1: Add Custom Domain to Firebase Hosting

Firebase Hosting must be configured to accept requests for `app.loadpilot.com`.

```bash
# Create/confirm the production hosting site
firebase hosting:channel:create production --site=loadpilot-prod

# Register the custom domain
firebase hosting:custom-domain:add app.loadpilot.com --site=loadpilot-prod
```

Firebase will respond with the DNS records that must be created in your DNS zone.
Copy these values before proceeding — they include:

- One or two **A records** for the apex or subdomain
- A **TXT record** for domain ownership verification

---

## Step 2: Configure DNS Records

Log in to your DNS provider and create the records provided by Firebase.

### Typical record set (Firebase will provide exact IPs/values)

| Type | Name               | Value                        | TTL  |
|------|--------------------|------------------------------|------|
| A    | app.loadpilot.com  | `151.101.x.x` (Firebase IP)  | 3600 |
| A    | app.loadpilot.com  | `151.101.y.y` (Firebase IP)  | 3600 |
| TXT  | app.loadpilot.com  | `firebase=<token>`           | 3600 |

> Note: Firebase may provide AAAA (IPv6) records in addition to A records. Add all
> records that Firebase lists.

### DNS propagation

DNS changes typically propagate in under 1 hour for most resolvers, but can take
up to 48 hours in the worst case. Firebase Hosting will not provision the SSL
certificate until it can verify ownership via the TXT record.

---

## Step 3: SSL Certificate Provisioning

Firebase Hosting automatically provisions an SSL certificate via Let's Encrypt
once DNS verification succeeds.

- Certificate provisioning takes **up to 24 hours** after DNS TXT verification.
- No manual action is required — Firebase handles renewal automatically.

### Check provisioning status

```bash
firebase hosting:channel:list --site=loadpilot-prod
```

Look for `ACTIVE` status on the custom domain entry. Until provisioning completes
the domain may serve a temporary Firebase certificate or return connection errors.

---

## Step 4: Verify HTTPS

Once the certificate is provisioned, verify that HTTPS is working correctly.

### Check HTTP response

```bash
curl -I https://app.loadpilot.com
```

Expected: `HTTP/2 200` (or `301` redirect from HTTP to HTTPS).

### Inspect the SSL certificate

```bash
openssl s_client -connect app.loadpilot.com:443 -servername app.loadpilot.com \
  </dev/null 2>&1 | grep -E "subject|issuer|Verify"
```

Expected output includes:
- `subject=CN = app.loadpilot.com`
- `issuer=C = US, O = Let's Encrypt`
- `Verify return code: 0 (ok)`

---

## Step 5: Cloud Run Domain Mapping (API Subdomain)

For direct API access at `api.loadpilot.com` without routing through Firebase Hosting,
create a Cloud Run domain mapping.

```bash
gcloud run domain-mappings create \
  --service=loadpilot-api-prod \
  --domain=api.loadpilot.com \
  --region=us-central1 \
  --project=gen-lang-client-0535844903
```

Cloud Run will provide DNS records (CNAME or A) to add for `api.loadpilot.com`.
SSL is also auto-provisioned by Google-managed certificates for Cloud Run mappings.

> This step is **optional** if the Firebase Hosting rewrite rule already proxies
> `/api/*` to Cloud Run. Use the direct mapping only when you need a dedicated
> `api.loadpilot.com` subdomain.

---

## Troubleshooting

### DNS not propagating

- Verify the A record and TXT record were saved at the DNS provider.
- Use `dig app.loadpilot.com A` to confirm propagation from your machine.
- Wait up to 48 hours or flush your local DNS cache.

### Certificate delay

- Firebase will not issue the SSL certificate until TXT verification succeeds.
- Re-run `firebase hosting:channel:list --site=loadpilot-prod` after 30 minutes.
- If stuck, revoke and re-add the domain: `firebase hosting:custom-domain:delete`
  then `firebase hosting:custom-domain:add`.

### Mixed content warnings

If the browser reports mixed content (HTTP resources on an HTTPS page):
- Verify `VITE_API_URL` is set to `/api` (relative) or `https://...` (absolute).
- Search the built `dist/assets/` for `http://` references:
  ```bash
  grep -r "http://" dist/assets/ | grep -v "https://"
  ```
- Rebuild the frontend with the correct environment variables.

### HTTPS redirects not working

Firebase Hosting enforces HTTPS automatically. If HTTP requests are not redirecting:
- Check `firebase.json` for `"redirects"` or `"rewrites"` configuration.
- Confirm the hosting site is live: `firebase hosting:sites:list`.
