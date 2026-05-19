#!/usr/bin/env bash
#
# Nightly retention purge for InsightHub.
#
# Compliance:
#   - Policy 3700 Data Retention · DR-01–DR-03
#   - Policy 3699 Data Disposal · DD-04
#   - Gap G-05 (closes 2026-05-19)
#
# What it does:
#   POSTs to /api/admin/retention with target='all' and dryRun=false.
#   The endpoint internally runs:
#     - purgeChatMessages (default 90d)
#     - purgeAuditLogs (default 365d)
#     - purgeInactiveUsers (default 1095d, anonymize-not-delete)
#     - purgeFreshworksCache (default 90d cache-side; per-key TTL is 60s)
#
# Each purge emits its own retention.purge_* audit log entry, so this script
# leaves a verifiable trail. We can also `tail -f` the systemd journal for
# the cron unit.
#
# Authentication:
#   Uses a long-lived admin session cookie stored at /root/.insighthub-admin-cookie.
#   That file is provisioned by the operator runbook (see
#   docs/RETENTION_AUTOMATION.md §Provisioning the cron cookie).
#
# Install (on EC2 host):
#   sudo cp scripts/cron/retention-purge.sh /etc/cron.daily/insighthub-retention
#   sudo chmod 0755 /etc/cron.daily/insighthub-retention
#
# Dry-run for verification:
#   RETENTION_DRY_RUN=1 ./scripts/cron/retention-purge.sh

set -euo pipefail

ENDPOINT="${RETENTION_ENDPOINT:-https://dashboards.jeffcoy.net/api/admin/retention}"
COOKIE_FILE="${RETENTION_COOKIE_FILE:-/root/.insighthub-admin-cookie}"
LOG_FILE="${RETENTION_LOG_FILE:-/var/log/insighthub/retention-purge.log}"
DRY_RUN="${RETENTION_DRY_RUN:-0}"

mkdir -p "$(dirname "$LOG_FILE")"

if [ ! -f "$COOKIE_FILE" ]; then
    echo "[$(date -Iseconds)] ERROR: cookie file $COOKIE_FILE not found." | tee -a "$LOG_FILE"
    echo "  Provision per docs/RETENTION_AUTOMATION.md before enabling this cron." | tee -a "$LOG_FILE"
    exit 1
fi

PAYLOAD="{\"target\":\"all\",\"dryRun\":$([ "$DRY_RUN" = "1" ] && echo true || echo false)}"

echo "[$(date -Iseconds)] POST $ENDPOINT payload=$PAYLOAD" | tee -a "$LOG_FILE"

HTTP_CODE=$(curl -sS -o "$LOG_FILE.body" -w "%{http_code}" \
    -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -b "@$COOKIE_FILE" \
    -d "$PAYLOAD" \
    --max-time 60 \
    --fail-with-body || true)

cat "$LOG_FILE.body" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

if [ "$HTTP_CODE" != "200" ]; then
    echo "[$(date -Iseconds)] FAIL http=$HTTP_CODE" | tee -a "$LOG_FILE"
    rm -f "$LOG_FILE.body"
    exit 1
fi

echo "[$(date -Iseconds)] OK" | tee -a "$LOG_FILE"
rm -f "$LOG_FILE.body"
