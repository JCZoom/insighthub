# Snowflake Integration Plan — InsightHub

**Date:** April 22, 2026  
**Author:** Jeff Coy  
**Distribution:** Engineering, Data Analytics, Security

---

## Executive Summary

InsightHub is an AI-powered internal dashboard builder that allows employees to create data visualizations using natural language. It currently runs on synthetic sample data, but the architecture was designed from the outset to plug into **Snowflake** as the production data source.

This document outlines:
1. The security safeguards **already built** into the application
2. How the Snowflake connection works architecturally
3. What **still needs to be done** before connecting live data
4. A phased integration timeline with milestones
5. Data governance and risk mitigation strategy

**Bottom line:** InsightHub was purpose-built with a multi-layered security architecture including RBAC, row-level security, column-level data masking, SQL injection prevention, audit logging, and AI output verification. Connecting to Snowflake is primarily an infrastructure and governance exercise — not a code rewrite.

---

## Part 1: Security Safeguards Already In Place

### 1.1 Authentication & Domain Restriction

| Control | Implementation |
|---------|---------------|
| **Authentication** | Google OAuth via NextAuth (JWT, 8-hour TTL) |
| **Domain lock** | Only `@uszoom.com` email addresses can log in |
| **Session security** | Stateless JWT with 32+ character signing secret |
| **HTTPS** | TLS via Let's Encrypt, HSTS with 2-year max-age + preload |

No external users can access the application. Authentication is enforced at the middleware layer on every request.

### 1.2 Role-Based Access Control (RBAC) — 4 Roles + Permission Groups

The system enforces **who can see what data** at multiple levels:

| Role | Dashboard Create | Financial Data | Customer PII | User Management |
|------|:---:|:---:|:---:|:---:|
| VIEWER | No | No | No | No |
| CREATOR | Yes | No | No | No |
| POWER_USER | Yes | Yes | No | No |
| ADMIN | Yes | Yes | Yes | Yes |

Beyond roles, a **granular permission group system** allows admins to:
- Create custom permission groups with specific data and feature access
- Assign users to multiple groups (permissions merge via grant-union)
- Override individual permissions per user within a group
- Restrict access at the **metric level** (e.g., allow Revenue category but block LTV metric)
- Unified **Financial meta-category** groups Revenue + Sales for consistent governance

### 1.3 Data Category Access Controls

Seven data categories with three access levels (FULL / FILTERED / NONE):

| Category | Description | Default: Who Can Access |
|----------|-------------|------------------------|
| Revenue | MRR, revenue trends | POWER_USER, ADMIN |
| Sales | Deals, pipeline | POWER_USER, ADMIN |
| Retention | Churn metrics | CREATOR, POWER_USER, ADMIN |
| Support | Ticket data | All roles |
| Product | Feature usage | CREATOR, POWER_USER, ADMIN |
| Operations | KPI summaries | POWER_USER, ADMIN |
| CustomerPII | Names, emails, contacts | **ADMIN only** |
| Financial (meta) | Spans Revenue + Sales | POWER_USER, ADMIN |

These controls are enforced at both the **API layer** (server-side, before data is returned) and the **AI prompt layer** (restricted categories are injected into the system prompt so the AI model cannot generate queries against them).

### 1.4 Snowflake-Specific Security Layers (Already Built)

#### SQL Injection Prevention
- **Parameterized queries only** — all user input goes through bind parameters
- **Dangerous SQL pattern detection** — blocks DROP, DELETE, TRUNCATE, ALTER, INSERT, UPDATE, UNION SELECT, script injection
- **Single-statement enforcement** — multiple SQL statements are rejected
- **Read-only enforcement** — only SELECT, WITH, SHOW, and DESCRIBE are allowed
- **Automatic row limits** — queries without LIMIT get a default 10,000-row cap to prevent resource exhaustion
- **Parameter name validation** — only alphanumeric + underscore allowed in parameter names

