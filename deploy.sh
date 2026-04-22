#!/bin/bash
# Deploy InsightHub to EC2 via Tailscale SSH
#
# Usage:
#   ./deploy.sh                  # Normal deploy
#   ./deploy.sh --skip-backup    # Skip pre-deploy DB backup
#   ./deploy.sh --rollback       # Rollback to previous deploy
#
# Prerequisites:
#   - Tailscale running (exit node DISABLED)
#   - SSH access to jeffreycoy@autoqa
#
set -euo pipefail

EC2_USER="jeffreycoy"
EC2_HOST="autoqa"
APP_DIR="/opt/insighthub"
SITE_DOMAIN="dashboards.jeffcoy.net"
BACKUP_DIR="$APP_DIR/backups"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
SKIP_BACKUP=false
ROLLBACK=false

for arg in "$@"; do
    case "$arg" in
        --skip-backup) SKIP_BACKUP=true ;;
        --rollback) ROLLBACK=true ;;
    esac
done

# ── Rollback Mode ──────────────────────────────────────────
if [ "$ROLLBACK" = true ]; then
    echo "=== InsightHub Rollback ==="
    echo ""
    echo "Finding previous deployment..."
    PREV_BUILD=$(ssh "$EC2_USER@$EC2_HOST" "ls -1td $APP_DIR/.next-previous 2>/dev/null | head -1")
    if [ -z "$PREV_BUILD" ] || ! ssh "$EC2_USER@$EC2_HOST" "test -d $APP_DIR/.next-previous"; then
        echo "ERROR: No previous deployment found to rollback to."
        exit 1
    fi
    echo "  Rolling back to previous build..."
    ssh "$EC2_USER@$EC2_HOST" "
        cd $APP_DIR &&
        rm -rf .next &&
        mv .next-previous .next &&
        sudo systemctl restart insighthub
    "
    sleep 5
    if curl -sf --max-time 10 "https://$SITE_DOMAIN/api/health" > /dev/null 2>&1; then
        echo "  ✓ Rollback successful — health check passed"
    else
        echo "  ⚠ Rollback done but health check failed"
        echo "  Check logs: ssh $EC2_USER@$EC2_HOST 'sudo journalctl -u insighthub -n 30'"
    fi
    exit 0
fi

# ── Normal Deploy ──────────────────────────────────────────
echo "=== InsightHub Deploy ==="
echo "  Commit:  $GIT_COMMIT"
echo "  Branch:  $GIT_BRANCH"
echo "  Time:    $TIMESTAMP"
echo ""

# 1. Test SSH
echo "[1/7] Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 "$EC2_USER@$EC2_HOST" 'echo ok' >/dev/null 2>&1; then
    echo "ERROR: Cannot SSH to $EC2_USER@$EC2_HOST"
    echo "Make sure Tailscale is running and exit node is DISABLED."
    exit 1
fi
echo "  ✓ SSH connected"

# 2. Pre-deploy DB backup
if [ "$SKIP_BACKUP" = true ]; then
    echo "[2/7] Skipping DB backup (--skip-backup)"
else
    echo "[2/7] Creating pre-deploy database backup..."
    ssh "$EC2_USER@$EC2_HOST" "
        mkdir -p $BACKUP_DIR &&
        sqlite3 $APP_DIR/prisma/dev.db '.backup $BACKUP_DIR/pre-deploy-$TIMESTAMP.db' 2>/dev/null || echo '  (no existing DB to backup)'
    "
    echo "  ✓ Backup saved: pre-deploy-$TIMESTAMP.db"
fi

# 3. Preserve previous build for rollback
echo "[3/7] Preserving previous build for rollback..."
ssh "$EC2_USER@$EC2_HOST" "
    cd $APP_DIR &&
    rm -rf .next-previous &&
    cp -r .next .next-previous 2>/dev/null || echo '  (no previous build to preserve)'
"
echo "  ✓ Previous build preserved"

# 4. Sync files
echo "[4/7] Syncing files to EC2..."
rsync -az --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.next-previous' \
    --exclude '.env.local' \
    --exclude 'prisma/dev.db' \
    --exclude 'prisma/dev.db-journal' \
    --exclude 'backups' \
    --exclude 'e2e/test-results' \
    --exclude 'e2e/playwright-report' \
    --exclude '.DS_Store' \
    "$SCRIPT_DIR/" "$EC2_USER@$EC2_HOST:$APP_DIR/"
echo "  ✓ Files synced"

# 5. Install deps + push schema
echo "[5/7] Installing dependencies & pushing schema..."
ssh "$EC2_USER@$EC2_HOST" "
    cd $APP_DIR &&
    npm ci --production=false 2>&1 | tail -3 &&
    echo '  ✓ Dependencies installed' &&
    DATABASE_URL='file:$APP_DIR/prisma/dev.db' npx prisma db push --accept-data-loss 2>&1 | tail -3 &&
    echo '  ✓ Schema pushed'
"

# 6. Build + package standalone
echo "[6/7] Building & packaging..."
ssh "$EC2_USER@$EC2_HOST" "
    cd $APP_DIR &&
    GIT_COMMIT='$GIT_COMMIT' npm run build 2>&1 | tail -5 &&
    echo '  ✓ Build complete' &&
    cp -r public .next/standalone/public 2>/dev/null || true &&
    cp -r .next/static .next/standalone/.next/static &&
    cp -r glossary .next/standalone/glossary &&
    cp -r prisma .next/standalone/prisma &&
    ln -sf $APP_DIR/prisma/dev.db .next/standalone/prisma/dev.db 2>/dev/null || true &&
    cp -r node_modules/.prisma .next/standalone/node_modules/.prisma 2>/dev/null || true &&
    cp -r node_modules/@prisma .next/standalone/node_modules/@prisma 2>/dev/null || true &&
    echo '  ✓ Standalone packaged'
"

# 7. Restart + health check
echo "[7/7] Restarting service..."
# Inject GIT_COMMIT into the systemd environment
ssh "$EC2_USER@$EC2_HOST" "
    sudo systemctl set-environment GIT_COMMIT='$GIT_COMMIT' 2>/dev/null || true
    sudo systemctl restart insighthub
"
sleep 5

for i in 1 2 3 4 5; do
    if curl -sf --max-time 10 "https://$SITE_DOMAIN/api/health" > /dev/null 2>&1; then
        echo "  ✓ Health check passed (attempt $i)"
        echo ""
        echo "=== Deploy Complete ==="
        echo "  URL:      https://$SITE_DOMAIN"
        echo "  Commit:   $GIT_COMMIT"
        echo "  Rollback: ./deploy.sh --rollback"
        exit 0
    fi
    echo "  Attempt $i failed, retrying in 5s..."
    sleep 5
done

echo ""
echo "  ✗ Health check failed after 5 attempts"
echo "  Auto-rolling back to previous build..."
ssh "$EC2_USER@$EC2_HOST" "
    cd $APP_DIR &&
    if [ -d .next-previous ]; then
        rm -rf .next &&
        mv .next-previous .next &&
        sudo systemctl restart insighthub &&
        echo '  ✓ Rolled back to previous build'
    else
        echo '  ✗ No previous build available for rollback'
    fi
"
echo "  Check logs: ssh $EC2_USER@$EC2_HOST 'sudo journalctl -u insighthub -n 50'"
exit 1
