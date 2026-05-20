#!/usr/bin/env bash
#
# Nightly metric-snapshot writer for InsightHub.
#
# Compliance / context:
#   - G-FW-PoP-1 phase 2 (snapshot writer)
#   - Captures the current value of allowlisted data sources and
#     persists them to the `MetricSnapshot` Prisma table, idempotently
#     keyed on (source, asOf=midnight UTC).
#   - The data provider's PoP reader (phase 3) consults this table to
#     compute honest previous_value for sources whose vendor APIs lack
#     a date filter. Until phase 3 ships, this writer is HARMLESS —
#     nothing reads MetricSnapshot yet, the only side effect is row
#     inserts.
#
# Why direct Node invocation rather than HTTP:
#   The retention purge (scripts/cron/retention-purge.sh) hits a public
#   API endpoint with an admin session cookie, because the operator
#   reviews each retention action via audit-log fingerprint and we
#   wanted a clear authorization story. The snapshot writer doesn't
#   need that — it has no destructive side effects (append-only writes
#   to a single table the user never sees), runs at a fixed cadence,
#   and benefits from skipping the cookie-provisioning hurdle that's
#   currently blocked on real OAuth (Asana 1214949021810627).
#
# Install (on EC2 host):
#   sudo cp scripts/cron/snapshot-metrics.sh /etc/cron.daily/insighthub-snapshots
#   sudo chmod 0755 /etc/cron.daily/insighthub-snapshots
#
# Manual / backfill run:
#   APP_DIR=/opt/insighthub ASOF=2026-05-15 ./scripts/cron/snapshot-metrics.sh
#
# Lock file:
#   The cron job is daily, but if a previous run is still going (slow
#   vendor API, retry storm) we skip rather than queue. This prevents
#   stacking when an upstream is sluggish.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/insighthub}"
LOG_FILE="${SNAPSHOT_LOG_FILE:-/var/log/insighthub/snapshot-metrics.log}"
LOCK_FILE="${SNAPSHOT_LOCK_FILE:-/var/lock/insighthub-snapshots.lock}"
NODE_ENV="${NODE_ENV:-production}"

mkdir -p "$(dirname "$LOG_FILE")"

# flock -n: acquire lock non-blocking, exit immediately if held.
exec 9>"$LOCK_FILE" || {
    echo "[$(date -Iseconds)] ERROR: cannot open lock file $LOCK_FILE" | tee -a "$LOG_FILE"
    exit 1
}
if ! flock -n 9; then
    echo "[$(date -Iseconds)] WARN: previous snapshot-metrics run still active; skipping." | tee -a "$LOG_FILE"
    exit 0
fi

cd "$APP_DIR" || {
    echo "[$(date -Iseconds)] ERROR: APP_DIR=$APP_DIR not found" | tee -a "$LOG_FILE"
    exit 1
}

echo "[$(date -Iseconds)] snapshot-metrics start (asof=${ASOF:-today-utc})" | tee -a "$LOG_FILE"

# Run the writer. Output goes to the log; exit code is preserved for
# systemd / cron status reporting.
if NODE_ENV="$NODE_ENV" ASOF="${ASOF:-}" \
   /usr/bin/env npx tsx scripts/snapshot-metrics.ts >> "$LOG_FILE" 2>&1; then
    echo "[$(date -Iseconds)] snapshot-metrics OK" | tee -a "$LOG_FILE"
    exit 0
else
    rc=$?
    echo "[$(date -Iseconds)] snapshot-metrics FAIL rc=$rc" | tee -a "$LOG_FILE"
    exit "$rc"
fi
