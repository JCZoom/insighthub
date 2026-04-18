# Operations Runbook

> Quick reference for production operations, incident response, and troubleshooting.

## Production Details

| Item | Value |
|------|-------|
| **URL** | https://dashboards.jeffcoy.net |
| **Host** | `jeffreycoy@autoqa` (Tailscale SSH) |
| **IP** | `3.14.143.169` |
| **App dir** | `/opt/insighthub` |
| **Port** | 3001 |
| **Service** | `insighthub.service` (systemd) |
| **Proxy** | Nginx |
| **SSL** | Let's Encrypt (auto-renews via Certbot) |
| **Database** | SQLite at `/opt/insighthub/prisma/dev.db` |
| **Backups** | `/opt/insighthub/backups/` |
| **Logs** | `journalctl -u insighthub` |

---

## Quick Commands

```bash
# Connect
ssh jeffreycoy@autoqa

# Service
sudo systemctl status insighthub
sudo systemctl restart insighthub
sudo systemctl stop insighthub

# Logs (live)
sudo journalctl -u insighthub -f

# Logs (last 100 lines)
sudo journalctl -u insighthub -n 100 --no-pager

# Logs (since timestamp)
sudo journalctl -u insighthub --since "2026-04-18 12:00:00"

# Health check
curl -s https://dashboards.jeffcoy.net/api/health | python3 -m json.tool

# Nginx
sudo nginx -t                          # Test config
sudo systemctl reload nginx            # Reload
sudo tail -f /var/log/nginx/error.log  # Error log

# Database
sqlite3 /opt/insighthub/prisma/dev.db  # Interactive SQL
sqlite3 /opt/insighthub/prisma/dev.db 'SELECT COUNT(*) FROM User;'
sqlite3 /opt/insighthub/prisma/dev.db 'PRAGMA integrity_check;'

# SSL certificate
sudo certbot certificates
sudo certbot renew --dry-run
```

---

## Incident Response

### Site is down (no response)

1. **Check service:**
   ```bash
   ssh jeffreycoy@autoqa 'sudo systemctl status insighthub'
   ```

2. **If service is stopped/crashed — restart:**
   ```bash
   ssh jeffreycoy@autoqa 'sudo systemctl restart insighthub'
   ```

3. **If service is running but not responding — check logs:**
   ```bash
   ssh jeffreycoy@autoqa 'sudo journalctl -u insighthub -n 50 --no-pager'
   ```

4. **If Nginx is the issue:**
   ```bash
   ssh jeffreycoy@autoqa 'sudo nginx -t && sudo systemctl restart nginx'
   ```

5. **If EC2 is unreachable — check Tailscale:**
   ```bash
   tailscale status | grep autoqa
   ```

### Site returns 503 (degraded)

Health endpoint returns 503 when DB is disconnected.

1. **Check DB file exists:**
   ```bash
   ssh jeffreycoy@autoqa 'ls -la /opt/insighthub/prisma/dev.db'
   ```

2. **Check DB integrity:**
   ```bash
   ssh jeffreycoy@autoqa "sqlite3 /opt/insighthub/prisma/dev.db 'PRAGMA integrity_check'"
   ```

3. **If DB is corrupted — restore from backup:**
   ```bash
   ./scripts/restore-db.sh --latest
   ```

### Bad deploy (app broken after deploy)

1. **Immediate rollback:**
   ```bash
   ./deploy.sh --rollback
   ```

2. **If rollback fails — restore from pre-deploy backup:**
   ```bash
   ssh jeffreycoy@autoqa 'ls -lt /opt/insighthub/backups/pre-deploy-*.db | head -5'
   ./scripts/restore-db.sh --remote pre-deploy-YYYYMMDD-HHMMSS.db
   ```

### High memory usage

The health endpoint reports memory. Check:

```bash
curl -s https://dashboards.jeffcoy.net/api/health | python3 -c "
import sys, json
d = json.load(sys.stdin)
m = d['memory']
print(f'Heap: {m[\"heapUsedMB\"]}MB / {m[\"heapTotalMB\"]}MB')
print(f'RSS:  {m[\"rssMB\"]}MB')
print(f'Uptime: {d[\"uptime\"][\"seconds\"]}s')
"
```

