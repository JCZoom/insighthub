#!/bin/bash
# Restore InsightHub SQLite DB from the cross-region isolated S3 bucket (gap G-13).
#
# This script uses the READER IAM credentials — NOT the writer credentials stored on EC2.
# Reader credentials should be kept in your password manager, NOT on EC2.
#
# Usage:
#   ./scripts/restore-from-s3.sh --list                    # List available backups in S3
#   ./scripts/restore-from-s3.sh --list 2026/04            # List a specific path
#   ./scripts/restore-from-s3.sh --download <s3-key>       # Download + decrypt to ./backups/
#   ./scripts/restore-from-s3.sh --restore <s3-key>        # Download, decrypt, and install into EC2 DB path
#
# Required environment (load these yourself from your password manager):
#   BACKUP_READER_AWS_ACCESS_KEY_ID
#   BACKUP_READER_AWS_SECRET_ACCESS_KEY
#   BACKUP_S3_BUCKET
#   BACKUP_REGION       (default: us-west-2)
#   BACKUP_ENCRYPTION_KEY
#
set -euo pipefail

# Require explicit reader credentials in env — do NOT auto-load from EC2 .env.local.
for v in BACKUP_READER_AWS_ACCESS_KEY_ID BACKUP_READER_AWS_SECRET_ACCESS_KEY \
         BACKUP_S3_BUCKET BACKUP_ENCRYPTION_KEY; do
    if [ -z "${!v:-}" ]; then
        echo "ERROR: $v not set. Load reader credentials from password manager." >&2
        exit 1
    fi
done
BACKUP_REGION="${BACKUP_REGION:-us-west-2}"
LOCAL_BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"

export AWS_ACCESS_KEY_ID="$BACKUP_READER_AWS_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BACKUP_READER_AWS_SECRET_ACCESS_KEY"

LIST=false
DOWNLOAD_KEY=""
RESTORE_KEY=""
LIST_PREFIX=""

while [ $# -gt 0 ]; do
    case "$1" in
        --list)
            LIST=true
            if [ $# -gt 1 ] && [[ "$2" != --* ]]; then
                LIST_PREFIX="$2"
                shift
            fi
            ;;
        --download)
            DOWNLOAD_KEY="$2"; shift
            ;;
        --restore)
            RESTORE_KEY="$2"; shift
            ;;
        -h|--help)
            grep -E '^#( |$)' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        *) echo "Unknown arg: $1"; exit 2 ;;
    esac
    shift
done

# ── List mode ────────────────────────────────────────────────────────
if [ "$LIST" = true ]; then
    echo "=== Backups in s3://${BACKUP_S3_BUCKET}/${LIST_PREFIX} ==="
    aws s3 ls "s3://${BACKUP_S3_BUCKET}/${LIST_PREFIX}" \
        --recursive --region "$BACKUP_REGION" \
        --human-readable --summarize
    exit 0
fi

# ── Download / restore mode ──────────────────────────────────────────
KEY="${DOWNLOAD_KEY:-$RESTORE_KEY}"
if [ -z "$KEY" ]; then
    echo "ERROR: pass --list, --download <key>, or --restore <key>" >&2
    exit 2
fi

mkdir -p "$LOCAL_BACKUP_DIR"
FILENAME=$(basename "$KEY")
LOCAL_ENC_PATH="$LOCAL_BACKUP_DIR/$FILENAME"
LOCAL_DEC_PATH="${LOCAL_ENC_PATH%.enc}"

echo "[1/3] Downloading s3://${BACKUP_S3_BUCKET}/${KEY}..."
aws s3 cp "s3://${BACKUP_S3_BUCKET}/${KEY}" "$LOCAL_ENC_PATH" \
    --region "$BACKUP_REGION" \
    --only-show-errors
echo "  ✓ Downloaded to $LOCAL_ENC_PATH"

echo "[2/3] Decrypting..."
if [[ "$LOCAL_ENC_PATH" == *.enc ]]; then
    openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 100000 \
        -in "$LOCAL_ENC_PATH" \
        -out "$LOCAL_DEC_PATH" \
        -pass "pass:$BACKUP_ENCRYPTION_KEY"
    echo "  ✓ Decrypted to $LOCAL_DEC_PATH"
else
    echo "  (file is not encrypted — skipping decrypt)"
    LOCAL_DEC_PATH="$LOCAL_ENC_PATH"
fi

# Verify decrypted DB is a valid SQLite file
if ! file "$LOCAL_DEC_PATH" | grep -q "SQLite"; then
    echo "  ✗ ERROR: decrypted file is not a valid SQLite database."
    exit 1
fi
SIZE=$(stat -f%z "$LOCAL_DEC_PATH" 2>/dev/null || stat -c%s "$LOCAL_DEC_PATH")
echo "  ✓ Verified SQLite database (${SIZE} bytes)"

if [ -n "$RESTORE_KEY" ]; then
    echo "[3/3] Restoring to EC2..."
    echo ""
    echo "This will COPY the decrypted backup to /opt/insighthub/prisma/dev.db on EC2."
    echo "The currently-live DB will be saved to /opt/insighthub/backups/pre-restore-\$(date).db."
    echo "Type 'RESTORE' to proceed:"
    read -r CONFIRM
    if [ "$CONFIRM" != "RESTORE" ]; then
        echo "Aborted. Decrypted backup retained at $LOCAL_DEC_PATH."
        exit 1
    fi
    TS=$(date +%Y%m%d-%H%M%S)
    scp -q "$LOCAL_DEC_PATH" "jeffreycoy@autoqa:/tmp/restore-${TS}.db"
    ssh jeffreycoy@autoqa "
        set -e
        sudo systemctl stop insighthub
        cp /opt/insighthub/prisma/dev.db /opt/insighthub/backups/pre-restore-${TS}.db 2>/dev/null || true
        cp /tmp/restore-${TS}.db /opt/insighthub/prisma/dev.db
        rm -f /tmp/restore-${TS}.db
        sudo systemctl start insighthub
    "
    echo "  ✓ Restored on EC2. Previous DB archived as backups/pre-restore-${TS}.db."
    echo "  Run health check: curl -sf https://dashboards.jeffcoy.net/api/health"
else
    echo "[3/3] Download complete. File at $LOCAL_DEC_PATH."
fi
