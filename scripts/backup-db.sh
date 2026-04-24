#!/bin/bash
# Backup InsightHub SQLite database from EC2
#
# Usage:
#   ./scripts/backup-db.sh                  # Download latest backup
#   ./scripts/backup-db.sh --remote-only    # Create backup on EC2 but don't download
#   ./scripts/backup-db.sh --list           # List existing backups on EC2
#   ./scripts/backup-db.sh --no-s3          # Skip S3 upload (for local/dev testing)
#
# Cron (daily at 3 AM on EC2):
#   0 3 * * * /opt/insighthub/scripts/backup-db.sh --remote-only >> /var/log/insighthub-backup.log 2>&1
#
# Cross-region isolation (gap G-13):
#   When BACKUP_S3_BUCKET is set, the (encrypted) backup is also uploaded to an
#   S3 bucket in BACKUP_REGION (default us-west-2) via a least-privilege IAM user.
#   When S3 upload is enabled, BACKUP_ENCRYPTION_KEY is REQUIRED.
#   Setup: ./scripts/setup-backup-isolation.sh
#   Docs:  docs/BACKUP_ISOLATION_SETUP.md
set -euo pipefail

EC2_USER="jeffreycoy"
EC2_HOST="autoqa"
APP_DIR="/opt/insighthub"
DB_PATH="$APP_DIR/prisma/dev.db"
BACKUP_DIR="$APP_DIR/backups"
LOCAL_BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_NAME="insighthub-${TIMESTAMP}.db"
KEEP_DAYS=30  # Policy 4133 BK-07 minimum (gap G-07)

# Load BACKUP_* variables from .env.local if not already in environment.
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local"
load_env_var() {
    local var_name="$1"
    if [ -z "${!var_name:-}" ] && [ -f "$ENV_FILE" ]; then
        local val
        val=$(grep "^${var_name}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
        if [ -n "$val" ]; then
            export "${var_name}=${val}"
        fi
    fi
}
for v in BACKUP_ENCRYPTION_KEY BACKUP_S3_BUCKET BACKUP_REGION BACKUP_KMS_KEY_ID \
         BACKUP_WRITER_AWS_ACCESS_KEY_ID BACKUP_WRITER_AWS_SECRET_ACCESS_KEY; do
    load_env_var "$v"
done

BACKUP_REGION="${BACKUP_REGION:-us-west-2}"
ENCRYPT=${BACKUP_ENCRYPTION_KEY:+true}
ENCRYPT=${ENCRYPT:-false}
S3_ENABLED=${BACKUP_S3_BUCKET:+true}
S3_ENABLED=${S3_ENABLED:-false}

# Parse args
REMOTE_ONLY=false
LIST_ONLY=false
NO_S3=false
for arg in "$@"; do
    case "$arg" in
        --remote-only) REMOTE_ONLY=true ;;
        --list) LIST_ONLY=true ;;
        --no-s3) NO_S3=true ;;
    esac
done

if [ "$NO_S3" = true ]; then
    S3_ENABLED=false
fi

# When S3 is enabled, encryption is MANDATORY (gap G-13).
if [ "$S3_ENABLED" = true ] && [ "$ENCRYPT" = false ]; then
    echo "ERROR: BACKUP_S3_BUCKET is set but BACKUP_ENCRYPTION_KEY is not." >&2
    echo "       Encryption is mandatory when S3 upload is enabled (gap G-13)." >&2
    echo "       Set BACKUP_ENCRYPTION_KEY in .env.local or pass --no-s3 to skip S3." >&2
    exit 1
fi

# List mode
if [ "$LIST_ONLY" = true ]; then
    echo "=== Backups on EC2 ==="
    ssh "$EC2_USER@$EC2_HOST" "ls -lh $BACKUP_DIR/insighthub-*.db $BACKUP_DIR/insighthub-*.db.enc 2>/dev/null || echo '  (no backups found)'"
    echo ""
    echo "=== Local backups ==="
    if [ -d "$LOCAL_BACKUP_DIR" ]; then
        ls -lh "$LOCAL_BACKUP_DIR"/insighthub-*.db "$LOCAL_BACKUP_DIR"/insighthub-*.db.enc 2>/dev/null || echo "  (no backups found)"
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

