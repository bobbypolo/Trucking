# Sales Demo — External Access Setup

This guide sets up external access to the demo so salespeople can reach
it from anywhere via a single HTTPS URL.

## Architecture

```
Salesperson browser
       |
       v
https://xyz.trycloudflare.com  (Cloudflare tunnel)
       |
       v
localhost:5000  (your machine)
  ├── /api/*     → Express API routes
  └── /*         → Built React frontend (from dist/)
```

One URL, one port, one tunnel. The salesperson sees a normal website.

## Prerequisites

- Demo setup complete: `npm run demo:setup` (run once)
- cloudflared installed: `cloudflared version` should print a version
  - Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

## Quick Start (2 terminals)

**Terminal 1 — Start the demo server:**
```bash
npm run demo:serve
```
This builds the frontend, runs migrations, seeds the tenant, and starts
Express on port 5000 serving both API and UI.

**Terminal 2 — Start the tunnel:**
```bash
npm run demo:tunnel
```
This starts a Cloudflare Quick Tunnel and prints the public URL:
```
============================================================
  DEMO URL (share with salesperson):
  https://random-words.trycloudflare.com
============================================================
```

Share that URL. It works immediately — HTTPS, no port forwarding needed.

## What the salesperson gets

- **URL**: the tunnel URL printed above
- **Admin login**: the Firebase admin email + password
- **Driver login**: the Firebase driver email + password
- **Demo script**: follow the 6-step certified demo in `docs/sales-demo-runbook.md`
- **Reset**: click Reset Demo in the sidebar between sessions

## Important notes

- The tunnel URL changes each time you restart `npm run demo:tunnel`
- Keep both terminals running during the demo
- If the demo server restarts, the tunnel reconnects automatically
- The Quick Tunnel URL has no SLA — it's for temporary use with 1-2 people
- Don't run other dev work on the same machine during demos

## Upgrading to a permanent URL

When you have a domain on Cloudflare DNS, set up a named tunnel:

```bash
# One-time setup
cloudflared tunnel login
cloudflared tunnel create loadpilot-demo
cloudflared tunnel route dns loadpilot-demo demo.yourdomain.com

# Run (instead of npm run demo:tunnel)
cloudflared tunnel run --url http://localhost:5000 loadpilot-demo
```

Then set `CORS_ORIGIN=https://demo.yourdomain.com` in `.env.local`.

## Running as a Windows service

For unattended operation, install cloudflared as a service:

```powershell
cloudflared service install
```

This auto-starts the tunnel on boot and reconnects on failure.
See: https://developers.cloudflare.com/tunnel/setup/

## Troubleshooting

| Issue | Fix |
|---|---|
| Tunnel says "server not responding" | Start `npm run demo:serve` first |
| Login fails on tunnel URL | Check Firebase credentials in `.env.local` |
| CORS error in browser console | Set `CORS_ORIGIN` to include the tunnel URL |
| Tunnel URL keeps changing | Upgrade to a named tunnel (see above) |
| Demo data looks stale | Click Reset Demo or re-run `npm run demo:serve` |
