# Retention & Disposal Automation — InsightHub

> **Compliance reference:** USZoom Policy **3700** Data Retention (DR-01 / DR-02 / DR-03) and Policy **3699** Data Disposal (DD-04 / DD-05).
> **Gaps:** G-05 (closed 2026-05-19), G-06 (closed 2026-05-19).
> **Owner:** Jeff Coy.
> **Annual review due:** 2027-05-19.

---

## What we retain, for how long, and how it ends

| Data class | Default window | Override env var | Disposal method | Closes |
|---|---|---|---|---|
| Chat messages + sessions | 90 days | `CHAT_RETENTION_DAYS` (caller-supplied) | Hard delete + orphan-session cleanup | G-05 |
| Audit logs | 365 days | `AUDIT_LOG_RETENTION_DAYS` | Hard delete (meta-audit row preserved) | G-06 |
| Inactive user accounts | 1,095 days (3y) | `INACTIVE_USER_RETENTION_DAYS` | **Anonymize in place** (email/name/avatar scrubbed); FK integrity preserved | G-05 |
| Freshworks CRM cache | 90 days bulk / 60 s per-key TTL | `FRESHWORKS_CACHE_RETENTION_DAYS` | Redis `SCAN` + `DEL` on `fw:*` keys | G-05 |

**Why anonymize, not hard-delete users?**

- `AuditLog.userId` is a foreign key to `User.id`. Hard-deleting an inactive user would orphan every audit entry they ever generated — which is the opposite of what an auditor wants.
- Dashboards may be shared with active users; orphaning the owner FK would break dashboard listings.
- Anonymization satisfies GDPR's "right to be forgotten" intent (the personal data is gone) while preserving operational integrity.

## How a purge runs

```
POST /api/admin/retention
{
  "target": "chat" | "audit" | "inactive_users" | "freshworks_cache" | "all",
  "dryRun": true | false,
  "retentionDays": <optional override for chat>,
  "auditRetentionDays": <optional override for audit>,
  "inactiveUserRetentionDays": <optional override for users>,
  "freshworksCacheRetentionDays": <optional override for cache>
}
```

Response:

```json
{
  "message": "Purge complete for target=all",
  "dryRun": false,
  "chat":            { "matched": 142, "deleted": 142, "deletedSessions": 3, "cutoff": "...", "retentionDays": 90 },
  "audit":           { "matched": 0,   "deleted": 0,                          "cutoff": "...", "retentionDays": 365 },
  "inactiveUsers":   { "matched": 1,   "deleted": 1,                          "cutoff": "...", "retentionDays": 1095 },
  "freshworksCache": { "matched": 23,  "deleted": 23,                         "cutoff": "...", "retentionDays": 90 }
}
```

Every non-dry-run purge emits its own audit log entry (`retention.purge_chat`, `retention.purge_audit`, etc.) recording who triggered it, when, what was deleted, and the source (`admin:manual`, `admin:dry-run`, `system:cron`). The audit log table records its own grooming.

## Daily cron

`scripts/cron/retention-purge.sh` is the nightly entry point on EC2. It:

1. Reads a long-lived admin session cookie from `/root/.insighthub-admin-cookie` (provisioned via the procedure below).
2. POSTs to the production retention endpoint with `target=all`.
3. Appends JSON response + exit code to `/var/log/insighthub/retention-purge.log`.
4. Exits non-zero on HTTP != 200 so cron's MAILTO fires for the operator.

Install on EC2:

```bash
sudo cp scripts/cron/retention-purge.sh /etc/cron.daily/insighthub-retention
sudo chmod 0755 /etc/cron.daily/insighthub-retention
sudo mkdir -p /var/log/insighthub && sudo chown jeffreycoy:jeffreycoy /var/log/insighthub
```

Verify with a dry-run before enabling:

```bash
sudo RETENTION_DRY_RUN=1 /etc/cron.daily/insighthub-retention
sudo cat /var/log/insighthub/retention-purge.log | tail -30
```

## Provisioning the cron cookie

The cron job needs to authenticate as an admin without an interactive login. Procedure (one-time setup):

1. Log in to https://dashboards.jeffcoy.net as an admin user.
2. Open browser devtools → Application → Cookies → copy the `next-auth.session-token` (and `__Secure-next-auth.session-token` if HTTPS) value.
3. SSH to EC2: `ssh ec2-user@...`
4. Write the cookie in Netscape format:
   ```bash
   sudo tee /root/.insighthub-admin-cookie > /dev/null <<EOF
   # Netscape HTTP Cookie File
   dashboards.jeffcoy.net	FALSE	/	TRUE	0	__Secure-next-auth.session-token	<VALUE>
   EOF
   sudo chmod 600 /root/.insighthub-admin-cookie
   ```
5. Rotate quarterly (or sooner if compromised) — set an Asana recurring task.

**Why a session cookie and not an API key?**

- We don't yet have a service-account / API-key mechanism for InsightHub (tracked in G-11 / G-38 follow-ups).
- A scoped admin cookie reuses the existing auth/audit stack — every purge call is attributed to the human admin whose cookie was provisioned, not a black-box "system" account.
- When G-11 lands (admin separate account + service identity), this script switches to that. The cookie file becomes the service-account credential.

## Demo retention story (for tomorrow's review)

The strongest single moment in the demo: **show the retention lever working live.**

```bash
# 1. Load Freshworks dashboard → cache populated.
# 2. Run from a second admin shell:
curl -X POST https://dashboards.jeffcoy.net/api/admin/retention \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=$COOKIE" \
  -d '{"target":"freshworks_cache","dryRun":false}'

# 3. Response shows freshworksCache.deleted > 0
# 4. Reload dashboard → fresh API hit visible in logs.
# 5. Query audit log → retention.purge_freshworks_cache entry exists.
```

This proves end-to-end that:
- Sensitive data has a bounded lifetime.
- The lever exists, is callable, is audit-logged.
- The system recovers correctly (re-fetches from source) when the cache is wiped.

## Annual review checklist (due 2027-05-19)

- [ ] Re-confirm policy 3700 retention windows haven't changed; update defaults if they have.
- [ ] Verify cron has run successfully every day for the last 90 days (`grep OK /var/log/insighthub/retention-purge.log* | wc -l`).
- [ ] Re-issue the admin cron cookie (quarterly cadence makes this a no-op if cadence is being followed).
- [ ] Confirm the audit log table has at least one `retention.purge_audit` entry from within the last 30 days (proves the meta-grooming runs).
- [ ] Bump dates in this doc and in `src/lib/data/retention.ts` JSDoc.

## File map

| Path | Purpose |
|---|---|
| `src/lib/data/retention.ts` | All purge functions; `dryRun` + audit semantics |
| `src/lib/audit.ts` | `RETENTION_PURGE_*` audit actions; `auditedDelete` wrapper (G-08) |
| `src/app/api/admin/retention/route.ts` | Multi-target purge endpoint (admin + cron entry point) |
| `scripts/cron/retention-purge.sh` | Nightly cron driver |
| `docs/RETENTION_AUTOMATION.md` | This document |
