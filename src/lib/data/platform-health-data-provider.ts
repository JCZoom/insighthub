/**
 * Platform Health data provider — server-only, Prisma-backed.
 *
 * Exposes honest, real-time counts of the InsightHub application
 * itself: users, dashboards, audit activity, glossary coverage,
 * classification distribution. Designed to give operators a
 * meaningful set of dashboards to bind to once the sample/demo
 * sources are quarantined behind FEATURE_DEMO_SOURCES.
 *
 * Mirrors the FreshworksDataProvider pattern: static class with a
 * single queryData(source, user) entry point that dispatches by
 * source name. Each source method returns a `DataProviderResult`
 * (the same shape the dashboard layer expects from Snowflake and
 * Freshworks providers).
 *
 * ── Truth-by-default PoP contract ────────────────────────────────────
 *
 * Every KPI source returns the same 5-field row shape established by
 * the Freshworks PoP rebuild (commit ce1535e):
 *
 *   {
 *     value: number,
 *     label: string,
 *     previous_value: number | null,
 *     comparison_label: string | null,
 *     comparison_unavailable_reason: string | null,
 *   }
 *
 * The KpiCard renderer (truth-by-default since 2026-05-19) only draws
 * a "% vs prev" pill when `previous_value` is a finite number; when
 * it's null the renderer shows "no comparison available" with the
 * reason in a tooltip. We never fabricate.
 *
 * The Platform Health sources are uniquely well-suited to honest PoP
 * because the underlying Prisma tables (User, Dashboard, GlossaryTerm,
 * AuditLog) are append-only with immutable `createdAt` fields — every
 * "how many existed at T-N" question is answerable from a single
 * filtered count. No snapshot table required.
 *
 * The ONE exception is the classification distribution chart:
 * `Dashboard.classification` is a mutable field that can be changed by
 * admins, and we don't change-track that field. We expose
 * classification distribution as a current-state breakdown chart only,
 * never as a KPI with a comparison pill. (See §"Classification" below.)
 *
 * ── Data classification ──────────────────────────────────────────────
 *
 * Platform metadata (user counts, dashboard counts, audit activity)
 * is classified `USZOOM_RESTRICTED` per Policy 3698 — internal
 * operations data, not customer-confidential. The route handler's
 * PII stripping for non-FULL CustomerPII users will still mask
 * `name`/`email` fields in the recent_audit_events table; that's
 * intentional and correct.
 */

import { prisma } from '@/lib/db/prisma';
import type { SessionUser } from '@/lib/auth/session';
import type { DataProviderResult } from './snowflake-data-provider';
import { PLATFORM_HEALTH_SOURCES } from './platform-health-sources';

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;
const THIRTY_DAYS_MS = 30 * DAY_MS;

/** Standard PoP row contract shared by all single-row KPI sources. */
const KPI_COLUMNS: Array<{ name: string; type: string }> = [
  { name: 'value', type: 'number' },
  { name: 'label', type: 'string' },
  { name: 'previous_value', type: 'number' },
  { name: 'comparison_label', type: 'string' },
  { name: 'comparison_unavailable_reason', type: 'string' },
];

