# InsightHub — Freshworks Suite Operator Runbook

> **Audience:** EC2 operators (Jeff today; future ops successor).
> **Policy reference:** USZoom Policy 3692 AUTH-02 (credentials never exposed); Policy 3701 ENC-01 (TLS in transit); Policy 3700 DR-01 (bounded retention).
> **Companion docs:** `docs/VENDOR_REGISTER.md` (V-01, V-11, V-12, V-13); `docs/ASSET_REGISTER.md` (INFO-24..33); `docs/RISK_REGISTER.md` (R-041..R-046); `docs/AUTHENTICATION.md`.

This runbook covers the lifecycle of Freshworks API credentials on the production EC2 host: how they get there, how they're protected, how to rotate them, and what to do if one is compromised.

---

## 1. Where Freshworks credentials live

There are 4 API keys (one per product) and 4 domain values (Freshchat is hostname-only, see notes):

| Variable | Sensitivity | Source of truth |
|---|---|---|
| `FRESHSALES_API_KEY` | CC | Freshsales → Personal Settings → API Settings |
| `FRESHSALES_DOMAIN` | UC | Tenant subdomain (e.g. `ipostal1-org.myfreshworks.com`) |
| `FRESHDESK_API_KEY` | CC | Freshdesk → Profile Settings → Your API Key |
| `FRESHDESK_DOMAIN` | UC | Tenant subdomain (e.g. `ipostal1.freshdesk.com`) |
| `FRESHCALLER_API_KEY` | CC | Freshcaller → Admin → API Settings → API Token |
| `FRESHCALLER_DOMAIN` | UC | Tenant subdomain (e.g. `ipostal1-support.freshcaller.com`) |
| `FRESHCHAT_API_KEY` | CC | Freshchat → Admin → API Tokens (Bearer) |
| `FRESHCHAT_DOMAIN` | UC | UI host (`ipostal1.freshchat.com`); API calls go to `api.freshchat.com` |
| `FRESHCHAT_API_HOST` | UC | Optional override (default `api.freshchat.com`) |

### 1.1 File-isolation discipline (G-36 partial mitigation)

On the production EC2 host, the Freshworks credentials live in a **dedicated file** separate from the rest of `.env.local`:

```
/opt/insighthub/.env.freshworks  (mode 0600, owned by jeffreycoy:jeffreycoy)
```

The systemd unit (`infra/insighthub.service`) loads BOTH files via:

```ini
EnvironmentFile=/opt/insighthub/.env.local
EnvironmentFile=/opt/insighthub/.env.freshworks
```

**Why two files?** So the Freshworks credentials never travel through the scp-based deploy path flagged by red-team H-1 and tracked under G-36. The deploy script (`scripts/ec2-deploy.sh`) copies `.env.local` but **NEVER** touches `.env.freshworks`. The Freshworks file is provisioned and rotated in place via SSH-and-edit.

---

## 2. First-time setup (per new EC2 host or new product)

1. SSH to the EC2 host via Tailscale (no plain SSH per Policy 3690 AC-04).
2. Create / edit the file:
   ```bash
   sudo install -m 0600 -o jeffreycoy -g jeffreycoy /dev/null /opt/insighthub/.env.freshworks
   sudo -u jeffreycoy nano /opt/insighthub/.env.freshworks
   ```
3. Paste the variables you need (one per line, no quotes, no scheme on domain values):
   ```
   FRESHSALES_API_KEY=...
   FRESHSALES_DOMAIN=ipostal1-org.myfreshworks.com
   FRESHDESK_API_KEY=...
   FRESHDESK_DOMAIN=ipostal1.freshdesk.com
   FRESHCALLER_API_KEY=...
   FRESHCALLER_DOMAIN=ipostal1-support.freshcaller.com
   FRESHCHAT_API_KEY=...
   FRESHCHAT_DOMAIN=ipostal1.freshchat.com
   ```
4. Verify file mode is `0600` (read/write owner only):
   ```bash
   ls -l /opt/insighthub/.env.freshworks
   # -rw------- 1 ubuntu ubuntu ...
   ```
5. Reload the InsightHub service so it picks up the new env:
   ```bash
   sudo systemctl restart insighthub
   sudo systemctl status insighthub --no-pager
   ```
6. Verify via the admin diagnostics endpoint (must be signed in as ADMIN):
   ```
   GET https://dashboards.jeffcoy.net/api/admin/freshworks/diagnostics
   ```
   Each of the 4 products should show `configured: true` and a redacted `apiKey` field showing only first-4/last-2 characters.

> **Note on domain scheme:** The connector's `normalizeDomain()` defensively strips `https://`, `http://`, and trailing slashes — so it will tolerate a pasted full URL. But the registers and operator habit should still be "domain only" for clarity.

---

## 3. Rotation procedure (quarterly cadence — Asana recurring task)

We rotate Freshworks tokens on a **90-day cadence** AND on any compromise event. To rotate:

1. **Generate the new token in the vendor console** (Freshsales / Freshdesk / Freshcaller / Freshchat — links above). Do not delete the old token yet.
2. SSH to the EC2 host:
   ```bash
   sudo -u jeffreycoy nano /opt/insighthub/.env.freshworks
   # Replace the relevant FRESH*_API_KEY=... line. Save.
   ```
