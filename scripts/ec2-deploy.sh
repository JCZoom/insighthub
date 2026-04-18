#!/bin/bash
# Deploy InsightHub to EC2 via Tailscale SSH
# Usage: ./scripts/ec2-deploy.sh
#
# Prerequisites:
#   - Tailscale running with exit node DISABLED
#   - SSH access to jeffreycoy@autoqa
#   - Node.js 20+ installed on EC2
#
set -euo pipefail

EC2_HOST="jeffreycoy@autoqa"
APP_DIR="/opt/insighthub"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PORT=3001

echo "=== InsightHub EC2 Deploy ==="
echo ""

# 1. Test SSH connectivity
echo "[1/9] Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 "$EC2_HOST" 'echo ok' >/dev/null 2>&1; then
    echo "ERROR: Cannot SSH to $EC2_HOST"
    echo "Make sure Tailscale is running and exit node is DISABLED."
    exit 1
fi
echo "  ✓ SSH connected"

# 2. Ensure Node.js is available on EC2
echo "[2/9] Checking Node.js on EC2..."
NODE_VERSION=$(ssh "$EC2_HOST" 'node --version 2>/dev/null || echo "MISSING"')
if [ "$NODE_VERSION" = "MISSING" ]; then
    echo "  Installing Node.js 20.x..."
    ssh "$EC2_HOST" 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs'
fi
echo "  ✓ Node.js $(ssh "$EC2_HOST" 'node --version')"

# 3. Create app directory
echo "[3/9] Setting up app directory..."
ssh "$EC2_HOST" "sudo mkdir -p $APP_DIR && sudo chown jeffreycoy:jeffreycoy $APP_DIR"
echo "  ✓ Directory ready"

# 4. Sync project files (exclude dev artifacts)
echo "[4/9] Syncing project files..."
rsync -az --delete \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='prisma/dev.db' \
    --exclude='prisma/dev.db-journal' \
    --exclude='.env.local' \
    --exclude='.DS_Store' \
    --exclude='__pycache__' \
    "$PROJECT_DIR/" "$EC2_HOST:$APP_DIR/"
echo "  ✓ Files synced"

# 5. Sync environment variables
echo "[5/9] Syncing environment variables..."
if [ -f "$PROJECT_DIR/.env.local" ]; then
    # Create production .env.local on EC2
    # Filter out dev-only vars if needed, add production overrides
    TMPENV=$(mktemp)
    cat "$PROJECT_DIR/.env.local" > "$TMPENV"
    # Ensure production-specific settings
    if ! grep -q "^NEXTAUTH_URL=" "$TMPENV" 2>/dev/null; then
        echo "NEXTAUTH_URL=https://dashboards.jeffcoy.net" >> "$TMPENV"
    fi
    if ! grep -q "^NODE_ENV=" "$TMPENV" 2>/dev/null; then
        echo "NODE_ENV=production" >> "$TMPENV"
    fi
    scp -q "$TMPENV" "$EC2_HOST:$APP_DIR/.env.local"
    rm -f "$TMPENV"
    # Safety net: ensure NEXTAUTH_SECRET is ≥ 32 chars for production
    # (assertEnv() throws in production if it's shorter)
    SECRET_LEN=$(ssh "$EC2_HOST" "grep '^NEXTAUTH_SECRET=' $APP_DIR/.env.local | cut -d= -f2 | tr -d '\"' | tr -d \"'\" | wc -c | tr -d ' '")
    SECRET_LEN=$((SECRET_LEN - 1))  # subtract newline
    if [ "$SECRET_LEN" -lt 32 ]; then
        echo "  ⚠ NEXTAUTH_SECRET too short ($SECRET_LEN chars) — generating a secure 64-char secret"
        GEN_SECRET=$(openssl rand -base64 48)
        ssh "$EC2_HOST" "sed -i 's|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"$GEN_SECRET\"|' $APP_DIR/.env.local"
        echo "  ✓ Production NEXTAUTH_SECRET generated"
    fi
    echo "  ✓ Environment variables synced"
else
    echo "  ⚠ No .env.local found — you'll need to create one on EC2"
fi

# 6. Install dependencies and build
echo "[6/9] Installing dependencies & building..."
ssh "$EC2_HOST" "cd $APP_DIR && npm ci --production=false 2>&1 | tail -3"
echo "  ✓ Dependencies installed"

# Create prisma/.env so Prisma CLI can find DATABASE_URL (absolute path)
DB_PATH="$APP_DIR/prisma/dev.db"
ssh "$EC2_HOST" "echo 'DATABASE_URL=file:$DB_PATH' > $APP_DIR/prisma/.env"

ssh "$EC2_HOST" "cd $APP_DIR && npx prisma generate 2>&1 | tail -3"
echo "  ✓ Prisma client generated"

ssh "$EC2_HOST" "cd $APP_DIR && DATABASE_URL='file:$DB_PATH' npx prisma db push --accept-data-loss 2>&1 | tail -5"
echo "  ✓ Database schema pushed"