# 2b. Encrypt the backup if BACKUP_ENCRYPTION_KEY is set
if [ "$ENCRYPT" = true ]; then
    echo "  Encrypting backup (AES-256-CBC)..."
    ssh "$EC2_USER@$EC2_HOST" "openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
        -in '$BACKUP_DIR/$BACKUP_NAME' \
        -out '$BACKUP_DIR/${BACKUP_NAME}.enc' \
        -pass 'pass:$BACKUP_ENCRYPTION_KEY'"
    # Securely remove the unencrypted backup
    ssh "$EC2_USER@$EC2_HOST" "shred -u '$BACKUP_DIR/$BACKUP_NAME' 2>/dev/null || rm -f '$BACKUP_DIR/$BACKUP_NAME'"
    BACKUP_NAME="${BACKUP_NAME}.enc"
    echo "  ✓ Encrypted → $BACKUP_NAME"
else
    echo "  ⚠ BACKUP_ENCRYPTION_KEY not set — backup stored UNENCRYPTED"
fi

# 2c. Upload to isolated S3 bucket in a different region (gap G-13)
if [ "$S3_ENABLED" = true ]; then
    if [ "$ENCRYPT" != true ]; then
        echo "  FATAL: cannot upload unencrypted backup to S3" >&2
        exit 1
    fi
    YEAR=$(date +%Y)
    MONTH=$(date +%m)
    DAY=$(date +%d)
    S3_KEY="${YEAR}/${MONTH}/${DAY}/${BACKUP_NAME}"
    echo "  Uploading to s3://${BACKUP_S3_BUCKET}/${S3_KEY} (region=${BACKUP_REGION})..."
    # Run the aws CLI on the EC2 host using the writer IAM credentials loaded from its .env.local.
    ssh "$EC2_USER@$EC2_HOST" "
        set -e
        cd $APP_DIR
        # shellcheck disable=SC1091
        set -o allexport
        . ./.env.local
        set +o allexport
        AWS_ACCESS_KEY_ID=\"\$BACKUP_WRITER_AWS_ACCESS_KEY_ID\" \
        AWS_SECRET_ACCESS_KEY=\"\$BACKUP_WRITER_AWS_SECRET_ACCESS_KEY\" \
        aws s3 cp '$BACKUP_DIR/$BACKUP_NAME' 's3://$BACKUP_S3_BUCKET/$S3_KEY' \
            --region '$BACKUP_REGION' \
            --sse aws:kms \
            --sse-kms-key-id \"\$BACKUP_KMS_KEY_ID\" \
            --only-show-errors
    "
    echo "  ✓ Uploaded to s3://${BACKUP_S3_BUCKET}/${S3_KEY}"
else
    echo "  ⚠ S3 upload skipped (BACKUP_S3_BUCKET unset or --no-s3 passed)"
fi

# 3. Prune old backups (keep last N days)
echo "[2/3] Pruning backups older than ${KEEP_DAYS} days..."
PRUNED=$(ssh "$EC2_USER@$EC2_HOST" "find $BACKUP_DIR \( -name 'insighthub-*.db' -o -name 'insighthub-*.db.enc' \) -mtime +$KEEP_DAYS -delete -print | wc -l")
echo "  ✓ Pruned $PRUNED old local backup(s) (S3 prune handled by bucket lifecycle policy)"

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
echo "  Remote (EC2):  $BACKUP_DIR/$BACKUP_NAME"
if [ "$S3_ENABLED" = true ]; then
    echo "  S3 (isolated): s3://${BACKUP_S3_BUCKET}/${S3_KEY}"
fi
if [ "$REMOTE_ONLY" = false ]; then
    echo "  Local:         $LOCAL_BACKUP_DIR/$BACKUP_NAME"
fi
echo ""
echo "To restore: ./scripts/restore-db.sh backups/$BACKUP_NAME"
echo "To restore from S3: ./scripts/restore-from-s3.sh --list  (then pick a key)"