3. Restart the service:
   ```bash
   sudo systemctl restart insighthub
   ```
4. Verify the new key works:
   ```
   GET /api/admin/freshworks/diagnostics
   ```
   Confirm `apiKey` field shows the new first-4/last-2 fingerprint and that you can still read data for that product.
5. **Now** delete the old token in the vendor console (so a leaked old key can't be used).
6. Log the rotation in the Asana task and update the "last rotated" date in `docs/VENDOR_REGISTER.md` for the relevant V-NN entry.

---

## 4. Incident response — suspected token compromise

If you suspect a Freshworks API key has been compromised (e.g. it appeared in a log, a CI artifact, or a screenshot):

1. **Immediately** rotate the affected key in the vendor console (this revokes the leaked token within minutes).
2. SSH to EC2 and replace the key in `/opt/insighthub/.env.freshworks`.
3. `sudo systemctl restart insighthub` and verify via diagnostics.
4. Open the Incident Response runbook (`docs/INCIDENT_RESPONSE_RUNBOOK.md`) and execute Phase 1.
5. Query the Freshworks vendor audit log (each product has one in admin settings) for unexpected API activity in the window between leak and rotation. Snapshot to `docs/evidence/freshworks-incident-YYYY-MM-DD/`.
6. File an entry against R-041 / R-043 / R-044 / R-045 as appropriate in `docs/RISK_REGISTER.md` with the realized-loss assessment.

---

## 5. What deploy.sh / ec2-deploy.sh DOES and DOES NOT do

**Does:**
- Pull latest code from GitHub.
- Run `npm install` and `npm run build`.
- Restart the systemd unit.
- Health-check the new build; auto-rollback on failure.

**Does NOT (by design):**
- Touch `/opt/insighthub/.env.freshworks` — that file is owned by the operator, not the deploy pipeline.
- Read or echo Freshworks env values anywhere.
- Copy `.env.local` over `.env.freshworks` (the deploy script writes only `.env.local`).

If you ever see deploy.sh modifying `.env.freshworks`, that's a bug — file an incident.

---

## 6. Cache flush (operational lever)

If you need to invalidate cached Freshworks data immediately (e.g. demoing the retention story, or after a privacy event where a customer asked us to drop their data right now):

**UI path (admin):**
1. Navigate to `https://dashboards.jeffcoy.net/demo/freshworks-suite`.
2. Click "Purge ALL Freshworks caches now" at the bottom.
3. Confirm the success message shows the count of keys deleted.

**API path:**
```bash
curl -X POST https://dashboards.jeffcoy.net/api/admin/retention \
  -H 'Cookie: <admin-session>' \
  -H 'Content-Type: application/json' \
  -d '{"target":"freshworks_cache","dryRun":false}'
```

Both paths emit a `retention.purge_freshworks_cache` audit log entry.

---

## 7. Per-product configuration cheat sheet

### Freshsales
- Auth header: `Authorization: Token token=<key>`
- Base URL: `https://<FRESHSALES_DOMAIN>/crm/sales/api/`
- Free tier rate cap: 100/min; ours is set to 60/min

### Freshdesk
- Auth header: `Authorization: Basic base64(<key>:X)`  (HTTP Basic, key as username)
- Base URL: `https://<FRESHDESK_DOMAIN>/api/v2/`
- Free tier rate cap: 50/min; ours is set to 40/min

### Freshcaller
- Auth header: `X-Api-Auth: <key>`  (**NOT** Authorization)
- Base URL: `https://<FRESHCALLER_DOMAIN>/api/v1/`
- Starter rate cap: 30/min; ours is set to 25/min

### Freshchat
- Auth header: `Authorization: Bearer <key>`
- Base URL: `https://api.freshchat.com/v2/`  (global; not tenant-specific)
- Rate cap bound by PII-volume policy: 60/min (vendor allows more, we self-throttle)

---

## 8. Verification commands

```bash
# Check the env file exists and has the right mode
ssh ec2 'ls -l /opt/insighthub/.env.freshworks'

# Check all 4 products report configured=true
curl -sH 'Cookie: <admin-session>' \
  https://dashboards.jeffcoy.net/api/admin/freshworks/diagnostics | jq

# Confirm no Freshworks key leaks into journalctl
sudo journalctl -u insighthub -n 200 --no-pager | grep -iE 'fresh|api_key|token' | grep -v 'FRESH.*=___'
# Should return zero lines containing actual key material.

# Confirm Redis is reachable and Freshworks prefixes are present
redis-cli --scan --pattern 'fw-*' | head -20
```

---

## 9. Annual review (next due 2027-05-19)

- Confirm all 4 vendor DPA addenda are still valid.
- Re-run SOC 2 / ISO 27001 attestation checks for Freshworks Inc.
- Rotate all 4 API keys (in addition to the quarterly rotation).
- Compare actual quarterly rotation cadence against the Asana task; if drift, raise to JD.
- Verify the demo page still works (the connectors get less love than the rest of the app — drift is plausible).
