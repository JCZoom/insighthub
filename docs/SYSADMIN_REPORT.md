# InsightHub — Sysadmin Operations Guide

**Application:** InsightHub — AI-Powered Dashboard Builder  
**Production URL:** https://dashboards.jeffcoy.net  
**EC2 Host:** `jeffreycoy@autoqa` (via Tailscale)  
**App Directory:** `/opt/insighthub`  
**Review Date:** April 18, 2026

---

## Executive Summary

InsightHub runs as a Node.js 20 application on a single EC2 instance, managed by systemd, behind an Nginx reverse proxy with Certbot TLS. The database is SQLite (single file). Deployment is via rsync over Tailscale SSH with automatic rollback on health check failure.

This report covers server configuration, deployment procedures, database management, monitoring, environment variables, Nginx configuration, backup/restore, troubleshooting, and operational recommendations.

---

## 1. Server Configuration

### 1.1 Runtime Environment

| Component | Value | Location |
|-----------|-------|----------|
| **OS** | Ubuntu (EC2) | — |
| **Node.js** | 20.x | `/usr/bin/node` |
| **App Runtime** | Next.js 16 standalone | `/opt/insighthub/.next/standalone/server.js` |
| **Database** | SQLite 3 | `/opt/insighthub/prisma/dev.db` |
| **Process Manager** | systemd | `insighthub.service` |
| **Reverse Proxy** | Nginx | `/etc/nginx/sites-available/insighthub.conf` |
| **TLS** | Certbot (Let's Encrypt) | Auto-renew via Certbot timer |
| **SSH Access** | Tailscale VPN only | `jeffreycoy@autoqa` |

### 1.2 Systemd Service

**Service file:** `/etc/systemd/system/insighthub.service`  
**Source:** `infra/insighthub.service`

```ini
[Unit]
Description=InsightHub — AI Dashboard Builder (Next.js)
After=network.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=exec
User=jeffreycoy
Group=jeffreycoy
WorkingDirectory=/opt/insighthub
EnvironmentFile=/opt/insighthub/.env.local
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DATABASE_URL=file:/opt/insighthub/prisma/dev.db
ExecStart=/usr/bin/node /opt/insighthub/.next/standalone/server.js
Restart=always
RestartSec=5

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/insighthub/prisma /opt/insighthub/backups /opt/insighthub/logs
PrivateTmp=yes

# Resource limits
MemoryMax=512M
CPUQuota=80%

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=insighthub

[Install]
WantedBy=multi-user.target
```

**Key details:**
- Runs as non-root user `jeffreycoy`
- Memory capped at 512 MB, CPU at 80%
- Filesystem is read-only except for DB, backups, and logs directories
- Auto-restarts on failure with 5-second delay
- Rate-limited to 5 restarts within 300 seconds (prevents crash loops)

### 1.3 Common Service Commands

```bash
# Status
sudo systemctl status insighthub

# Start / Stop / Restart
sudo systemctl start insighthub
sudo systemctl stop insighthub
sudo systemctl restart insighthub

# View logs (last 50 lines)
sudo journalctl -u insighthub -n 50

# Follow logs in real-time
sudo journalctl -u insighthub -f

# View logs since last boot
sudo journalctl -u insighthub -b

# Enable / disable on boot
sudo systemctl enable insighthub
sudo systemctl disable insighthub

# Reload after editing service file
sudo systemctl daemon-reload
```

---

## 2. Nginx Configuration

**Config file:** `/etc/nginx/sites-available/insighthub.conf`  
**Source:** `infra/nginx.conf`  
**Symlink:** `/etc/nginx/sites-enabled/insighthub.conf`

### 2.1 Key Configuration

```nginx
# Rate limiting: 10 requests/sec per IP, burst of 20
limit_req_zone $binary_remote_addr zone=insighthub_api:10m rate=10r/s;

upstream insighthub {
    server 127.0.0.1:3001;
    keepalive 8;
}

server {
    listen 80;
    server_name dashboards.jeffcoy.net;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;

    # Static assets — 1 year cache
    location /_next/static/ {
        proxy_pass http://insighthub;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # API rate limiting
    location /api/ {
        limit_req zone=insighthub_api burst=20 nodelay;
        limit_req_status 429;
        proxy_pass http://insighthub;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # Health check — no rate limit
    location = /api/health {
        proxy_pass http://insighthub;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_read_timeout 10s;
    }

    # Default — proxy to Next.js
    location / {
        proxy_pass http://insighthub;
        # ... standard proxy headers
    }
}
```

### 2.2 Important Notes

- **Certbot** modifies this file to add SSL blocks. The deploy script (`scripts/ec2-deploy.sh:155–156`) detects and preserves Certbot modifications.
- **Rate limiting** is per-IP at the Nginx layer (10 req/s). The app also has per-user rate limiting (30 req/min for chat, 60 req/min for dashboards).
- Health check endpoint is **exempt** from rate limiting to prevent monitoring false positives.

### 2.3 Nginx Commands

```bash
# Test config syntax
sudo nginx -t

# Reload (graceful — no downtime)
sudo systemctl reload nginx

# Restart (brief downtime)
sudo systemctl restart nginx

# View access logs
sudo tail -f /var/log/nginx/access.log

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### 2.4 TLS Certificate

```bash
# Initial setup (first time only)
sudo certbot --nginx -d dashboards.jeffcoy.net

# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Auto-renewal is handled by the certbot systemd timer
sudo systemctl status certbot.timer
```

---

## 3. Environment Variables

**File:** `/opt/insighthub/.env.local`  
**Source template:** `.env.example`

### 3.1 Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `file:/opt/insighthub/prisma/dev.db` |
| `NEXTAUTH_SECRET` | JWT signing secret (min 32 chars in production) | Auto-generated by deploy script |
| `NEXTAUTH_URL` | Canonical app URL | `https://dashboards.jeffcoy.net` |

### 3.2 API Keys

| Variable | Service | Required |
|----------|---------|----------|
| `ANTHROPIC_API_KEY` | Claude AI (chat) | Yes — AI chat fails without it |
| `OPENAI_API_KEY` | Whisper (voice transcription) | No — voice input disabled without it |
| `GOOGLE_CLIENT_ID` | Google OAuth | Yes — login fails in production |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Yes — login fails in production |

### 3.3 Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_DOMAIN` | `uszoom.com` | Email domain allowed for login |
| `NEXT_PUBLIC_DEV_MODE` | `false` | **NEVER set to true in production** — bypasses auth |
| `NODE_ENV` | `production` | Set by systemd service |
| `PORT` | `3001` | Set by systemd service |
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | Minimum log level |
| `GIT_COMMIT` | Set by deploy | Shown in health endpoint |

### 3.4 Snowflake Variables (Phase 3 — currently unused)

```
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USERNAME=
SNOWFLAKE_PASSWORD=
SNOWFLAKE_WAREHOUSE=
SNOWFLAKE_DATABASE=
SNOWFLAKE_SCHEMA=
```

### 3.5 Asana Integration

```
ASANA_PERSONAL_ACCESS_TOKEN=
ASANA_WORKSPACE_GID=
ASANA_PROJECT_GID=
```

### 3.6 Environment Validation

At server startup, `src/lib/env.ts` validates all environment variables and:
- **Throws** if required vars are missing (prevents broken startup)
- **Warns** for missing optional vars
- **Validates** format (e.g., API key prefixes, NEXTAUTH_SECRET length)
- **Alerts** if dev mode is on in production

This runs via `src/instrumentation.ts` → `assertEnv()`.

---

## 4. Deployment

### 4.1 Quick Deploy (Routine Updates)

```bash
# From local machine (requires Tailscale)
./deploy.sh
```

**What it does:**
1. Tests SSH connectivity to `jeffreycoy@autoqa`
2. Creates pre-deploy database backup
3. Preserves previous build for rollback
4. Rsyncs project files (excluding node_modules, .next, .env.local, DB)
5. Runs `npm ci` + `prisma db push` on EC2
6. Builds Next.js + packages standalone output
7. Restarts systemd service
8. Health check with 5 retries (auto-rollbacks on failure)

**Source:** `deploy.sh` (180 lines)

### 4.2 First-Time EC2 Setup

```bash
# Full infrastructure setup (Node.js install, directory creation, Nginx, systemd)
./scripts/ec2-deploy.sh
```

**What it does:**
1. Tests SSH connectivity
2. Installs Node.js 20.x if missing
3. Creates `/opt/insighthub` with correct ownership
4. Rsyncs all project files
5. Syncs `.env.local` to EC2 (auto-generates NEXTAUTH_SECRET if too short)
6. Installs dependencies, generates Prisma client, pushes schema
7. Builds Next.js, copies static assets + Prisma engine to standalone
8. Seeds database if empty
9. Creates systemd service and Nginx config

**Source:** `scripts/ec2-deploy.sh` (209 lines)

### 4.3 Rollback

```bash
# Rollback to previous deployment
./deploy.sh --rollback
```

This swaps `.next` with `.next-previous` and restarts the service. Only one rollback level is preserved.

### 4.4 Skip Backup

```bash
# Deploy without pre-deploy DB backup
./deploy.sh --skip-backup
```

### 4.5 Standalone Output Structure

After build, the standalone directory must contain:

```
/opt/insighthub/.next/standalone/
├── server.js              # Node.js entry point
├── public/                # Static assets
├── .next/static/          # Compiled CSS/JS
├── glossary/              # YAML terms (read at runtime by AI)
├── prisma/
│   └── dev.db → symlink   # Points to /opt/insighthub/prisma/dev.db
├── node_modules/
│   ├── .prisma/           # Prisma engine binaries
│   └── @prisma/           # Prisma client
└── package.json
```

The deploy script copies these manually because Next.js standalone mode doesn't include them automatically.

---

## 5. Database Management

### 5.1 Database Info

| Property | Value |
|----------|-------|
| **Engine** | SQLite 3 |
| **File** | `/opt/insighthub/prisma/dev.db` |
| **Permissions** | `chmod 664` |
| **ORM** | Prisma 5 |
| **Standalone symlink** | `/opt/insighthub/.next/standalone/prisma/dev.db → /opt/insighthub/prisma/dev.db` |

### 5.2 Backup

```bash
# Create backup on EC2 + download to local machine
./scripts/backup-db.sh

# Create backup on EC2 only (no download)
./scripts/backup-db.sh --remote-only

# List all backups (EC2 + local)
./scripts/backup-db.sh --list
```

**Source:** `scripts/backup-db.sh` (91 lines)

**Details:**
- Uses `sqlite3 .backup` for safe online backup (handles WAL mode and locking)
- Verifies backup size (rejects suspiciously small files)
- Auto-prunes backups older than 14 days
- Downloads to `backups/` directory (gitignored)

**Cron setup (daily at 3 AM on EC2):**
```bash
0 3 * * * /opt/insighthub/scripts/backup-db.sh --remote-only >> /var/log/insighthub-backup.log 2>&1
```

### 5.3 Restore

```bash
# Restore most recent EC2 backup
./scripts/restore-db.sh --latest

# Restore specific EC2 backup
./scripts/restore-db.sh --remote insighthub-20260418-030000.db

# Restore from local file
./scripts/restore-db.sh backups/insighthub-20260418-030000.db
```

**Source:** `scripts/restore-db.sh` (139 lines)

**Safety features:**
- Validates SQLite integrity (`PRAGMA integrity_check`)
- Shows record counts before restore (sanity check)
- Requires interactive confirmation (`y/N`)
- Creates pre-restore backup automatically
- Stops service before replacing DB
- Restarts service and runs health check
- Auto-rolls back to pre-restore backup if service fails to start

### 5.4 Schema Migrations

```bash
# Push schema changes (non-destructive in most cases)
ssh jeffreycoy@autoqa "cd /opt/insighthub && DATABASE_URL='file:/opt/insighthub/prisma/dev.db' npx prisma db push --accept-data-loss"
```

**Note:** `--accept-data-loss` is used because SQLite doesn't support all Prisma migration features. For production PostgreSQL (Phase 3), use `prisma migrate deploy` instead.

### 5.5 Database Inspection

```bash
# Open Prisma Studio (web UI for browsing data)
ssh -L 5555:localhost:5555 jeffreycoy@autoqa
# Then on EC2:
cd /opt/insighthub && DATABASE_URL='file:/opt/insighthub/prisma/dev.db' npx prisma studio --port 5555

# Direct SQLite access
ssh jeffreycoy@autoqa "sqlite3 /opt/insighthub/prisma/dev.db"
# Useful queries:
#   .tables
#   SELECT COUNT(*) FROM User;
#   SELECT COUNT(*) FROM Dashboard;
#   SELECT COUNT(*) FROM AuditLog;
#   PRAGMA integrity_check;
```

### 5.6 Seed / Re-seed

```bash
# Seed sample data (skips if data already exists)
ssh jeffreycoy@autoqa "cd /opt/insighthub && DATABASE_URL='file:/opt/insighthub/prisma/dev.db' npx tsx prisma/seed.ts"
```

The seed creates: 1 admin user, 4 template dashboards, glossary terms, 5,000 sample customers, ~50,000 tickets, 200 deals, usage data, and 18 months of revenue events.

---

## 6. Monitoring

### 6.1 Health Endpoint

`GET https://dashboards.jeffcoy.net/api/health`

Returns JSON:
```json
{
  "status": "ok",
  "timestamp": "2026-04-18T21:00:00.000Z",
  "version": "0.1.0",
  "uptime": { "seconds": 86400, "since": "2026-04-17T21:00:00.000Z" },
  "database": { "status": "connected", "latencyMs": 2 },
  "ai": "configured",
  "memory": { "heapUsedMB": 128, "heapTotalMB": 256, "rssMB": 300 },
  "commit": "abc1234",
  "node": "v20.18.0"
}
```

**Response codes:**
- `200` — healthy
- `503` — degraded (database disconnected)

### 6.2 Health Monitor Script

```bash
# One-shot check
./scripts/monitor-health.sh

# Output example:
# ✅ [2026-04-18T21:00:00Z] HEALTHY — 150ms | DB: 2ms | Heap: 128MB | Uptime: 86400s

# Continuous monitoring (every 60s)
./scripts/monitor-health.sh --watch

# JSON output (for piping to log aggregation)
./scripts/monitor-health.sh --json
```

**Source:** `scripts/monitor-health.sh` (89 lines)

**Cron setup (every 5 minutes on EC2):**
```bash
*/5 * * * * /opt/insighthub/scripts/monitor-health.sh --json >> /var/log/insighthub-health.log 2>&1
```

### 6.3 Production Health Tests

Playwright E2E tests can be run against production:
```bash
npm run test:e2e:prod
# Equivalent to:
# PLAYWRIGHT_BASE_URL=https://dashboards.jeffcoy.net npx playwright test e2e/production-health.spec.ts
```

**Tests:** health endpoint response, page load time (<5s), console errors, SSL validity, security headers.

### 6.4 Application Logs

```bash
# systemd journal (all app logs)
sudo journalctl -u insighthub -f

# Last 100 lines
sudo journalctl -u insighthub -n 100

# Since a specific time
sudo journalctl -u insighthub --since "2026-04-18 20:00:00"

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

**Log format in production:** JSON lines (one JSON object per line) with level, message, timestamp, and metadata. This is compatible with log aggregators like CloudWatch, Datadog, or ELK.

### 6.5 Key Metrics to Watch

| Metric | Healthy Range | Alert Threshold |
|--------|--------------|-----------------|
| Health check response | 200 OK | Non-200 or >5s response |
| DB latency | <10ms | >100ms |
| Heap memory | <256MB | >400MB (512MB max) |
| RSS memory | <350MB | >480MB |
| Uptime | Continuously increasing | Unexpected resets |
| Nginx 429 responses | Rare | Sustained burst = possible abuse |
| Nginx 5xx responses | Zero | Any occurrence |

---

## 7. Directory Structure on EC2

```
/opt/insighthub/
├── .env.local                    # Production environment variables (secrets!)
├── .next/
│   ├── standalone/               # Production server
│   │   ├── server.js
│   │   ├── public/
│   │   ├── .next/static/
│   │   ├── glossary/
│   │   ├── prisma/
│   │   │   └── dev.db → symlink
│   │   └── node_modules/
│   └── static/                   # Compiled assets
├── .next-previous/               # Previous build (for rollback)
├── prisma/
│   ├── dev.db                    # THE PRODUCTION DATABASE
│   ├── dev.db-journal            # SQLite WAL journal
│   └── schema.prisma             # Database schema
├── backups/
│   ├── pre-deploy-*.db           # Auto backups before each deploy
│   ├── pre-restore-*.db          # Auto backups before each restore
│   └── insighthub-*.db           # Scheduled backups
├── glossary/
│   └── terms.yaml                # Business glossary definitions
├── scripts/
│   ├── backup-db.sh
│   ├── restore-db.sh
│   └── monitor-health.sh
├── node_modules/                 # Full dependencies (for prisma CLI, seed)
├── package.json
└── package-lock.json
```

### 7.1 File Permissions

| Path | Owner | Permissions | Notes |
|------|-------|-------------|-------|
| `/opt/insighthub/` | `jeffreycoy:jeffreycoy` | `755` | App root |
| `.env.local` | `jeffreycoy:jeffreycoy` | `600` (recommended) | Contains secrets |
| `prisma/dev.db` | `jeffreycoy:jeffreycoy` | `664` | Must be writable by app |
| `backups/` | `jeffreycoy:jeffreycoy` | `755` | Backup storage |

**Systemd `ProtectSystem=strict`** makes the entire filesystem read-only except paths listed in `ReadWritePaths`: `/opt/insighthub/prisma`, `/opt/insighthub/backups`, `/opt/insighthub/logs`.

---

## 8. Network Configuration

### 8.1 Port Usage

| Port | Service | Binding | Access |
|------|---------|---------|--------|
| 80 | Nginx | `0.0.0.0` | Public (redirects to HTTPS after Certbot) |
| 443 | Nginx (Certbot) | `0.0.0.0` | Public (HTTPS) |
| 3001 | Node.js | `127.0.0.1` | Localhost only (via Nginx proxy) |

### 8.2 External Connections (Outbound from App)

| Destination | Protocol | Purpose |
|-------------|----------|---------|
| `api.anthropic.com` | HTTPS | Claude AI chat |
| `api.openai.com` | HTTPS | Whisper voice transcription |

### 8.3 SSH Access

```bash
# Via Tailscale (required — no public SSH)
ssh jeffreycoy@autoqa

# Prerequisites:
# - Tailscale running on your machine
# - Exit node DISABLED
# - SSH key authorized on EC2
```

### 8.4 DNS

```
dashboards.jeffcoy.net → CNAME → ec2-3-14-143-169.us-east-2.compute.amazonaws.com
```

---

## 9. Troubleshooting

### 9.1 Service Won't Start

```bash
# Check service status
sudo systemctl status insighthub

# Check recent logs
sudo journalctl -u insighthub -n 50

# Common causes:
# 1. Missing .env.local or required vars
#    → Check /opt/insighthub/.env.local exists with DATABASE_URL and NEXTAUTH_SECRET
# 2. Database file missing or corrupt
#    → sqlite3 /opt/insighthub/prisma/dev.db "PRAGMA integrity_check"
# 3. Port 3001 already in use
#    → sudo lsof -i :3001
# 4. Node.js version mismatch
#    → node --version (should be 20.x)
# 5. Missing Prisma engine
#    → cd /opt/insighthub && npx prisma generate
```

### 9.2 502 Bad Gateway (Nginx)

```bash
# App is down or not listening on port 3001
sudo systemctl status insighthub

# Check if port 3001 is open
curl -f http://127.0.0.1:3001/api/health

# Restart the app
sudo systemctl restart insighthub
```

### 9.3 429 Too Many Requests

```bash
# Check Nginx rate limiting
sudo grep "limiting" /var/log/nginx/error.log | tail -20

# Check app-level rate limits (logged in app output)
sudo journalctl -u insighthub | grep "Rate limit"

# Nginx: 10 req/sec per IP with burst of 20
# App: 60 req/min (dashboards), 30 req/min (chat) per user
```

### 9.4 Database Locked

```bash
# SQLite can only handle one writer at a time
# If you see "database is locked" errors:

# 1. Check for lingering processes
sudo lsof /opt/insighthub/prisma/dev.db

# 2. Check for journal file
ls -la /opt/insighthub/prisma/dev.db-journal

# 3. Restart the service (releases all locks)
sudo systemctl restart insighthub
```

### 9.5 SSL Certificate Expired

```bash
# Check certificate
sudo certbot certificates

# Renew
sudo certbot renew

# Force renew
sudo certbot renew --force-renewal

# Verify auto-renewal timer
sudo systemctl status certbot.timer
```

### 9.6 High Memory Usage

```bash
# Check via health endpoint
curl -s https://dashboards.jeffcoy.net/api/health | python3 -m json.tool

# Memory limit is 512MB (systemd MemoryMax)
# If approaching limit, the OOM killer will terminate the process
# systemd will auto-restart it

# Check system memory
free -h

# Check process memory
ps aux | grep node
```

### 9.7 Deploy Failed Mid-Way

```bash
# Auto-rollback should have triggered, but if not:
./deploy.sh --rollback

# Or manually on EC2:
ssh jeffreycoy@autoqa "
  cd /opt/insighthub &&
  rm -rf .next &&
  mv .next-previous .next &&
  sudo systemctl restart insighthub
"
```

---

## 10. Cron Jobs (Recommended Setup)

```bash
# Edit crontab on EC2
ssh jeffreycoy@autoqa
crontab -e

# Add these entries:
# Daily database backup at 3 AM
0 3 * * * /opt/insighthub/scripts/backup-db.sh --remote-only >> /var/log/insighthub-backup.log 2>&1

# Health check every 5 minutes
*/5 * * * * /opt/insighthub/scripts/monitor-health.sh --json >> /var/log/insighthub-health.log 2>&1
```

---

## 11. CI/CD Integration

### 11.1 GitHub Actions

Pipeline: `.github/workflows/ci.yml`

```
Push/PR to main:
  [parallel] TypeScript + ESLint
       ↓
     Build
       ↓
    E2E Tests

Manual trigger (workflow_dispatch):
       ↓
  Deploy to EC2
```

**Required GitHub Secrets:**
- `EC2_SSH_KEY` — ED25519 private key for SSH

**Required GitHub Variables:**
- `EC2_HOST` — EC2 hostname
- `EC2_USER` — SSH username (e.g., `jeffreycoy`)
- `APP_DIR` — App directory (e.g., `/opt/insighthub`)
- `SITE_DOMAIN` — Production domain (e.g., `dashboards.jeffcoy.net`)

### 11.2 Bitbucket Pipelines

Pipeline: `bitbucket-pipelines.yml`

**Required Bitbucket Repository Variables:**
- `SSH_PRIVATE_KEY` — Base64-encoded ED25519 key (`cat ~/.ssh/id_ed25519 | base64`)
- `EC2_HOST` — EC2 hostname
- `EC2_USER` — SSH username
- `EC2_KNOWN_HOSTS` — Output of `ssh-keyscan` (optional)
- `APP_DIR` — App directory
- `SITE_DOMAIN` — Production domain

---

## 12. Operational Recommendations

### Critical — Set Up Now

| # | Item | Details |
|---|------|---------|
| 1 | **Enable daily backups** | Add cron job for `backup-db.sh --remote-only` |
| 2 | **Enable health monitoring** | Add cron job for `monitor-health.sh --json` |
| 3 | **Restrict .env.local permissions** | `chmod 600 /opt/insighthub/.env.local` |
| 4 | **Verify Certbot auto-renewal** | `sudo systemctl status certbot.timer` |

### High — Plan This Quarter

| # | Item | Details |
|---|------|---------|
| 5 | **Set up log rotation** | `/var/log/insighthub-*.log` will grow unbounded; add logrotate config |
| 6 | **Off-site backup copies** | Sync backups to S3 or another region |
| 7 | **Alerting** | Pipe health check failures to Slack/PagerDuty/email |
| 8 | **Disk space monitoring** | SQLite DB + backups + logs can fill disk |
| 9 | **Firewall rules** | Verify EC2 security group only allows 80, 443, and Tailscale |

### Medium — Before Phase 3

| # | Item | Details |
|---|------|---------|
| 10 | **PostgreSQL migration** | Switch from SQLite to PostgreSQL for concurrent access |
| 11 | **Redis for rate limiting** | Replace in-memory rate limiter for horizontal scaling |
| 12 | **CDN for static assets** | CloudFront in front of Nginx |
| 13 | **Load balancer** | ALB + auto-scaling group for redundancy |
| 14 | **EBS encryption** | ⚠️ **Automation ready — awaiting IAM permissions. See §13 below.** |

---

## 13. EBS Volume Encryption (CISO §6.1) — Action Required

> **Status:** ⚠️ BLOCKED — Awaiting IAM permission grant from sysadmin  
> **Asana Task:** "ACTION NEEDED: Grant IAM Permissions for EBS Volume Encryption (CISO 6.1)"  
> **Priority:** High — Required for SOC 2 "Encryption at Rest" control  
> **CISO Reference:** `docs/CISO_REPORT.md` §6.1, Risk #4

### 13.1 Current State

The InsightHub EC2 instance's EBS root volume is **not encrypted at rest**. This is flagged as an open item in the CISO report (§6.1, SOC 2 Alignment §9.1).

| Property | Value |
|----------|-------|
| **Instance ID** | `i-07f1bf55da9c6c7a3` |
| **Region** | `us-east-2` |
| **AZ** | `us-east-2b` |
| **Volume** | 8 GB, gp3, ext4 |
| **Encrypted** | ❌ No |
| **IAM User** | `arn:aws:iam::734910107398:user/jeffreycoy-lambda-cli` |

### 13.2 What Has Been Done

1. **AWS CLI v2 installed** on the EC2 instance (`aws-cli/2.34.32`)
2. **Automation script written:** `scripts/enable-ebs-encryption.sh` — fully automates the encryption migration:
   - Enables default EBS encryption for the `us-east-2` region
   - Checks current volume encryption status
   - Creates snapshots of unencrypted volumes
   - Copies snapshots with encryption enabled (AWS-managed KMS key)
   - Creates new encrypted volumes from the encrypted snapshots
   - Stops the instance, swaps old volumes for encrypted ones, restarts
   - Verifies all volumes are encrypted post-migration
   - Tags old volumes and snapshots for cleanup
   - Estimated downtime: **5–10 minutes**
3. **IAM policy document written:** `scripts/iam-ebs-encryption-policy.json`
4. **EBS verification script updated:** `scripts/check-ebs-encryption.sh` (runs post-migration to confirm)

### 13.3 What the Sysadmin Needs to Do

The automation script is ready but **cannot run** because the current IAM user (`jeffreycoy-lambda-cli`) only has Lambda permissions. The sysadmin needs to grant EC2 permissions using one of these options:

#### Option A — Attach policy to existing IAM user (quickest, ~2 minutes)

1. Go to **AWS Console → IAM → Users → `jeffreycoy-lambda-cli`**
2. Click **"Add permissions"** → **"Attach policies directly"**
3. Click **"Create policy"** → **JSON** tab
4. Paste the policy JSON below (also at `scripts/iam-ebs-encryption-policy.json`)
5. Name it **`InsightHubEBSEncryption`** → Create policy
6. Back on the user page, search for `InsightHubEBSEncryption` and attach it

#### Option B — Create an EC2 instance profile (preferred long-term)

1. Create IAM role `InsightHubEC2Role` with EC2 trust policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": {"Service": "ec2.amazonaws.com"},
       "Action": "sts:AssumeRole"
     }]
   }
   ```
2. Attach the EBS encryption policy (same JSON below) to the role
3. Create an instance profile, add the role to it
4. Associate the instance profile with instance `i-07f1bf55da9c6c7a3`

This approach also enables future AWS API access from the instance without managing access keys.

### 13.4 IAM Policy JSON

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EBSEncryptionMigration",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeVolumes",
        "ec2:DescribeSnapshots",
        "ec2:CreateSnapshot",
        "ec2:CopySnapshot",
        "ec2:CreateVolume",
        "ec2:AttachVolume",
        "ec2:DetachVolume",
        "ec2:StopInstances",
        "ec2:StartInstances",
        "ec2:GetEbsEncryptionByDefault",
        "ec2:EnableEbsEncryptionByDefault",
        "ec2:ModifyInstanceAttribute",
        "ec2:CreateTags",
        "ec2:DeleteSnapshot",
        "ec2:DeleteVolume",
        "iam:CreateRole",
        "iam:CreateInstanceProfile",
        "iam:AddRoleToInstanceProfile",
        "iam:AttachRolePolicy",
        "iam:PassRole",
        "ec2:AssociateIamInstanceProfile",
        "ec2:DescribeIamInstanceProfileAssociations"
      ],
      "Resource": "*"
    }
  ]
}
```

> **Note:** The `iam:*` actions are only needed for Option B (instance profile creation). If using Option A, you can remove them from the policy and just grant the `ec2:*` actions.

### 13.5 Running the Encryption Migration

Once permissions are granted, run:

```bash
# From local machine (via Tailscale SSH)
ssh jeffreycoy@autoqa "sudo bash /opt/insighthub/scripts/enable-ebs-encryption.sh"