If RSS > 400MB, restart:
```bash
ssh jeffreycoy@autoqa 'sudo systemctl restart insighthub'
```

### SSL certificate expired

Certbot auto-renews. If it fails:

```bash
ssh jeffreycoy@autoqa 'sudo certbot renew --force-renewal'
ssh jeffreycoy@autoqa 'sudo systemctl reload nginx'
```

---

## Deployment

### Normal deploy
```bash
./deploy.sh
```

### Deploy without DB backup (faster)
```bash
./deploy.sh --skip-backup
```

### Rollback to previous deploy
```bash
./deploy.sh --rollback
```

### Full first-time setup
```bash
./scripts/ec2-deploy.sh
```

---

## Database Operations

### Backup
```bash
./scripts/backup-db.sh                # Backup + download locally
./scripts/backup-db.sh --remote-only  # Backup on EC2 only
./scripts/backup-db.sh --list         # List all backups
```

### Restore
```bash
./scripts/restore-db.sh --latest                          # Most recent backup
./scripts/restore-db.sh --remote daily-20260418.db        # Specific EC2 backup
./scripts/restore-db.sh backups/insighthub-20260418.db    # From local file
```

### Schema changes
```bash
# On EC2:
ssh jeffreycoy@autoqa "cd /opt/insighthub && DATABASE_URL='file:/opt/insighthub/prisma/dev.db' npx prisma db push --accept-data-loss"
```

---

## Monitoring

### Manual health check
```bash
./scripts/monitor-health.sh
```

### Continuous monitoring
```bash
./scripts/monitor-health.sh --watch
```

### JSON output (for log aggregation)
```bash
./scripts/monitor-health.sh --json
```

### Check cron health logs
```bash
ssh jeffreycoy@autoqa 'tail -20 /var/log/insighthub/health.log'
```

---

## Cron Jobs

Managed by `scripts/setup-cron.sh`. Currently installed:

| Schedule | Task |
|----------|------|
| Every 5 min | Health check → `/var/log/insighthub/health.log` |
| Daily 3:00 AM | SQLite backup → `/opt/insighthub/backups/` |
| Sunday 4:00 AM | Prune backups older than 14 days |
| Monday midnight | Rotate health log (keep 4 weeks) |

### View/edit cron
```bash
ssh jeffreycoy@autoqa 'crontab -l'
ssh jeffreycoy@autoqa 'crontab -e'
```

### Reinstall cron jobs
```bash
./scripts/setup-cron.sh
```

---

## Infrastructure Files

Version-controlled configs in `infra/`:
- `infra/insighthub.service` — systemd unit file
- `infra/nginx.conf` — Nginx reverse proxy config

To update on EC2:
```bash
scp infra/insighthub.service jeffreycoy@autoqa:/tmp/
ssh jeffreycoy@autoqa 'sudo cp /tmp/insighthub.service /etc/systemd/system/ && sudo systemctl daemon-reload'

scp infra/nginx.conf jeffreycoy@autoqa:/tmp/
ssh jeffreycoy@autoqa 'sudo cp /tmp/nginx.conf /etc/nginx/sites-available/insighthub.conf && sudo nginx -t && sudo systemctl reload nginx'
```

---

## Useful SQL Queries

```sql
-- Active users
SELECT COUNT(*) FROM User;

-- Dashboard count
SELECT COUNT(*) FROM Dashboard WHERE archivedAt IS NULL;

-- Recent audit log
SELECT action, resourceType, createdAt FROM AuditLog ORDER BY createdAt DESC LIMIT 20;

-- Dashboard versions
SELECT d.title, COUNT(v.id) as versions
FROM Dashboard d JOIN DashboardVersion v ON v.dashboardId = d.id
GROUP BY d.id ORDER BY versions DESC;

-- DB file size
-- (run from shell: ls -lh /opt/insighthub/prisma/dev.db)
```