#### Row-Level Security
- **Policy-based row filtering** — SQL WHERE conditions are automatically injected based on user context
- **Department isolation** — users only see data for their own department (unless ADMIN)
- **Regional financial restrictions** — financial data filtered by user's region unless they have explicit financial access
- **Customer assignment rules** — support reps see only their assigned customers
- **Time-based access** — non-admins restricted to last 2 years of data
- **Priority-ordered policy evaluation** — higher-priority policies override lower ones

#### Column-Level Data Masking
- **Auto-detection of sensitive columns** by name pattern (email, phone, SSN, name, salary, revenue, etc.) and by analyzing sample data values
- **Sensitivity classification** — PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, PII, FINANCIAL
- **Masking types** — FULL_MASK, PARTIAL_MASK, HASH, REDACT, NULL
- **Format-preserving masking** — email addresses show `j***@domain.com`, phone numbers show `***-**-1234`
- **Tag-based access decisions** — masking rules are applied based on the user's resolved permissions

#### Connection Pool Management
- **Connection pooling** — max 5 connections, idle timeout at 5 minutes
- **Automatic cleanup** — idle connections destroyed every 60 seconds
- **Health checks** — `SELECT 1` probe for monitoring
- **OCSP certificate validation** — enabled in production
- **Graceful shutdown** — connections cleaned up on process exit

#### Schema Introspection
- **Live schema discovery** — reads tables, columns, types from Snowflake's `INFORMATION_SCHEMA`
- **Permission-aware browsing** — only shows tables/columns the user is authorized to see
- **Column profiling** — min/max/avg/distinct counts/percentiles for data quality review
- **Cached metadata** — schema queries cached (30 min for tables, 1 hour for databases) to reduce Snowflake compute costs

### 1.5 Query Result Caching (Redis)
- **Optional Redis layer** — caches Snowflake query results with configurable TTL (default 5 minutes)
- **User-scoped cache keys** — cache is partitioned per user to respect permissions
- **Cache invalidation** — admin can clear per-user or all cache

### 1.6 Data Integrity Verification Pipeline
- **3-layer verification** of AI-generated dashboard configurations:
  - Layer 1: 13 deterministic structural checks (free, <5ms)
  - Layer 2: AI semantic verification (~$0.002, 2-4s)
  - Layer 2.5: Escalation to deeper AI review if confidence < 0.70
- Confidence badges displayed to users (green/yellow/red shield)
- **Advisory only** — patches always apply, but users see verification status

### 1.7 Audit Logging
- Every significant action logged: login, role changes, dashboard CRUD, permission changes, data exports, account deletions
- Indexed for efficient querying by user, resource, and date
- Admin-only audit log viewer with filtering and pagination
- Audit failures are non-blocking (never break the primary operation)

### 1.8 Infrastructure Security
- **EC2 deployment** behind Nginx reverse proxy
- **Tailscale VPN** — SSH access only through private mesh network, no public SSH port
- **Systemd hardening** — `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes`
- **Resource limits** — 512MB memory cap, 80% CPU quota
- **Rate limiting** — Nginx (10 req/sec per IP) + application-level (60 req/min dashboards, 30 req/min chat)
- **Security headers** — X-Frame-Options DENY, HSTS, CSP, X-Content-Type-Options nosniff
- **Encrypted backups** — AES-256-CBC encrypted database backups
- **File permissions** — database and env files restricted to `chmod 600`

### 1.9 GDPR / Compliance Readiness
- **Data export** — `GET /api/user/export` (right to access)
- **Account deletion** — `POST /api/user/delete` with data anonymization (right to deletion)
- **Chat retention** — 90-day automatic purge via admin API
- **Domain-restricted OAuth** implies consent

---

## Part 2: How the Snowflake Connection Works

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│  Google OAuth login → JWT session → Dashboard UI         │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS (TLS 1.2+)
                       ▼