# Or deploy the updated scripts first, then run on EC2
./deploy.sh
ssh jeffreycoy@autoqa "sudo bash /opt/insighthub/scripts/enable-ebs-encryption.sh"
```

**Expected behavior:**
1. Enables default EBS encryption for `us-east-2`
2. Detects unencrypted root volume
3. Stops the InsightHub service (graceful)
4. Stops the EC2 instance (~1 min)
5. Creates snapshot → encrypted copy → new volume (~3-5 min)
6. Swaps volumes, starts instance
7. Restarts InsightHub service
8. Verifies encryption
9. **Total downtime: ~5-10 minutes**

### 13.6 Verification

After migration, verify with:

```bash
# On-instance verification
ssh jeffreycoy@autoqa "bash /opt/insighthub/scripts/check-ebs-encryption.sh"

# Health check
curl -sf https://dashboards.jeffcoy.net/api/health | python3 -m json.tool
```

### 13.7 Cleanup (After Confirming Stability)

The script tags old (replaced) volumes and intermediate snapshots with `EncryptionMigration=<timestamp>`. After confirming the instance is stable for 24-48 hours:

```bash
# List tagged resources
aws ec2 describe-volumes --region us-east-2 \
    --filters "Name=tag-key,Values=EncryptionMigration" \
    --query 'Volumes[].[VolumeId, State, Tags]' --output table

