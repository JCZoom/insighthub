# 🔍 Sprint Review Report

**Date:** 2026-04-19 12:20
**Model:** claude-opus-4-20250514
**Base:** main
**Commits reviewed:** 10
**Files changed:** 70
**Review cost:** $1.9071

---

Here is the full code review report:

---

## 1. Executive Summary

This sprint delivers 10 commits across 70 files (+17,175 / -2,438 lines) adding: Snowflake connector with Redis caching, metric-level RBAC, Visual Query Builder, Query Playground, Data Explorer, GDPR endpoints (export + delete), admin settings, CSP hardening, chat retention, E2E tests, and dashboard schema validation.

The **security architecture is well-designed at the domain model level** -- metric-level RBAC, PII stripping, server-side enforcement, and audit logging are all present. However, there are **two SQL injection vectors** and a **settings API that accepts arbitrary nested objects past an allowlist that only checks top-level keys**. The Snowflake and Redis layers gracefully degrade when unavailable, which is good. The GDPR implementation is solid. Component sizes are large but acceptable for initial delivery.

**Verdict: This is good autonomous code that needs targeted fixes before merge.**

---

## 2. Scorecard

```
Category              Score   Notes
─────────────────────────────────────────────────────────
Security                6/10  SQL injection in buildSnowflakeQuery + QueryBuilder.select;
                              settings API shallow validation; PII stripping is string-match only
Architecture            7/10  Clean provider abstraction; file-based settings won't scale;
                              process.on handlers unsafe in serverless
Error Handling          7/10  Consistent try/catch; auth errors detected; fallbacks to sample data;
                              some swallowed errors
TypeScript Quality      6/10  Heavy use of `any` across Snowflake/Redis layers;
                              Record<string, any> in settings API
Testing                 5/10  E2E covers happy paths but test.skip on failure hides real issues;
                              zero unit tests for permissions, PII stripping, SQL generation
UX                      7/10  Permission indicators in widget config; clear error messages;
                              FILTERED access explanation; lock icons
Performance             6/10  Redis caching good; KEYS pattern scanning is O(n);
                              no metadata caching; schema rebuilt per request
─────────────────────────────────────────────────────────
OVERALL                6.3/10
```

---

## 3. Critical Issues

```
ISSUE       SQL injection in buildSnowflakeQuery
SEVERITY    CRITICAL
FILE        src/lib/data/snowflake-data-provider.ts
LINES       160-168
DESCRIPTION The `source` parameter falls through the tableMapping lookup to
            be interpolated directly into SQL when no mapping exists
            (line 160: `const tableName = tableMapping[source] || source`).
            The `groupBy` array elements are also concatenated directly into
            the SQL string (line 166-168). An attacker who controls `source`
            or `groupBy` values via the POST body can inject arbitrary SQL.
FIX         Reject any `source` that does not match the tableMapping allowlist.
            Validate `groupBy` entries against known column names. Use
            parameterized queries or at minimum identifier quoting.
SECTION     Security
```

```
ISSUE       SQL injection in SnowflakeQueryBuilder.select and .count
SEVERITY    CRITICAL
FILE        src/lib/snowflake/query-executor.ts
LINES       322-342, 347-365
DESCRIPTION The `table` and `columns` parameters in `SnowflakeQueryBuilder.select()`
            and `SnowflakeQueryBuilder.count()` are string-interpolated directly
            into SQL (`SELECT ${columnsStr} FROM ${table}`). The `where` clause
            keys (column names) are also interpolated without validation. These
            are utility functions likely called by application code, but if the
            table/column names ever originate from user input, this is exploitable.
FIX         Validate table and column names against an allowlist of known
            schema identifiers. Add identifier escaping at minimum. Consider
            using Snowflake's identifier quoting (`"identifier"`).
SECTION     Security
```

```
ISSUE       Settings API allows arbitrary nested object injection
SEVERITY    CRITICAL
FILE        src/app/api/admin/settings/route.ts
LINES       30-39
DESCRIPTION The PUT handler validates that top-level keys are in the allowlist
            (`features`, `defaults`, `ai`, `maintenance`), but the nested values
            under each key are not validated. An admin could write
            `{"features": {"enableSnowflakeConnector": true, "__proto__": {...}}}`
            or inject unexpected fields like `{"defaults": {"newUserRole": "SUPERADMIN"}}`.
            The `deepMerge` in settings.ts will accept any shape.
FIX         Validate the incoming body against the full SystemSettings Zod schema
            (matching the SystemSettings interface). Only accept known fields at
            every nesting level.
SECTION     Security
```