┌──────────────────────────────────────────────────────────┐
│               Nginx Reverse Proxy                         │
│  Rate limiting · Security headers · TLS termination       │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│              InsightHub Application (Next.js)             │
│                                                           │
│  ┌─────────────────┐  ┌──────────────────────────────┐   │
│  │  Auth Middleware │  │  RBAC Permission Resolution  │   │
│  │  (JWT + domain)  │  │  (category + metric level)   │   │
│  └────────┬────────┘  └──────────┬───────────────────┘   │
│           │                      │                        │
│           ▼                      ▼                        │
│  ┌───────────────────────────────────────────────┐       │
│  │         Data Provider Abstraction Layer         │       │
│  │  SnowflakeDataProvider.queryData()              │       │
│  │  • Automatic fallback to sample data            │       │
│  │  • Unified interface for both data sources      │       │
│  └────────────────────┬──────────────────────────┘       │
│                       │                                   │
│           ┌───────────┼───────────┐                       │
│           ▼           ▼           ▼                       │
│  ┌──────────┐ ┌────────────┐ ┌──────────────┐           │
│  │ SQL      │ │ Row-Level  │ │ Column-Level │           │
│  │ Injection│ │ Security   │ │ Data Masking │           │
│  │ Guard    │ │ (RLS)      │ │ (PII/Fin)    │           │
│  └────┬─────┘ └─────┬──────┘ └──────┬───────┘           │
│       └──────────────┼───────────────┘                    │
│                      ▼                                    │
│  ┌───────────────────────────────────────────────┐       │
│  │     Snowflake Connection Pool (max 5)          │       │
│  │     Parameterized queries · OCSP validation    │       │
│  │     Idle cleanup · Health monitoring            │       │
│  └────────────────────┬──────────────────────────┘       │
│                       │                                   │
│  ┌────────────────────┼──────────────────────────┐       │
│  │          Redis Cache (optional)                │       │
│  │     User-scoped · TTL-based · Invalidatable    │       │
│  └───────────────────────────────────────────────┘       │
└──────────────────────┬───────────────────────────────────┘
                       │ TLS (Snowflake uses TLS by default)
                       ▼
┌──────────────────────────────────────────────────────────┐
│                 Snowflake (Company DW)                     │
│  InsightHub connects with:                                │
│  • Dedicated service account (read-only)                  │
│  • Dedicated warehouse (size XS, auto-suspend)            │
│  • Specific database + schema scope                       │
│  • Key-pair authentication (recommended over password)    │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow — What Happens When a User Asks a Question

1. **User asks** "Show me MRR by region for last quarter" in the chat
2. **Auth check** — middleware verifies JWT, resolves user role and permissions
3. **AI generates** a dashboard widget configuration (data source, filters, chart type)
4. **Data Integrity Verification** — 3-layer check validates the AI's output
5. **Permission check** — server verifies user has access to the Revenue category
6. **SQL generation** — safe parameterized query built from the widget config
7. **SQL injection guard** — query validated against dangerous patterns, read-only enforcement
8. **Row-level security** — WHERE conditions injected based on user's department/region
9. **Snowflake execution** — query runs on dedicated read-only warehouse
10. **Column masking** — PII/financial columns masked based on user's access level
11. **Cache** — results cached in Redis (if configured) for 5 minutes
12. **Response** — filtered, masked data returned to the client for rendering

**At no point does raw, unfiltered data leave Snowflake without passing through all security layers.**

### 2.3 The Fallback Safety Net

The `SnowflakeDataProvider` is designed with an **automatic fallback**: if Snowflake is unavailable or misconfigured, it seamlessly falls back to the sample data set. This means:
- **Zero downtime** — the app always works, even if Snowflake connectivity is lost
- **Gradual rollout** — Snowflake can be enabled for specific users/roles first
- **Safe demos** — switch between live and sample data by toggling environment variables

