#!/bin/bash
# Deploy InsightHub to EC2 via Tailscale SSH
# Usage: ./deploy.sh
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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
echo "=== InsightHub Deploy ==="
echo "  Commit: $GIT_COMMIT"
echo ""

# 1. Test SSH
echo "[1/5] Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 "$EC2_USER@$EC2_HOST" 'echo ok' >/dev/null 2>&1; then
    echo "ERROR: Cannot SSH to $EC2_USER@$EC2_HOST"
    echo "Make sure Tailscale is running and exit node is DISABLED."
    exit 1
fi
echo "  ✓ SSH connected"

# 2. Sync files
echo "[2/5] Syncing files to EC2..."
rsync -az --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.env.local' \
    --exclude 'prisma/dev.db' \
    --exclude 'prisma/dev.db-journal' \
    --exclude '.DS_Store' \
    "$SCRIPT_DIR/" "$EC2_USER@$EC2_HOST:$APP_DIR/"
echo "  ✓ Files synced"

# 3. Install deps + push schema
echo "[3/5] Installing dependencies & pushing schema..."
ssh "$EC2_USER@$EC2_HOST" "
    cd $APP_DIR &&
    npm ci --production=false 2>&1 | tail -3 &&
    echo '  ✓ Dependencies installed' &&
    DATABASE_URL='file:$APP_DIR/prisma/dev.db' npx prisma db push --accept-data-loss 2>&1 | tail -3 &&
    echo '  ✓ Schema pushed'
"

# 4. Build + package standalone
echo "[4/5] Building & packaging..."
ssh "$EC2_USER@$EC2_HOST" "
    cd $APP_DIR &&
    npm run build 2>&1 | tail -5 &&
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

# 5. Restart + health check
echo "[5/5] Restarting service..."
ssh "$EC2_USER@$EC2_HOST" "sudo systemctl restart insighthub"
sleep 5

for i in 1 2 3 4 5; do
    if curl -sf --max-time 10 "https://$SITE_DOMAIN/api/health" > /dev/null 2>&1; then
        echo "  ✓ Health check passed (attempt $i)"
        echo ""
        echo "=== Deploy Complete ==="
        echo "  https://$SITE_DOMAIN"
        exit 0
    fi
    echo "  Attempt $i failed, retrying in 5s..."
    sleep 5
done

echo "  ✗ Health check failed after 5 attempts"
echo "  Check logs: ssh $EC2_USER@$EC2_HOST 'sudo journalctl -u insighthub -n 50'"
exit 1