```
ISSUE       PII stripping is bypassable via column name aliasing
SEVERITY    CRITICAL
FILE        src/app/api/data/query/route.ts
LINES       9, 26-34
DESCRIPTION PII stripping checks field names against a hardcoded list
            (`name`, `email`, `company`, etc.). If Snowflake queries alias
            columns (`SELECT email AS user_email`), or if new columns are
            added with PII that don't match the list, data leaks through.
            The stripping only runs for `result.dataSource === 'sample'`
            (line 157), meaning Snowflake results skip this layer entirely,
            relying solely on the data-security.ts auto-detection which
            is regex-based.
FIX         Move PII stripping to a centralized layer that runs for ALL
            data sources. Use the auto-detection from data-security.ts
            as the primary mechanism for both sample and Snowflake paths.
            Consider a column tag registry rather than name matching.
SECTION     Security
```

---

## 4. Warnings

```
ISSUE       File-based settings storage incompatible with serverless/multi-instance
SEVERITY    WARNING
FILE        src/lib/settings.ts
LINES       1-6, 98-106
DESCRIPTION Settings are persisted to `data/system-settings.json` on the local
            filesystem. In serverless deployments (Vercel, Lambda) or
            multi-instance setups, each instance has its own copy. Changes
            on one instance are invisible to others. No file locking is used,
            so concurrent writes can corrupt the file.
FIX         Move settings to the database (Prisma model) or use a KV store.
            For the immediate term, add file locking and document the
            single-instance constraint.
SECTION     Architecture
```

```
ISSUE       process.on handlers in serverless context
SEVERITY    WARNING
FILE        src/lib/snowflake/connection.ts, src/lib/redis/client.ts
LINES       connection.ts:344-364, client.ts:341-362
DESCRIPTION Both files register process.on('exit'), process.on('SIGINT'),
            and process.on('SIGTERM') handlers to clean up connections.
            In serverless (Vercel/Lambda), these never fire reliably.
            The SIGINT handler calls process.exit(0), which can interfere
            with the Next.js server's own shutdown sequence.
FIX         Remove process.on handlers. Rely on connection idle timeouts
            and pool TTLs for cleanup. If needed, register cleanup via
            Next.js server lifecycle hooks.
SECTION     Architecture
```

```
ISSUE       Redis KEYS command used in production paths
SEVERITY    WARNING
FILE        src/lib/redis/client.ts
LINES       192, 221, 248
DESCRIPTION `clearUserCache`, `clearAllCache`, and `getStats` all use
            `this.redis.keys(pattern)` which is O(n) over all keys and
            blocks the Redis server. In production with many cached queries,
            this will cause latency spikes.
FIX         Use SCAN with cursor iteration instead of KEYS. For user-scoped
            cache clearing, consider using Redis hash sets per user.
SECTION     Performance
```

```
ISSUE       Cache hit detection is a heuristic, not deterministic
SEVERITY    WARNING
FILE        src/lib/snowflake/query-executor.ts
LINES       190
DESCRIPTION `fromCache = cachedResult.executionTime < 50` assumes that any
            result under 50ms came from cache. A fast Snowflake query would
            be reported as cached, and a slow cache read would be reported
            as uncached.
FIX         Have `executeCachedQuery` return a `{data, fromCache}` tuple
            so the cache layer explicitly reports whether it served from cache.
SECTION     Architecture
```

```
ISSUE       Audit log uses wrong AuditAction for GDPR endpoints
SEVERITY    WARNING
FILE        src/app/api/user/delete/route.ts, src/app/api/user/export/route.ts
LINES       delete:37, export:97
DESCRIPTION Both GDPR endpoints use `AuditAction.USER_LOGIN` as the action
            because there's no `USER_EXPORT` or `USER_DELETE` action. The audit
            trail for compliance-critical operations (data export, account
            deletion) will be indistinguishable from login events.
FIX         Add `USER_DATA_EXPORT` and `USER_ACCOUNT_DELETION` to the
            AuditAction enum. This is compliance-relevant.
SECTION     Security
```

```
ISSUE       Snowflake connection pool uses polling interval without backoff
SEVERITY    WARNING
FILE        src/lib/snowflake/connection.ts
LINES       75-93
DESCRIPTION When all connections are in use, `getConnection()` polls every
            100ms in a setInterval loop until one frees up or 30s timeout.
            Under load this burns CPU. No backoff or queuing strategy.
FIX         Replace polling with a proper queue (e.g., promise-based
            semaphore or event emitter on connection release).
SECTION     Performance
```