---

## Part 3: Remaining Work Items

### 3.1 Critical — Must Complete Before Live Data

| # | Item | Effort | Description |
|---|------|--------|-------------|
| 1 | **Snowflake service account provisioning** | 1-2 days | Create a dedicated read-only service account in Snowflake with minimum required privileges. No DDL, no DML — SELECT only on approved schemas. |
| 2 | **Key-pair authentication** | 1 day | Replace password-based auth with RSA key-pair authentication. |
| 3 | **Dedicated warehouse** | < 1 day | Create an XS warehouse (`INSIGHTHUB_WH`) with auto-suspend (60s) and auto-resume. Set resource monitors to cap monthly spend. |
| 4 | **Table mapping configuration** | 2-3 days | Map InsightHub data source names to actual Snowflake table paths. Needs real table names from the analytics team. |
| 5 | **SQL injection hardening** | 2-3 days | Resolve 3 identified injection vectors in query building. All documented in the CISO security audit. |
| 6 | **Unified PII detection layer** | 2-3 days | Consolidate two separate PII stripping layers into a single centralized pipeline that handles column aliasing. |
| 7 | **Secrets management upgrade** | 1-2 days | Move Snowflake credentials to AWS Secrets Manager or SSM Parameter Store. |
| 8 | **Dev mode enforcement** | < 1 day | Re-add fatal enforcement when dev mode is enabled in production, preventing authentication bypass. |

### 3.2 High Priority — Should Complete Before Wider Rollout

| # | Item | Effort | Description |
|---|------|--------|-------------|
| 9 | **Snowflake network policy** | < 1 day | Configure Snowflake network policies to only allow connections from the EC2 instance's IP or VPC. |
| 10 | **Query audit logging** | 1-2 days | Extend audit logging to capture every Snowflake query executed: who ran it, what SQL, execution time, row count. Ship to immutable store (CloudWatch/S3). |
| 11 | **Resource monitor alerts** | < 1 day | Set Snowflake resource monitors with credit alerts at 50%, 75%, 90% thresholds. |
| 12 | **Redis TLS** | < 1 day | If Redis is deployed, ensure TLS is enabled for the cache layer (cached query results contain sensitive data). |
| 13 | **Data classification review** | 2-3 days | Walk through every Snowflake table/column with the analytics team to assign sensitivity tags (PUBLIC, INTERNAL, CONFIDENTIAL, PII, FINANCIAL). |

### 3.3 Medium Priority — Post-Launch Enhancements

| # | Item | Effort | Description |
|---|------|--------|-------------|
| 14 | **Snowflake views layer** | 3-5 days | Create pre-approved Snowflake views that serve as the "contract" between raw data and InsightHub. The app queries views, not raw tables. |
| 15 | **Horizontal scaling** | 2-3 days | Move rate limiting and session state to Redis for multi-instance deployment (currently in-memory). |
| 16 | **Nonce-based CSP** | 2-3 days | Replace `unsafe-inline` in Content Security Policy with nonce-based approach. |
| 17 | **SOC 2 audit trail** | 3-5 days | Ship audit logs to CloudWatch/S3 with object lock for immutability. |

---

## Part 4: Recommended Integration Approach

### 4.1 The Views Layer Strategy

Rather than pointing InsightHub directly at raw Snowflake tables, the recommended approach is to create a **curated views layer**:

```
Raw Snowflake Tables (owned by Data Team)
         │
         ▼
┌─────────────────────────────────┐
│  INSIGHTHUB_ANALYTICS Schema    │  ← Controlled by Data Team
│                                  │
│  • v_monthly_revenue            │  Pre-aggregated, no PII
│  • v_churn_by_region            │  Pre-filtered, anonymized
│  • v_ticket_summary             │  Aggregated by category
│  • v_kpi_dashboard              │  Executive KPI rollups
│  • v_pipeline_summary           │  Deal stages, no contacts
│  • v_product_usage              │  Feature usage trends
│  └──────────────────────────────┘
         │
         ▼
InsightHub queries ONLY these views
```

