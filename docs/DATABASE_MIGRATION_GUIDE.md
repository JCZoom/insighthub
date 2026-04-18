# Database Migration Guide: SQLite → PostgreSQL

> When InsightHub needs to scale beyond a single server or support concurrent write-heavy
> workloads, migrate from SQLite to PostgreSQL. This is a **one-line Prisma provider change**
> plus a few schema adjustments.

## When to Migrate

Migrate when any of these become true:
- Multiple app servers need the same DB (horizontal scaling)
- Write concurrency causes `SQLITE_BUSY` errors under load
- You need full-text search beyond `LIKE` queries
- You need JSON columns for schema storage (instead of `JSON.stringify`)

**You do NOT need PostgreSQL for:**
- Single-server production (SQLite handles thousands of concurrent reads)
- < 10GB database size
- Moderate write load (SQLite WAL mode handles most workloads)

---

## Step-by-Step Migration

### 1. Provision PostgreSQL

**Option A: AWS RDS**
```bash
aws rds create-db-instance \
  --db-instance-identifier insighthub-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username insighthub \
  --master-user-password <SECURE_PASSWORD> \
  --allocated-storage 20
```

**Option B: Docker (for local dev)**
```bash
docker run -d --name insighthub-pg \
  -e POSTGRES_DB=insighthub \
  -e POSTGRES_USER=insighthub \
  -e POSTGRES_PASSWORD=insighthub_dev \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Update Prisma Provider

In `prisma/schema.prisma`:
```diff
 datasource db {
-  provider = "sqlite"
-  url      = env("DATABASE_URL")
+  provider = "postgresql"
+  url      = env("DATABASE_URL")
 }
```

### 3. Update DATABASE_URL

```bash
# .env.local
DATABASE_URL="postgresql://insighthub:PASSWORD@HOST:5432/insighthub?schema=public"
```

### 4. Re-add PostgreSQL-Specific Features

SQLite doesn't support some Prisma features. After switching the provider, you can
optionally re-add them for better performance and type safety.

#### JSON Columns (optional but recommended)

Dashboard schemas are currently stored as `String` and parsed with `JSON.parse()`.
With PostgreSQL, you can use native JSON:

```diff
 model DashboardVersion {
-  schema    String   // JSON stringified
+  schema    Json     // Native JSON column
 }
```

Then remove `JSON.parse()`/`JSON.stringify()` calls in:
- `src/app/api/dashboards/route.ts`
- `src/app/api/dashboards/[id]/route.ts`
- `src/app/api/chat/route.ts`

#### Enum Types (optional)

```diff
+enum Role {
+  VIEWER
+  CREATOR
+  POWER_USER
+  ADMIN
+}

 model User {
-  role        String    @default("VIEWER")
+  role        Role      @default(VIEWER)
 }
```

#### Array Fields (optional)

```diff
 model Dashboard {
-  tags        String?   // Comma-separated
+  tags        String[]
 }

 model GlossaryTerm {
-  relatedTerms String?  // Comma-separated
+  relatedTerms String[]
 }
```

Then remove `.split(',')` / `.join(',')` calls in API routes.

### 5. Push Schema and Migrate Data

```bash
# Generate new client
npx prisma generate

# Push schema (creates tables)
npx prisma db push

# Migrate data from SQLite backup
# Option A: Use prisma seed
npm run db:seed

# Option B: Export/import from SQLite
sqlite3 prisma/dev.db ".dump" > dump.sql
# Convert SQLite SQL to PostgreSQL SQL (manual step — see notes below)
psql $DATABASE_URL < dump_postgres.sql
```

### 6. Update docker-compose.yml

Uncomment the PostgreSQL service in `docker-compose.yml`:
```bash
# The file already has the PG config commented out
# Just uncomment it:
docker compose up -d
```

### 7. Verify

```bash
# Check health
curl -s https://dashboards.jeffcoy.net/api/health | jq .database

# Run tests against PG
DATABASE_URL="postgresql://..." npm run test:e2e
```

---

## SQLite → PostgreSQL SQL Differences

Common gotchas when migrating data:

| SQLite | PostgreSQL | Notes |
|--------|-----------|-------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` | Prisma handles this |
| `TEXT` | `TEXT` or `VARCHAR` | Same |
| `REAL` | `DOUBLE PRECISION` | Same behavior |
| `BLOB` | `BYTEA` | Rarely used |
| `datetime('now')` | `NOW()` | In seed scripts |
| No `BOOLEAN` type | `BOOLEAN` | SQLite uses 0/1 |
| `LIKE` is case-insensitive | `ILIKE` for case-insensitive | Update queries |

---

## Rollback Plan

If migration fails:

1. Point `DATABASE_URL` back to `file:./dev.db`
2. Change Prisma provider back to `sqlite`
3. Run `npx prisma generate`
4. Restart the service

The SQLite database file is preserved — switching back is instant.

---

## Checklist

- [ ] Provision PostgreSQL instance
- [ ] Create backup of SQLite database
- [ ] Update `prisma/schema.prisma` provider
- [ ] Update `DATABASE_URL` in `.env.local`
- [ ] Optionally add `Json`, `enum`, `String[]` types
- [ ] Run `npx prisma generate`
- [ ] Run `npx prisma db push`
- [ ] Seed or migrate data
- [ ] Update API routes if using native JSON columns
- [ ] Run full test suite
- [ ] Update `docker-compose.yml` (uncomment PG service)
- [ ] Deploy and verify health check
- [ ] Update monitoring scripts if needed