```
ISSUE       Visual-to-SQL formula expressions are passed through unvalidated
SEVERITY    WARNING
FILE        src/lib/data/visual-to-sql.ts
LINES       90-93
DESCRIPTION Formula fields have their `expression` property interpolated
            directly into the SQL SELECT clause (line 92:
            `${formula.expression} AS ${escapeIdentifier(alias)}`).
            If a user crafts a malicious expression, it becomes part
            of the query.
FIX         Validate formula expressions against a safe subset of SQL
            functions and operators. Reject or sandbox arbitrary expressions.
SECTION     Security
```

```
ISSUE       E2E tests silently skip on failure instead of failing
SEVERITY    WARNING
FILE        e2e/critical-flows.spec.ts
LINES       23-31
DESCRIPTION If the dashboard creation POST returns non-201 (e.g., because
            the DB isn't seeded), the test calls `test.skip()` instead of
            failing. Downstream tests also skip via `test.skip(!createdDashboardId)`.
            In CI, this means the entire E2E suite can silently pass with
            zero tests actually running.
FIX         Fail the test if the API returns an unexpected status. Use
            test fixtures or setup hooks to ensure the DB is seeded.
            At minimum, log a warning visible in CI output.
SECTION     Testing
```

```
ISSUE       isRedisConfigured always returns true with default URL
SEVERITY    WARNING
FILE        src/lib/redis/config.ts
LINES       39-42
DESCRIPTION `isRedisConfigured()` checks `!!config.url`, but `getRedisConfig()`
            defaults `REDIS_URL` to `'redis://localhost:6379'` when the env
            var is unset. So `isRedisConfigured()` always returns true even
            when Redis isn't actually available, causing connection errors on
            every cache operation until the error handler marks it unavailable.
FIX         Check for the presence of the REDIS_URL environment variable
            explicitly, not the default value.
SECTION     Architecture
```

```
ISSUE       Query parameter sanitization strips characters instead of using parameterized queries
SEVERITY    WARNING
FILE        src/lib/snowflake/query-executor.ts
LINES       71-97
DESCRIPTION `sanitizeParameters()` strips quotes and semicolons from string
            values (line 82). This is a blacklist approach to SQL injection
            prevention. The Snowflake SDK supports parameterized queries
            natively, which is already used in `executeParameterizedQuery`.
            The sanitization is redundant and potentially lossy (legitimate
            values containing quotes get corrupted).
FIX         Remove the character-stripping sanitization. Rely entirely on
            parameterized queries (bind variables) for injection prevention.
SECTION     Security
```

---

## 5. Nice-to-Haves

```
ISSUE       Heavy use of `any` in Snowflake and Redis modules
SEVERITY    NICE-TO-HAVE
FILE        src/lib/snowflake/connection.ts, src/lib/redis/client.ts
LINES       connection.ts:2,12,146-149; client.ts:2,51
DESCRIPTION The Snowflake SDK and ioredis are loaded via dynamic require
            with `let snowflake: any` and `let Redis: any`. Connection,
            statement, and row types are all `any`.
FIX         Install @types/snowflake-sdk if available, or create minimal
            type declarations. Use ioredis built-in types.
SECTION     TypeScript Quality
```

```
ISSUE       Large monolithic components exceed 500 lines
SEVERITY    NICE-TO-HAVE
FILE        src/components/data/VisualQueryBuilder.tsx,
            src/components/data/PlaygroundTab.tsx,
            src/components/data/QuickChart.tsx,
            src/components/data/ResultDiff.tsx
LINES       VisualQueryBuilder: 575, PlaygroundTab: 568, QuickChart: 637, ResultDiff: 487
DESCRIPTION Each of these components exceeds 480 lines. While acceptable for
            initial delivery, they will be difficult to maintain and test
            as individual units.
FIX         Extract sub-components and custom hooks as the features stabilize.
            Not blocking for merge.
SECTION     Architecture
```

