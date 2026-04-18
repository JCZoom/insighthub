#!/bin/bash
# Backup InsightHub SQLite database from EC2
#
# Usage:
#   ./scripts/backup-db.sh                  # Download latest backup
#   ./scripts/backup-db.sh --remote-only    # Create backup on EC2 but don't download
#   ./scripts/backup-db.sh --list           # List existing backups on EC2
#
# Cron (daily at 3 AM on EC2):
#   0 3 * * * /opt/insighthub/scripts/backup-db.sh --remote-only >> /var/log/insighthub-backup.log 2>&1
#
set -euo pipefail

EC2_USER="jeffreycoy"
EC2_HOST="autoqa"
APP_DIR="/opt/insighthub"
DB_PATH="$APP_DIR/prisma/dev.db"
BACKUP_DIR="$APP_DIR/backups"
LOCAL_BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_NAME="insighthub-${TIMESTAMP}.db"
KEEP_DAYS=14

# Parse args
REMOTE_ONLY=false
LIST_ONLY=false
for arg in "$@"; do
    case "$arg" in
        --remote-only) REMOTE_ONLY=true ;;
        --list) LIST_ONLY=true ;;
    esac
done

# List mode
if [ "$LIST_ONLY" = true ]; then
    echo "=== Backups on EC2 ==="
    ssh "$EC2_USER@$EC2_HOST" "ls -lh $BACKUP_DIR/*.db 2>/dev/null || echo '  (no backups found)'"
    echo ""
    echo "=== Local backups ==="
    if [ -d "$LOCAL_BACKUP_DIR" ]; then
        ls -lh "$LOCAL_BACKUP_DIR"/*.db 2>/dev/null || echo "  (no backups found)"
    else
        echo "  (no local backup directory)"
    fi
    exit 0
fi

echo "=== InsightHub DB Backup ==="
echo "  Timestamp: $TIMESTAMP"
echo ""

# 1. Create backup directory on EC2
ssh "$EC2_USER@$EC2_HOST" "mkdir -p $BACKUP_DIR"

# 2. Use SQLite's .backup command for a safe online backup
# This is safer than cp because it handles WAL mode and locking correctly
echo "[1/3] Creating backup on EC2..."
ssh "$EC2_USER@$EC2_HOST" "sqlite3 $DB_PATH '.backup $BACKUP_DIR/$BACKUP_NAME'"

# Verify backup
BACKUP_SIZE=$(ssh "$EC2_USER@$EC2_HOST" "stat -c%s $BACKUP_DIR/$BACKUP_NAME 2>/dev/null || stat -f%z $BACKUP_DIR/$BACKUP_NAME 2>/dev/null")
if [ "$BACKUP_SIZE" -lt 1024 ]; then
    echo "  ERROR: Backup file is suspiciously small (${BACKUP_SIZE} bytes)"
    exit 1
fi
echo "  ✓ Backup created: $BACKUP_NAME ($(echo "$BACKUP_SIZE" | awk '{printf "%.1f MB", $1/1024/1024}'))"

# 3. Prune old backups (keep last N days)
echo "[2/3] Pruning backups older than ${KEEP_DAYS} days..."
PRUNED=$(ssh "$EC2_USER@$EC2_HOST" "find $BACKUP_DIR -name 'insighthub-*.db' -mtime +$KEEP_DAYS -delete -print | wc -l")
echo "  ✓ Pruned $PRUNED old backup(s)"

# 4. Download to local machine (unless remote-only)
if [ "$REMOTE_ONLY" = true ]; then
    echo "[3/3] Skipping download (--remote-only)"
else
    echo "[3/3] Downloading to local machine..."
    mkdir -p "$LOCAL_BACKUP_DIR"
    scp -q "$EC2_USER@$EC2_HOST:$BACKUP_DIR/$BACKUP_NAME" "$LOCAL_BACKUP_DIR/$BACKUP_NAME"
    echo "  ✓ Downloaded to backups/$BACKUP_NAME"
fi

echo ""
echo "=== Backup Complete ==="
echo "  Remote: $BACKUP_DIR/$BACKUP_NAME"
if [ "$REMOTE_ONLY" = false ]; then
    echo "  Local:  $LOCAL_BACKUP_DIR/$BACKUP_NAME"
fi
echo ""
echo "To restore: ./scripts/restore-db.sh backups/$BACKUP_NAME"