**Why this approach works:**

1. **Data team retains control** — They define what data is exposed, how it's aggregated, and what's excluded. InsightHub never touches raw tables.
2. **No PII leakage by design** — Views can be built to exclude or pre-mask PII columns. Even if InsightHub's masking layer had a bug, the underlying view never contains PII.
3. **Performance isolation** — Views can be materialized or use dedicated warehouse compute. Raw table scans are impossible.
4. **Schema stability** — If raw table schemas change, the data team updates the view. InsightHub's mapping doesn't break.
5. **Audit simplicity** — "InsightHub can only read these 6 views" is easy to audit and explain to security teams.
6. **Progressive exposure** — Start with 3 views, add more as confidence grows.

### 4.2 Phased Rollout Plan

#### Phase 1: Foundation (Week 1-2)
- Provision Snowflake service account (read-only, key-pair auth)
- Create dedicated `INSIGHTHUB_WH` warehouse (XS, auto-suspend 60s)
- Create `INSIGHTHUB_ANALYTICS` schema with first 2-3 views
- Set up network policy restricting access to EC2 IP
- Harden SQL injection vectors
- Move credentials to AWS Secrets Manager
- **Milestone:** Successful health check from EC2 to Snowflake

#### Phase 2: Controlled Testing (Week 3-4)
- Map InsightHub data sources to Snowflake views
- Deploy Redis cache layer (TLS-encrypted)
- Complete data classification review with analytics team
- Unify PII detection layer
- Enable query audit logging
- **Milestone:** Admin users can query live Snowflake data; sample data users unaffected

#### Phase 3: Limited Rollout (Week 5-6)
- Enable for POWER_USER role
- Monitor query patterns, performance, and costs
- Tune cache TTLs based on data freshness requirements
- Review audit logs for anomalies
- **Milestone:** Power users building dashboards on live data with full security layers

#### Phase 4: General Availability (Week 7-8)
- Enable for CREATOR and VIEWER roles (within their RBAC constraints)
- Performance optimization based on real usage patterns
- Resource monitor alerts tuned to actual spend
- **Milestone:** All authorized users on live data; sample data retained as fallback only

### 4.3 Timeline Summary

| Phase | Duration | Key Deliverable |
|-------|----------|----------------|
| Foundation | 2 weeks | Secure Snowflake connection established |
| Controlled Testing | 2 weeks | Admin-only live data access |
| Limited Rollout | 2 weeks | Power users on live data |
| General Availability | 2 weeks | All users on live data |
| **Total** | **~8 weeks** | Full production Snowflake integration |

**Accelerated timeline (if dedicated resources):** 4-5 weeks by parallelizing Snowflake provisioning (Data Team) with code fixes (Dev Team).

---

## Part 5: Defense in Depth — 7 Security Layers

No single layer is a silver bullet. InsightHub applies **seven independent security layers**, each of which independently prevents unauthorized data access:

| Layer | What It Does | If This Layer Fails... |
|-------|-------------|----------------------|
| 1. **Google OAuth + Domain Lock** | Only @uszoom.com employees can log in | Other layers still block unauthorized data |
| 2. **RBAC (Role + Permission Groups)** | Controls who sees which data categories | Snowflake views still limit exposed data |
| 3. **Snowflake Views Layer** | Only pre-approved, pre-aggregated data is queryable | RLS still filters rows |
| 4. **Row-Level Security** | WHERE conditions filter rows by user context | Column masking still hides sensitive fields |
| 5. **Column-Level Masking** | PII/financial columns masked by sensitivity level | Views already excluded PII |
| 6. **SQL Injection Prevention** | Read-only, parameterized, pattern-validated queries | Snowflake service account is read-only anyway |
| 7. **Audit Logging** | Every query logged with user, SQL, timestamp | Enables detection and response |