ssh "$EC2_HOST" "cd $APP_DIR && npm run build 2>&1 | tail -10"
echo "  ✓ Next.js build complete"

# Copy static assets into standalone (required for standalone output mode)
ssh "$EC2_HOST" "cp -r $APP_DIR/public $APP_DIR/.next/standalone/public 2>/dev/null || true"
ssh "$EC2_HOST" "cp -r $APP_DIR/.next/static $APP_DIR/.next/standalone/.next/static"
# Copy glossary YAML so the AI prompt can read it at runtime
ssh "$EC2_HOST" "cp -r $APP_DIR/glossary $APP_DIR/.next/standalone/glossary"
# Copy Prisma schema + engine for SQLite
ssh "$EC2_HOST" "cp -r $APP_DIR/prisma $APP_DIR/.next/standalone/prisma"
ssh "$EC2_HOST" "cp -r $APP_DIR/node_modules/.prisma $APP_DIR/.next/standalone/node_modules/.prisma 2>/dev/null || true"
ssh "$EC2_HOST" "cp -r $APP_DIR/node_modules/@prisma $APP_DIR/.next/standalone/node_modules/@prisma 2>/dev/null || true"
echo "  ✓ Static assets + runtime files copied to standalone"

# 7. Seed database (only if empty)
echo "[7/9] Seeding database if empty..."
ssh "$EC2_HOST" "cd $APP_DIR && DATABASE_URL='file:$DB_PATH' npx tsx prisma/seed.ts 2>&1 | tail -5 || echo '  (seed may have already run)'"
# Symlink DB in standalone dir to the canonical DB (so writes persist across deploys)
ssh "$EC2_HOST" "ln -sf $DB_PATH $APP_DIR/.next/standalone/prisma/dev.db 2>/dev/null || true"
# Ensure DB file is writable
ssh "$EC2_HOST" "chmod 664 $DB_PATH"
echo "  ✓ Database seeded"

# 8. Create/update systemd service
echo "[8/9] Setting up systemd service..."
ssh "$EC2_HOST" "sudo tee /etc/systemd/system/insighthub.service > /dev/null" <<SYSTEMD_EOF
[Unit]
Description=InsightHub — AI Dashboard Builder (Next.js)
After=network.target

[Service]
Type=exec
User=jeffreycoy
Group=jeffreycoy
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env.local
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=DATABASE_URL=file:$APP_DIR/prisma/dev.db
ExecStart=/usr/bin/node $APP_DIR/.next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF
ssh "$EC2_HOST" "sudo systemctl daemon-reload && sudo systemctl enable insighthub"
echo "  ✓ Systemd service configured"

# 9. Create/update Nginx config
echo "[9/9] Setting up Nginx config..."
if ssh "$EC2_HOST" "grep -q 'managed by Certbot' /etc/nginx/sites-available/insighthub.conf 2>/dev/null"; then
    echo "  ✓ Nginx config has Certbot SSL — preserving"
else
    echo "  Writing initial Nginx config (run certbot after first deploy for SSL)"
    ssh "$EC2_HOST" "sudo tee /etc/nginx/sites-available/insighthub.conf > /dev/null" <<NGINX_EOF
server {
    listen 80;
    server_name dashboards.jeffcoy.net;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
NGINX_EOF
    ssh "$EC2_HOST" "sudo ln -sf /etc/nginx/sites-available/insighthub.conf /etc/nginx/sites-enabled/insighthub.conf"
fi
ssh "$EC2_HOST" "sudo nginx -t && sudo systemctl reload nginx"
echo "  ✓ Nginx configured"

# Start/restart the service
echo ""
echo "Starting InsightHub..."
ssh "$EC2_HOST" "sudo systemctl restart insighthub"
sleep 4
if ssh "$EC2_HOST" "sudo systemctl is-active insighthub" >/dev/null 2>&1; then
    echo "  ✓ InsightHub service running on port $PORT"
else
    echo "  ✗ Service failed to start. Check logs:"
    echo "    ssh $EC2_HOST 'sudo journalctl -u insighthub -n 30'"
    exit 1
fi

echo ""
echo "=== Deploy Complete ==="
echo ""
echo "Next steps:"
echo "  1. Add DNS: dashboards.jeffcoy.net → CNAME ec2-3-14-143-169.us-east-2.compute.amazonaws.com"
echo "  2. Get SSL: ssh $EC2_HOST 'sudo certbot --nginx -d dashboards.jeffcoy.net'"
echo "  3. Test: https://dashboards.jeffcoy.net"
echo ""
echo "Useful commands:"
echo "  Logs:    ssh $EC2_HOST 'sudo journalctl -u insighthub -f'"
echo "  Status:  ssh $EC2_HOST 'sudo systemctl status insighthub'"
echo "  Restart: ssh $EC2_HOST 'sudo systemctl restart insighthub'"
