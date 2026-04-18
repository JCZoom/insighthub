#!/bin/bash
# Install InsightHub cron jobs on EC2
#
# Usage: ./scripts/setup-cron.sh
#
# Installs:
#   - Daily DB backup at 3:00 AM ET
#   - Health check every 5 minutes
#   - Weekly backup pruning on Sundays at 4:00 AM ET
#
set -euo pipefail

EC2_USER="jeffreycoy"
EC2_HOST="autoqa"
APP_DIR="/opt/insighthub"

echo "=== InsightHub Cron Setup ==="
echo ""

# Test SSH
if ! ssh -o ConnectTimeout=5 "$EC2_USER@$EC2_HOST" 'echo ok' >/dev/null 2>&1; then
    echo "ERROR: Cannot SSH to $EC2_USER@$EC2_HOST"
    exit 1
fi

# Create log directory
ssh "$EC2_USER@$EC2_HOST" "sudo mkdir -p /var/log/insighthub && sudo chown $EC2_USER /var/log/insighthub"

# Define the cron block
CRON_MARKER="# === InsightHub Automated Tasks ==="
CRON_BLOCK="$CRON_MARKER
# Daily database backup at 3:00 AM
0 3 * * * sqlite3 $APP_DIR/prisma/dev.db \".backup $APP_DIR/backups/daily-\$(date +\\%Y\\%m\\%d).db\" >> /var/log/insighthub/backup.log 2>&1

# Health check every 5 minutes
*/5 * * * * curl -sf --max-time 10 https://dashboards.jeffcoy.net/api/health > /dev/null 2>&1 || echo \"[\$(date -u +\\%Y-\\%m-\\%dT\\%H:\\%M:\\%SZ)] UNHEALTHY\" >> /var/log/insighthub/health.log

# Prune backups older than 14 days (Sundays at 4:00 AM)
0 4 * * 0 find $APP_DIR/backups -name '*.db' -mtime +14 -delete >> /var/log/insighthub/backup.log 2>&1

# Rotate health log weekly (keep last 4 weeks)
0 0 * * 1 cd /var/log/insighthub && mv health.log health.log.\$(date +\\%Y\\%m\\%d) 2>/dev/null; find . -name 'health.log.*' -mtime +28 -delete
$CRON_MARKER"

echo "Installing cron jobs..."

# Remove existing InsightHub cron block if present, then append new one
ssh "$EC2_USER@$EC2_HOST" "
    (crontab -l 2>/dev/null | sed '/$CRON_MARKER/,/$CRON_MARKER/d') | cat - <<'CRON_EOF' | crontab -
$CRON_BLOCK
CRON_EOF
"

echo "  ✓ Cron jobs installed"
echo ""
echo "Installed jobs:"
echo "  - Daily backup: 3:00 AM"
echo "  - Health check: every 5 minutes"
echo "  - Backup pruning: Sundays 4:00 AM"
echo "  - Log rotation: Mondays midnight"
echo ""
echo "Verify: ssh $EC2_USER@$EC2_HOST 'crontab -l'"
echo "Logs:   ssh $EC2_USER@$EC2_HOST 'tail -f /var/log/insighthub/health.log'"