aws ec2 describe-snapshots --region us-east-2 --owner-ids self \
    --filters "Name=tag-key,Values=EncryptionMigration" \
    --query 'Snapshots[].[SnapshotId, State]' --output table

# Delete old volume and snapshots
aws ec2 delete-volume --region us-east-2 --volume-id <old-vol-id>
aws ec2 delete-snapshot --region us-east-2 --snapshot-id <snap-id>
```

### 13.8 Post-Migration CISO Report Update

After successful encryption, the following items in the CISO report should be updated:
- §6.1 table: EBS volume → ✅ Encrypted (AES-256, AWS-managed KMS)
- §9.1 SOC 2 table: "Encryption at Rest" → ✅
- §10 Risk #4: Mark as fully resolved

---

## Appendix: Key File Index for Operations

| Area | File | Description |
|------|------|-------------|
| **Systemd service** | `infra/insighthub.service` | Service definition (security hardening, resource limits) |
| **Nginx config** | `infra/nginx.conf` | Reverse proxy (rate limiting, caching, security headers) |
| **Deploy (routine)** | `deploy.sh` | Rsync + build + restart with auto-rollback (180 lines) |
| **Deploy (first-time)** | `scripts/ec2-deploy.sh` | Full EC2 setup: Node.js, dirs, env, build, systemd, Nginx (209 lines) |
| **DB backup** | `scripts/backup-db.sh` | Online backup with pruning + download (91 lines) |
| **DB restore** | `scripts/restore-db.sh` | Integrity check + restore with safety net (139 lines) |
| **Health monitor** | `scripts/monitor-health.sh` | One-shot/continuous health checking (89 lines) |
| **Env template** | `.env.example` | All environment variables with descriptions (32 lines) |
| **Env validation** | `src/lib/env.ts` | Startup validation (warns on missing, throws on invalid) |
| **Health endpoint** | `src/app/api/health/route.ts` | DB, memory, uptime checks (54 lines) |
| **Logger** | `src/lib/logger.ts` | JSON output in prod, human-readable in dev (114 lines) |
| **CI (GitHub)** | `.github/workflows/ci.yml` | TypeScript + ESLint + build + E2E + deploy (216 lines) |
| **CI (Bitbucket)** | `bitbucket-pipelines.yml` | Parallel pipeline with manual deploy (162 lines) |
| **Next.js config** | `next.config.ts` | Standalone output mode (10 lines) |
| **Prisma schema** | `prisma/schema.prisma` | Database schema (306 lines) |
| **Docker Compose** | `docker-compose.yml` | Placeholder for future PostgreSQL (37 lines) |
| **Rate limiter** | `src/lib/rate-limiter.ts` | App-level rate limiting configuration (275 lines) |
| **Gitignore** | `.gitignore` | Excluded files (env, DB, backups, node_modules) |
| **Prod health tests** | `e2e/production-health.spec.ts` | Latency, SSL, security header checks |
| **EBS encryption** | `scripts/enable-ebs-encryption.sh` | Full EBS encryption migration automation |
| **EBS check** | `scripts/check-ebs-encryption.sh` | Verify EBS volume encryption status |
| **EBS IAM policy** | `scripts/iam-ebs-encryption-policy.json` | IAM policy for EC2 encryption operations |