### What InsightHub CANNOT Do to Snowflake

| Action | Blocked By |
|--------|-----------|
| **Modify data** (INSERT, UPDATE, DELETE) | SQL validation (read-only enforcement) + service account permissions |
| **Drop tables or schemas** | SQL validation + service account permissions |
| **Query unapproved tables** | Views layer + table mapping allowlist |
| **See other users' restricted data** | Row-level security + RBAC |
| **See PII/financial columns without authorization** | Column masking + permission checks |
| **Run unbounded queries** | Automatic LIMIT enforcement + warehouse resource monitors |
| **Access Snowflake from unauthorized IPs** | Snowflake network policy |

### What the Data Team Controls (Not InsightHub)

| Control | Owner |
|---------|-------|
| Which tables/columns are exposed via views | **Data Team** |
| Snowflake service account privileges | **Data Team / DBA** |
| Snowflake network policies | **Data Team / Security** |
| Snowflake resource monitors and credit limits | **Data Team / Finance** |
| View definitions and data transformations | **Data Team** |
| Snowflake audit trails (ACCOUNT_USAGE) | **Data Team / Security** |

The Data Team retains full control over what data enters InsightHub. They control the views, the service account permissions, and the network policies. InsightHub is a **consumer** of pre-approved data, not an admin of the data warehouse.

---

## Part 6: Risk Matrix

| Risk | Likelihood | Impact | Mitigation | Status |
|------|-----------|--------|------------|--------|
| SQL injection in Snowflake queries | Low | Critical | Harden 3 identified vectors before launch | **Open** |
| Service account over-privileged | Medium | High | Read-only, views-only, network-restricted | **Design ready** |
| PII leakage through column aliasing | Medium | High | Unified PII detection layer | **Open** |
| Auth bypass in production | Low | Critical | Re-enforce dev mode fatal check | **Open** |
| Snowflake credential exposure | Medium | High | Move to AWS Secrets Manager | **Open** |
| Runaway query costs | Low | Medium | Auto-suspend warehouse + resource monitors | **Design ready** |
| Cache serving stale data | Low | Low | Configurable TTL + manual invalidation | **Built** |
| Snowflake outage | Low | Medium | Automatic fallback to sample data | **Built** |

---

## Appendix: Key Questions for Cross-Team Alignment

### Data Access & Governance
- Which Snowflake database(s) and schema(s) contain the analytics data we'd want to surface?
- Does the analytics team already have a curated views/marts layer, or would we need to build one?
- What's the data refresh cadence? (Real-time, hourly, daily?) — This affects cache TTL settings.
- Are there existing Snowflake roles we should inherit, or should we create a new service account from scratch?
- Are there existing data classification standards? (What's considered PII, confidential, restricted?)

### Security & Compliance
- Does the company have a formal data governance policy we need to comply with?
- Are there specific compliance requirements? (SOC 2, HIPAA, GDPR, internal policies)
- Who approves new service accounts and grants on Snowflake?
- Are there existing Snowflake network policies we need to work within?
- Is there a formal change management process for connecting new applications to Snowflake?

### Technical
- What Snowflake edition are we on? (Standard, Enterprise, Business Critical) — Enterprise+ has native masking policies we could leverage.
- Are Snowflake's native Dynamic Data Masking or Row Access Policies in use? — If yes, we get an additional security layer for free.
- What are typical query volumes and data sizes we'd be working with?
- Is there an existing Redis or caching infrastructure we can use, or should we deploy our own?
- Is there monitoring/alerting on Snowflake query costs?

### Organizational
- Who from the data team would be our point of contact for the views layer?
- What's the approval process for adding new views/data sources?
- Are there other internal tools already connected to Snowflake? — Understanding precedent helps.

---

*This document is a living artifact. It will be updated as decisions are made and action items are assigned during the integration process.*