function startOfTodayUtc(now: Date): Date {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function finish(
  data: Record<string, unknown>[],
  columns: Array<{ name: string; type: string }>,
  start: number,
): DataProviderResult {
  return {
    data,
    columns,
    executionTime: Date.now() - start,
    totalRows: data.length,
    fromCache: false,
    dataSource: 'platform_health',
    accessLevel: 'FULL',
    isFiltered: false,
    appliedPolicies: ['platform.classification:USZOOM_RESTRICTED'],
  };
}

export class PlatformHealthDataProvider {
  /** Always available — the underlying DB is the same one serving the app. */
  static isAvailable(): boolean {
    return true;
  }

  /**
   * Query a registered Platform Health source.
   *
   * Throws if the source is unknown — caller should check
   * `isPlatformHealthSource()` first or route by name prefix.
   */
  static async queryData(
    source: string,
    _user: SessionUser,
  ): Promise<DataProviderResult> {
    const start = Date.now();
    switch (source) {
      case 'platform_user_count':
        return this.userCount(start);
      case 'platform_users_by_role':
        return this.usersByRole(start);
      case 'platform_active_users_7d':
        return this.activeUsers7d(start);
      case 'platform_dashboards_total':
        return this.dashboardsTotal(start);
      case 'platform_dashboards_created_30d':
        return this.dashboardsCreated30d(start);
      case 'platform_dashboards_created_by_month':
        return this.dashboardsCreatedByMonth(start);
      case 'platform_classification_distribution':
        return this.classificationDistribution(start);
      case 'platform_glossary_term_count':
        return this.glossaryTermCount(start);
      case 'platform_glossary_by_category':
        return this.glossaryByCategory(start);
      case 'platform_audit_events_today':
        return this.auditEventsToday(start);
      case 'platform_audit_events_by_type_30d':
        return this.auditEventsByType30d(start);
      case 'platform_recent_audit_events':
        return this.recentAuditEvents(start);
      default:
        throw new Error(
          `Unknown Platform Health source: "${source}". Known: ${PLATFORM_HEALTH_SOURCES.join(', ')}`,
        );
    }
  }

  // ── Users ───────────────────────────────────────────────────────────

  /**
   * Total active user count with honest 7-day-ago PoP.
   *
   * "Existed at T-7d" = `User.createdAt < T-7d`. Users have no
   * archived/deactivated timestamp on this schema (no `deletedAt`
   * column on the User model as of 2026-05-19); the seed and OAuth
   * flow insert users but never delete them, so the count is
   * monotonically non-decreasing and the comparison is honest.
   */
  private static async userCount(start: number): Promise<DataProviderResult> {
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
    const [current, previous] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { lt: cutoff } } }),
    ]);
    return finish(
      [{
        value: current,
        label: 'Total users',
        previous_value: previous,
        comparison_label: 'vs 7 days ago',
        comparison_unavailable_reason: null,
      }],
      KPI_COLUMNS,
      start,
    );
  }

  /**
   * Users grouped by role (current-state bar chart).
   *
   * Deliberately NOT exposed as a KPI with a comparison pill: User.role
   * is mutable (admins can promote/demote) and the schema doesn't
   * track role history, so "users with role=ADMIN 7 days ago" is not
   * honestly computable. Honest answer = no comparison pill.
   */
  private static async usersByRole(start: number): Promise<DataProviderResult> {
    const users = await prisma.user.findMany({ select: { role: true } });
    const counts = new Map<string, number>();
    for (const u of users) {
      counts.set(u.role, (counts.get(u.role) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);
    return finish(
      rows,
      [
        { name: 'role', type: 'string' },
        { name: 'count', type: 'number' },
      ],
      start,
    );
  }

  /**
   * Distinct active users (any audit-log activity) in the last 7 days,
   * compared to the prior 7 days.
   *
   * Both numbers are derived from the same AuditLog table, both windows
   * are equally observable, so the comparison is honest. If the
   * AuditLog table is empty (fresh install) both numbers are 0; the
   * KpiCard's `hasComparison` guard (`previous_value !== 0`) will
   * correctly suppress the pill in that degenerate case.
   */
  private static async activeUsers7d(start: number): Promise<DataProviderResult> {
    const now = Date.now();
    const cutoff7d = new Date(now - SEVEN_DAYS_MS);
    const cutoff14d = new Date(now - 2 * SEVEN_DAYS_MS);
    const [recent, prior] = await Promise.all([
      prisma.auditLog.findMany({
        where: { createdAt: { gte: cutoff7d } },
        select: { userId: true },
      }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: cutoff14d, lt: cutoff7d } },
        select: { userId: true },
      }),
    ]);
    const currentActive = new Set(recent.map((r) => r.userId)).size;
    const previousActive = new Set(prior.map((r) => r.userId)).size;
    return finish(
      [{
        value: currentActive,
        label: 'Active users (7d)',
        previous_value: previousActive,
        comparison_label: 'vs prior 7 days',
        comparison_unavailable_reason: null,
      }],
      KPI_COLUMNS,
      start,
    );
  }

  // ── Dashboards ──────────────────────────────────────────────────────

  /**
   * Total non-archived dashboards with honest 7-day-ago PoP.
   *
   * "Existed at T-7d and was not archived at T-7d" =
   *   `createdAt < T-7d AND (archivedAt IS NULL OR archivedAt >= T-7d)`.
   *
   * This is honest because both fields are immutable post-write
   * (archivedAt is only ever set forward; there's no un-archive flow).
   */
  private static async dashboardsTotal(start: number): Promise<DataProviderResult> {
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
    const [current, previous] = await Promise.all([
      prisma.dashboard.count({ where: { archivedAt: null } }),
      prisma.dashboard.count({
        where: {
          createdAt: { lt: cutoff },
          OR: [{ archivedAt: null }, { archivedAt: { gte: cutoff } }],
        },
      }),
    ]);
    return finish(
      [{
        value: current,
        label: 'Active dashboards',
        previous_value: previous,
        comparison_label: 'vs 7 days ago',
        comparison_unavailable_reason: null,
      }],
      KPI_COLUMNS,
      start,
    );
  }

  /**
   * Dashboards created in the last 30 days, compared to the prior 30
   * (so the comparison answers "is dashboard creation accelerating?").
   *
   * Window = [T-30d, now]. Previous window = [T-60d, T-30d). Both
   * derived from `createdAt`, an immutable field — honest.
   */
  private static async dashboardsCreated30d(start: number): Promise<DataProviderResult> {
    const now = Date.now();
    const cutoff30d = new Date(now - THIRTY_DAYS_MS);
    const cutoff60d = new Date(now - 2 * THIRTY_DAYS_MS);
    const [current, previous] = await Promise.all([
      prisma.dashboard.count({ where: { createdAt: { gte: cutoff30d } } }),
      prisma.dashboard.count({
        where: { createdAt: { gte: cutoff60d, lt: cutoff30d } },
      }),
    ]);
    return finish(
      [{
        value: current,
        label: 'Dashboards created (30d)',
        previous_value: previous,
        comparison_label: 'vs prior 30 days',
        comparison_unavailable_reason: null,
      }],
      KPI_COLUMNS,
      start,
    );
  }

  /**
   * Monthly dashboard-creation counts for the last 12 calendar months
   * (UTC). Time-series chart, not a KPI — no PoP semantics needed.
   *
   * Returns rows like `{ month: '2026-05', count: 7 }`. Months with
   * zero creations are included as `{ month: 'YYYY-MM', count: 0 }`
   * so the line chart doesn't have gaps. This is a defensible
   * "the bucket is empty" answer; not a fabrication.
   */
  private static async dashboardsCreatedByMonth(start: number): Promise<DataProviderResult> {
    const now = new Date();
    // 12 buckets, oldest first.
    const buckets: { key: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      buckets.push({ key, count: 0 });
    }
    const oldestBucketStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
    );
    const dashboards = await prisma.dashboard.findMany({
      where: { createdAt: { gte: oldestBucketStart } },
      select: { createdAt: true },
    });
    const indexByKey = new Map(buckets.map((b, i) => [b.key, i]));
    for (const d of dashboards) {
      const k = `${d.createdAt.getUTCFullYear()}-${String(d.createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
      const idx = indexByKey.get(k);
      if (idx !== undefined) buckets[idx].count += 1;
    }
    return finish(
      buckets.map((b) => ({ month: b.key, count: b.count })),
      [
        { name: 'month', type: 'string' },
        { name: 'count', type: 'number' },
      ],
      start,
    );
  }

  /**
   * Dashboards grouped by their current classification (PUBLIC,
   * USZOOM_CONFIDENTIAL, USZOOM_RESTRICTED, CUSTOMER_CONFIDENTIAL).
   *
   * Current state only. Classification is a mutable field and we do
   * NOT track historical changes — exposing this as a KPI with a
   * "vs 7 days ago" pill would be a fabrication. Bar/pie chart only.
   */
  private static async classificationDistribution(start: number): Promise<DataProviderResult> {
    const dashboards = await prisma.dashboard.findMany({
      where: { archivedAt: null },
      select: { classification: true },
    });
    const counts = new Map<string, number>();
    for (const d of dashboards) {
      counts.set(d.classification, (counts.get(d.classification) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([classification, count]) => ({ classification, count }))
      .sort((a, b) => b.count - a.count);
    return finish(
      rows,
      [
        { name: 'classification', type: 'string' },
        { name: 'count', type: 'number' },
      ],
      start,
    );
  }

  // ── Glossary ────────────────────────────────────────────────────────

  /**
   * Total glossary terms with honest 7-day-ago PoP. GlossaryTerm rows
   * are append-only in practice — there's no soft-delete column on
   * the model — so the comparison is honest.
   */
  private static async glossaryTermCount(start: number): Promise<DataProviderResult> {
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
    const [current, previous] = await Promise.all([
      prisma.glossaryTerm.count(),
      prisma.glossaryTerm.count({ where: { createdAt: { lt: cutoff } } }),
    ]);
    return finish(
      [{
        value: current,
        label: 'Glossary terms',
        previous_value: previous,
        comparison_label: 'vs 7 days ago',
        comparison_unavailable_reason: null,
      }],
      KPI_COLUMNS,
      start,
    );
  }

  /**
   * Glossary terms grouped by category (current-state bar). Category
   * is technically mutable but a "coverage" view is naturally a
   * snapshot question; we expose it as a chart, not a KPI.
   */
  private static async glossaryByCategory(start: number): Promise<DataProviderResult> {
    const terms = await prisma.glossaryTerm.findMany({ select: { category: true } });
    const counts = new Map<string, number>();
    for (const t of terms) {
      counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    return finish(
      rows,
      [
        { name: 'category', type: 'string' },
        { name: 'count', type: 'number' },
      ],
      start,
    );
  }

  // ── Audit ───────────────────────────────────────────────────────────

  /**
   * Audit events recorded today (UTC) with honest yesterday-vs-today
   * PoP. AuditLog rows are append-only with an immutable createdAt;
   * the comparison is honest because both windows are equally
   * observable from the same table.
   */
  private static async auditEventsToday(start: number): Promise<DataProviderResult> {
    const now = new Date();
    const todayStart = startOfTodayUtc(now);
    const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
    const [todayCount, yesterdayCount] = await Promise.all([
      prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.auditLog.count({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),
    ]);
    return finish(
      [{
        value: todayCount,
        label: 'Audit events today (UTC)',
        previous_value: yesterdayCount,
        comparison_label: 'vs yesterday (UTC)',
        comparison_unavailable_reason: null,
      }],
      KPI_COLUMNS,
      start,
    );
  }

  /**
   * Audit events grouped by action type, last 30 days. Useful for
   * spotting recent activity composition (login spikes, retention runs,
   * permission changes, etc.). Bar chart; not a KPI.
   */
  private static async auditEventsByType30d(start: number): Promise<DataProviderResult> {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
    const events = await prisma.auditLog.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { action: true },
    });
    const counts = new Map<string, number>();
    for (const e of events) {
      counts.set(e.action, (counts.get(e.action) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);
    return finish(
      rows,
      [
        { name: 'action', type: 'string' },
        { name: 'count', type: 'number' },
      ],
      start,
    );
  }

  /**
   * 25 most recent audit events, joined to the actor's user name. The
   * route-level PII stripper will redact `name` for users without FULL
   * CustomerPII access; that's by design — VIEWER/CREATOR roles
   * should see "[REDACTED]" instead of operator identities.
   */
  private static async recentAuditEvents(start: number): Promise<DataProviderResult> {
    const events = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { user: { select: { name: true } } },
    });
    const rows = events.map((e) => ({
      id: e.id,
      action: e.action,
      resource_type: e.resourceType,
      resource_id: e.resourceId,
      // `name` is the route handler's PII strip target; this is the
      // operator name, NOT customer data. ADMINs see it; VIEWERs see
      // [REDACTED]. Acceptable.
      name: e.user?.name ?? '(unknown)',
      user_id: e.userId,
      created_at: e.createdAt.toISOString(),
    }));
    return finish(
      rows,
      [
        { name: 'id', type: 'string' },
        { name: 'action', type: 'string' },
        { name: 'resource_type', type: 'string' },
        { name: 'resource_id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'user_id', type: 'string' },
        { name: 'created_at', type: 'string' },
      ],
      start,
    );
  }
}
