#!/bin/bash
# Restore InsightHub SQLite database from a backup
#
# Usage:
#   ./scripts/restore-db.sh backups/insighthub-20260418-030000.db           # From local file
#   ./scripts/restore-db.sh --remote insighthub-20260418-030000.db          # From EC2 backup dir
#   ./scripts/restore-db.sh --latest                                         # Restore most recent EC2 backup
#
# WARNING: This will REPLACE the current production database.
# A pre-restore backup is automatically created before overwriting.
#
set -euo pipefail

EC2_USER="jeffreycoy"
EC2_HOST="autoqa"
APP_DIR="/opt/insighthub"
DB_PATH="$APP_DIR/prisma/dev.db"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

# Encryption — load BACKUP_ENCRYPTION_KEY for decrypting .db.enc backups
if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ] && [ -f "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local" ]; then
    BACKUP_ENCRYPTION_KEY=$(grep '^BACKUP_ENCRYPTION_KEY=' "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local" | cut -d= -f2- | tr -d '"' | tr -d "'")
fi

if [ $# -eq 0 ]; then
    echo "Usage:"
    echo "  ./scripts/restore-db.sh <local-backup-file>"
    echo "  ./scripts/restore-db.sh --remote <backup-filename>"
    echo "  ./scripts/restore-db.sh --latest"
    echo ""
    echo "Available EC2 backups:"
    ssh "$EC2_USER@$EC2_HOST" "ls -1t $BACKUP_DIR/insighthub-*.db $BACKUP_DIR/insighthub-*.db.enc 2>/dev/null | head -10 | sed 's|.*/||'" || echo "  (none found)"
    exit 1
fi

echo "=== InsightHub DB Restore ==="
echo ""

# Determine source
RESTORE_FROM=""
if [ "$1" = "--latest" ]; then
    echo "Finding latest backup on EC2..."
    LATEST=$(ssh "$EC2_USER@$EC2_HOST" "ls -1t $BACKUP_DIR/insighthub-*.db $BACKUP_DIR/insighthub-*.db.enc 2>/dev/null | head -1")
    if [ -z "$LATEST" ]; then
        echo "ERROR: No backups found on EC2 in $BACKUP_DIR"
        exit 1
    fi
    RESTORE_FROM="$LATEST"
    echo "  Latest: $(basename "$RESTORE_FROM")"
elif [ "$1" = "--remote" ]; then
    if [ -z "${2:-}" ]; then
        echo "ERROR: Specify backup filename after --remote"
        exit 1
    fi
    RESTORE_FROM="$BACKUP_DIR/$2"
    echo "  Remote file: $RESTORE_FROM"
else
    # Local file — upload to EC2 first
    LOCAL_FILE="$1"
    if [ ! -f "$LOCAL_FILE" ]; then
        echo "ERROR: File not found: $LOCAL_FILE"
        exit 1
    fi
    echo "Uploading local backup to EC2..."
    REMOTE_TMP="$BACKUP_DIR/restore-upload-$TIMESTAMP.db"
    scp -q "$LOCAL_FILE" "$EC2_USER@$EC2_HOST:$REMOTE_TMP"
    RESTORE_FROM="$REMOTE_TMP"
    echo "  ✓ Uploaded"
fi

# Decrypt if encrypted backup
DECRYPTED_TMP=""
VALIDATE_FROM="$RESTORE_FROM"
if [[ "$RESTORE_FROM" == *.enc ]]; then
    echo ""
    echo "Encrypted backup detected — decrypting..."
    if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        echo "ERROR: BACKUP_ENCRYPTION_KEY is required to restore encrypted backups."
        echo "       Set it in .env.local or export it before running this script."
        exit 1
    fi
    DECRYPTED_TMP="$BACKUP_DIR/restore-decrypted-$TIMESTAMP.db"
    ssh "$EC2_USER@$EC2_HOST" "openssl enc -aes-256-cbc -d -salt -pbkdf2 -iter 100000 \
        -in '$RESTORE_FROM' \
        -out '$DECRYPTED_TMP' \
        -pass 'pass:$BACKUP_ENCRYPTION_KEY'"
    VALIDATE_FROM="$DECRYPTED_TMP"
    echo "  ✓ Decrypted"
fi

# Safety check: verify the backup is a valid SQLite database
echo ""
echo "Validating backup..."
INTEGRITY=$(ssh "$EC2_USER@$EC2_HOST" "sqlite3 '$VALIDATE_FROM' 'PRAGMA integrity_check' 2>&1 | head -1")
if [ "$INTEGRITY" != "ok" ]; then
    # Clean up decrypted temp file on failure
    [ -n "$DECRYPTED_TMP" ] && ssh "$EC2_USER@$EC2_HOST" "shred -u '$DECRYPTED_TMP' 2>/dev/null || rm -f '$DECRYPTED_TMP'"
    echo "ERROR: Backup failed integrity check: $INTEGRITY"
    echo "       (If encrypted, verify BACKUP_ENCRYPTION_KEY is correct.)"
    exit 1
fi
echo "  ✓ Integrity check passed"

# Count records for sanity check
USERS=$(ssh "$EC2_USER@$EC2_HOST" "sqlite3 '$VALIDATE_FROM' 'SELECT COUNT(*) FROM User' 2>/dev/null || echo '?'")
DASHBOARDS=$(ssh "$EC2_USER@$EC2_HOST" "sqlite3 '$VALIDATE_FROM' 'SELECT COUNT(*) FROM Dashboard' 2>/dev/null || echo '?'")
echo "  ✓ Contains: $USERS users, $DASHBOARDS dashboards"

# Use the decrypted file as the restore source
if [ -n "$DECRYPTED_TMP" ]; then
    RESTORE_FROM="$DECRYPTED_TMP"
fi

# Confirm
echo ""
echo "⚠️  This will REPLACE the production database."
echo "   A pre-restore backup will be saved first."
read -p "   Continue? [y/N] " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Create pre-restore backup
echo ""
echo "[1/3] Creating pre-restore backup..."
PRE_RESTORE="$BACKUP_DIR/pre-restore-$TIMESTAMP.db"
ssh "$EC2_USER@$EC2_HOST" "sqlite3 $DB_PATH '.backup $PRE_RESTORE'"
echo "  ✓ Saved to: $(basename "$PRE_RESTORE")"

# Stop the service
echo "[2/3] Stopping InsightHub..."
ssh "$EC2_USER@$EC2_HOST" "sudo systemctl stop insighthub"
echo "  ✓ Service stopped"

# Replace the database
echo "[3/3] Restoring database..."
ssh "$EC2_USER@$EC2_HOST" "cp '$RESTORE_FROM' '$DB_PATH' && chmod 600 '$DB_PATH'"
# Clean up decrypted temp file
[ -n "$DECRYPTED_TMP" ] && ssh "$EC2_USER@$EC2_HOST" "shred -u '$DECRYPTED_TMP' 2>/dev/null || rm -f '$DECRYPTED_TMP'"
# Also update the standalone symlink target
ssh "$EC2_USER@$EC2_HOST" "ln -sf '$DB_PATH' '$APP_DIR/.next/standalone/prisma/dev.db' 2>/dev/null || true"
echo "  ✓ Database restored"

# Restart service
echo ""
echo "Restarting InsightHub..."
ssh "$EC2_USER@$EC2_HOST" "sudo systemctl start insighthub"
sleep 4

if ssh "$EC2_USER@$EC2_HOST" "sudo systemctl is-active insighthub" >/dev/null 2>&1; then
    echo "  ✓ Service running"
else
    echo "  ✗ Service failed to start!"
    echo "    Rolling back to pre-restore backup..."
    ssh "$EC2_USER@$EC2_HOST" "cp '$PRE_RESTORE' '$DB_PATH' && sudo systemctl start insighthub"
    echo "    Rolled back. Check logs: ssh $EC2_USER@$EC2_HOST 'sudo journalctl -u insighthub -n 30'"
    exit 1
fi

# Health check
sleep 2
if curl -sf --max-time 10 "https://dashboards.jeffcoy.net/api/health" > /dev/null 2>&1; then
    echo "  ✓ Health check passed"
else
    echo "  ⚠ Health check failed (service may still be starting)"
fi

echo ""
echo "=== Restore Complete ==="
echo "  Pre-restore backup: $PRE_RESTORE"
echo "  To undo: ./scripts/restore-db.sh --remote $(basename "$PRE_RESTORE")"