```
ISSUE       No unit tests for core security logic
SEVERITY    NICE-TO-HAVE
FILE        src/lib/auth/permissions.ts, src/lib/data/visual-to-sql.ts
LINES       N/A
DESCRIPTION The permission resolution engine (resolveUserPermissions,
            canAccessDataSourceWithMetrics) and the visual-to-SQL transpiler
            are pure logic with no unit test coverage. These are the most
            critical modules for correctness.
FIX         Add unit tests for permission edge cases (conflicting groups,
            override precedence, Financial meta-category) and SQL generation
            (escaping, filter conditions, formula handling).
SECTION     Testing
```

```
ISSUE       DESCRIBE TABLE query uses bind parameters for identifiers
SEVERITY    NICE-TO-HAVE
FILE        src/lib/snowflake/query-executor.ts
LINES       370-377
DESCRIPTION `SnowflakeQueryBuilder.describeTable()` uses
            `:database.:schema.:table` with bind parameters, but Snowflake
            bind parameters are for values, not identifiers.
            `DESCRIBE TABLE ?` would produce a syntax error.
FIX         Use validated identifier quoting instead of bind parameters
            for the database/schema/table names.
SECTION     TypeScript Quality
```

```
ISSUE       deepMerge in settings.ts has no prototype pollution guard
SEVERITY    NICE-TO-HAVE
FILE        src/lib/settings.ts
LINES       119-135
DESCRIPTION The deepMerge utility iterates `Object.keys(source)` which
            excludes `__proto__`, but `constructor` and other inherited
            properties could still cause issues depending on the input.
FIX         Add a guard: `if (key === '__proto__' || key === 'constructor') continue;`
SECTION     Security
```

---

## 6. Highlights

- **RBAC architecture is genuinely well-designed.** The layered approach -- role-based defaults, permission group overrides, metric-level granularity -- is production-grade. The "highest access level wins" merge strategy and deny-by-default reset when groups are assigned (permissions.ts:283-292) are correct.

- **GDPR implementation is thorough.** The delete endpoint properly: uses a transaction, requires explicit confirmation string, anonymizes rather than destroys the user record (preserving FK integrity), archives dashboards for collaborators, and audits before deletion. Export includes all user-associated data.

- **Snowflake provider graceful degradation.** The dual-provider pattern (Snowflake with sample data fallback) is well-structured. Silent fallback on Snowflake failure (snowflake-data-provider.ts:109) means the app stays functional during connector issues.

- **CSP hardening is correct.** Removing `unsafe-eval` in production, tightening `img-src`, dropping unused `vercel.live` references, and keeping `unsafe-eval` only for dev hot reload is exactly right.

- **Dashboard schema validation with Zod.** Adding full schema validation on the dashboards API (widget positions, data configs, tag limits, max 100 widgets) hardens a key attack surface.

- **Chat retention policy is clean and correct.** 35 lines, does one thing well, handles orphaned sessions.

---

## 7. Merge Recommendation

**⚠️ MERGE WITH FIXES**

**Must fix before merge (Critical):**
1. SQL injection in `buildSnowflakeQuery` -- reject unmapped source names, validate groupBy against schema
2. SQL injection in `SnowflakeQueryBuilder.select/count` -- add identifier validation
3. Settings API deep validation -- add Zod schema for the full SystemSettings shape
4. PII stripping must apply to ALL data sources, not just sample data

**Should fix before merge (High-priority Warnings):**
5. Add proper `AuditAction` enum values for GDPR operations (compliance risk)
6. Fix `isRedisConfigured` to check env var presence, not default value
7. Remove character-stripping sanitization in favor of parameterized queries only

**Can fix post-merge:**
- Everything in Nice-to-Haves
- File-based settings (document constraint; migrate to DB in next sprint)
- Redis KEYS usage (fine at current scale, must fix before production traffic)
- E2E test skipping behavior
- Process.on handlers

---

## Files Reviewed

```
.agent-handoff.md                                | 2175 +++++++---------------
 .env.example                                     |    8 +-
 .github/workflows/ci.yml                         |   15 +-
 .gitignore                                       |    3 +
 docs/CISO_REPORT.md                              |   84 +-
 docs/VP_ANALYTICS_REPORT.md                      |  555 ++++++
 docs/asana-daily-summary.md                      |  966 +++-------
 docs/asana-project-state.json                    |  444 ++++-
 docs/asana-task-gids.json                        |   16 +-
 e2e/critical-flows.spec.ts                       |  475 +++++
 logs/overnight-20260418-2227.log                 |  164 ++
 logs/overnight-build.log                         |  175 ++
 middleware.ts                                    |   13 +-
 package.json                                     |    2 +
 prisma/schema.prisma                             |   32 +-
 src/app/admin/permissions/permissions-client.tsx |  187 +-
 src/app/admin/settings/page.tsx                  |   35 +
 src/app/admin/settings/settings-client.tsx       |  430 +++++
 src/app/admin/users/users-client.tsx             |   59 +-
 src/app/api/admin/retention/route.ts             |   36 +
 src/app/api/admin/settings/route.ts              |   65 +
 src/app/api/admin/users/[id]/role/route.ts       |  104 ++
 src/app/api/dashboards/route.ts                  |   61 +-
 src/app/api/data/profile/route.ts                |  377 ++++
 src/app/api/data/query/route.ts                  |  179 +-
 src/app/api/data/schema/route.ts                 |  379 ++++
 src/app/api/user/delete/route.ts                 |   99 +
 src/app/api/user/export/route.ts                 |  117 ++
 src/app/data/explorer/page.tsx                   |  278 +++
 src/app/data/playground/page.tsx                 |  451 +++++
 src/app/data/visual-query/page.tsx               |  316 ++++
 src/app/glossary/glossary-client.tsx             |    4 +
 src/components/dashboard/WidgetConfigPanel.tsx   |  280 ++-
 src/components/dashboard/WidgetQueryPanel.tsx    |   21 +-
 src/components/data/ColumnPicker.tsx             |  281 +++
 src/components/data/DataLineage.tsx              |  415 +++++
 src/components/data/DataPreview.tsx              |  432 +++++
 src/components/data/DataProfiler.tsx             |  422 +++++
 src/components/data/FilterBuilder.tsx            |  325 ++++
 src/components/data/FormulaBar.tsx               |  438 +++++
 src/components/data/PlaygroundTab.tsx            |  568 ++++++
 src/components/data/QuickChart.tsx               |  637 +++++++
 src/components/data/ResultDiff.tsx               |  487 +++++
 src/components/data/SchemaExplorer.tsx           |  462 +++++
 src/components/data/SqlEditor.tsx                |  217 +++
 src/components/data/VisualQueryBuilder.tsx       |  575 ++++++
 src/components/glossary/AddToDashboardModal.tsx  |  380 ++++
 src/components/glossary/RelatedWidgets.tsx       |  216 +++
 src/components/glossary/WidgetPreviewModal.tsx   |  195 ++
 src/components/layout/CommandPalette.tsx         |    1 +
 src/components/layout/Navbar.tsx                 |    5 +-
 src/hooks/useDataSourcePermissions.ts            |   94 +
 src/lib/auth/permissions.ts                      |  400 +++-
 src/lib/data/retention.ts                        |   35 +
 src/lib/data/snowflake-data-provider.ts          |  308 +++
 src/lib/data/visual-to-sql.ts                    |  361 ++++
 src/lib/env.ts                                   |   12 +
 src/lib/redis/client.ts                          |  362 ++++
 src/lib/redis/config.ts                          |   70 +
 src/lib/settings.ts                              |  135 ++
 src/lib/snowflake/config.ts                      |  106 ++
 src/lib/snowflake/connection.ts                  |  364 ++++
 src/lib/snowflake/data-security.ts               |  532 ++++++
 src/lib/snowflake/query-executor.ts              |  378 ++++
 src/lib/snowflake/row-level-security.ts          |  493 +++++
 src/lib/snowflake/schema.ts                      |  492 +++++
 src/lib/widget-matching.ts                       |  108 ++
 src/types/data-explorer.ts                       |  323 ++++
 src/types/playground.ts                          |  220 +++
 src/types/visual-query.ts                        |  159 ++
 70 files changed, 17175 insertions(+), 2438 deletions(-)
```

## Commits Reviewed

```
bea7924 feat: Implement comprehensive Snowflake connector with security features
c3ea151 feat: Implement comprehensive Power User Data Experience
a6a69d7 feat: Implement comprehensive Data Explorer & Schema Browser
d59edec feat: Implement Query Playground with multi-tab notebook interface
01186b9 feat: Implement Sigma-style Visual Query Builder with drag-and-drop interface
c304694 feat: Implement glossary → widget links with browse & add functionality
7a05451 feat: Implement metric-level RBAC with granular financial data restrictions
a363a4d fix: Fix build error by importing SystemSettings type correctly in settings-client
5a77655 feat: Update CISO report with thumbnail API & EBS encryption documentation
04fff6b chore: pre-overnight-builder snapshot
```
