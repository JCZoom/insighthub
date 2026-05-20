/**
 * Metric snapshot writer — G-FW-PoP-1 phase 2.
 *
 * Captures the current value of registered data sources and persists them
 * to the `MetricSnapshot` Prisma table, idempotently keyed on
 * (source, asOf). Once history accumulates, the data provider's PoP
 * reader (G-FW-PoP-1 phase 3) consults this table to compute honest
 * `previous_value` for sources whose vendor APIs lack a date filter —
 * graduating their "no comparison available" pills to real numbers.
 *
 * This module is SERVER-ONLY. It imports `queryDataWithProvider` which
 * pulls in `ioredis` transitively via the Freshworks provider.
 *
 * Invocation:
 *   - CLI:  `npx tsx scripts/snapshot-metrics.ts`
 *   - Cron: `scripts/cron/snapshot-metrics.sh` (wraps the CLI with
 *           logging + lock file)
 *
 * Demo-safe by design: nothing in production reads `MetricSnapshot` yet
 * (phase 3 ships in a separate commit), so the writer running has zero
 * effect on dashboard rendering. Its only side effect is row inserts in
 * the `MetricSnapshot` table. Running it tonight is harmless even if we
 * deploy before the demo.
 */

import { PrismaClient } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/session';
import { queryDataWithProvider } from './snowflake-data-provider';

/**
 * Allowlist of sources we want PoP history for. EXPLICIT, not derived
 * from the full source registry, because:
 *   - Sources that already have honest PoP via vendor date filters
 *     (Freshdesk, Freshcaller, Platform Health) don't need snapshots.
 *   - Snapshotting every source would be wasteful and would risk
 *     accidentally enabling fake PoP on a source where the provider
 *     can already compute it correctly.
 *
 * To add a new source: confirm the provider currently surfaces a
 * `comparison_unavailable_reason` for it (i.e., honest absence), then
 * add an entry here. The next nightly cron will start writing
 * snapshots; the reader (phase 3) will pick it up automatically once
 * sufficient history exists.
 *
 * `classification` is the data classification of the source (G-01 /
 * Policy 3698). The writer stamps this onto each snapshot row so
 * future readers can RBAC-gate appropriately.
 */
export interface SnapshottedSource {
  source: string;
  classification: 'CUSTOMER_CONFIDENTIAL' | 'USZOOM_RESTRICTED' | 'USZOOM_CONFIDENTIAL' | 'PUBLIC';
  /** Human description for log lines. Not stored in the DB. */
  description: string;
}

export const SNAPSHOTTED_SOURCES: readonly SnapshottedSource[] = [
  {
    source: 'freshsales_pipeline_value',
    classification: 'CUSTOMER_CONFIDENTIAL',
    description: 'Open-deal pipeline value (USD)',
  },
  {
    source: 'freshsales_open_deal_count',
    classification: 'CUSTOMER_CONFIDENTIAL',
    description: 'Count of deals not in closed-won/closed-lost',
  },
  {
    source: 'freshchat_active_conversations',
    classification: 'CUSTOMER_CONFIDENTIAL',
    description: 'Currently-active Freshchat conversations',
  },
] as const;

/**
 * Normalize an arbitrary timestamp to the start of its UTC day. Used as
 * the bucket boundary for daily-cadence snapshots.
 *
 * Example: 2026-05-19T22:14:33.123Z → 2026-05-19T00:00:00.000Z
 *
 * Why UTC: cron runs at local server time, but PoP semantics ("7 days
 * ago") are most consistent in UTC. Local-time bucketing would create
 * gaps/overlaps around DST transitions.
 *
 * Why "start of day" rather than "start of run hour": daily cadence
 * keeps the snapshot count modest (3 sources × 365 days = ~1,100
 * rows/year) and aligns with the granularity readers will actually
 * use (lookback windows are days, not hours, in the dashboard catalog).
 */
export function normalizeAsOfUtc(t: Date | number = Date.now()): Date {
  const d = new Date(t);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Synthetic admin user for system-initiated provider calls. The data
 * providers' permission layer expects a SessionUser; this is the
 * convention for cron/system contexts where there's no real session.
 *
 * The id 'system-snapshot-writer' is intentionally distinct from any
 * real user id, so audit log rows attributed to the writer are
 * trivially identifiable and can be filtered out of "user activity"
 * queries downstream.
 */
const SYSTEM_USER: SessionUser = {
  id: 'system-snapshot-writer',
  email: 'system@insighthub.internal',
  name: 'Snapshot Writer (system)',
  role: 'ADMIN',
  department: 'system',
};

export interface SnapshotResult {
  source: string;
  asOf: Date;
  status: 'ok' | 'skipped-no-value' | 'error';
  /** Stored payload (JSON-stringified) on success; null on skip/error. */
  value?: string;
  error?: string;
  latencyMs?: number;
}

/**
 * Capture a single source's current value and persist it as a
 * MetricSnapshot row. Idempotent on (source, asOf) via Prisma upsert.
 *
 * Returns a structured result regardless of outcome — callers (the CLI,
 * future cron health endpoints) inspect `status` for green/red
 * decisions rather than relying on thrown exceptions.
 */
export async function captureSnapshot(
  prisma: PrismaClient,
  spec: SnapshottedSource,
  asOf: Date = normalizeAsOfUtc(),
): Promise<SnapshotResult> {
  const started = Date.now();
  const capturedAt = new Date().toISOString();
  try {
    const result = await queryDataWithProvider(spec.source, SYSTEM_USER);
    const row = result.data?.[0];
    // KPI sources expose `value` on the first (and only) row. If the
    // provider ever returns a multi-row shape for a snapshotted source
    // we'd need to JSON-encode the whole rows array — for now the
    // allowlist is curated to KPI sources only, so this is sufficient.
    const v = row && typeof row === 'object' ? (row as Record<string, unknown>).value : undefined;
    // TODO(G-FW-PoP-1 phase 2.1, blocked on Freshchat fix):
    // When the data provider exposes `degraded: true` (per the
    // FRESHWORKS_FIELD_SHAPE_FINDINGS_2026-05-19 §F-2 patch plan),
    // skip the write here — a degraded source returning `0` is
    // indistinguishable from "genuinely zero" at this layer, and we
    // don't want to poison PoP history with a fake zero from a 403'd
    // upstream. Until that flag lands, callers should be aware that a
    // freshchat_active_conversations=0 snapshot may be either (a) real
    // or (b) the silent 403-degrade pattern. The reader (phase 3) can
    // exclude any source whose run window hits a known-degraded period.
    if (v === undefined || v === null) {
      // Honest absence: do NOT write a fake zero. A missing snapshot
      // is the right state — the reader will report no comparison
      // available (which is exactly the current behavior). Writing 0
      // would make a future PoP look like a 100% drop.
      return {
        source: spec.source,
        asOf,
        status: 'skipped-no-value',
        latencyMs: Date.now() - started,
      };
    }
    const valueJson = JSON.stringify(v);
    await prisma.metricSnapshot.upsert({
      where: { source_asOf: { source: spec.source, asOf } },
      update: {
        // On re-run for the same bucket: refresh value + metadata, but
        // keep the original createdAt (auto-managed by Prisma since we
        // only update mutable columns here). This means a same-day
        // re-run after a vendor-API recovery will overwrite a stale
        // value with the corrected one — which is what we want.
        value: valueJson,
        classification: spec.classification,
        metadata: JSON.stringify({
          dataSource: result.dataSource,
          executionTime: result.executionTime,
          fromCache: result.fromCache,
          capturedAt,
        }),
      },
      create: {
        source: spec.source,
        asOf,
        value: valueJson,
        classification: spec.classification,
        metadata: JSON.stringify({
          dataSource: result.dataSource,
          executionTime: result.executionTime,
          fromCache: result.fromCache,
          capturedAt,
        }),
      },
    });
    return {
      source: spec.source,
      asOf,
      status: 'ok',
      value: valueJson,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      source: spec.source,
      asOf,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - started,
    };
  }
}

/**
 * Ensure the system user row exists. Required because the data
 * providers' audit-log path writes an AuditLog row whose `userId`
 * column is a foreign key to User. Without this row, every snapshot
 * call would emit a P2003 foreign-key violation in the audit logger
 * (which catches and logs the error, but spams stderr and means we
 * lose the audit trail for system-initiated reads).
 *
 * Idempotent: upsert by stable id. Update path is deliberately empty
 * so a re-run never mutates an existing row — if an operator ever
 * renames the system user (unlikely), it stays renamed.
 */
export async function ensureSystemUser(prisma: PrismaClient): Promise<void> {
  await prisma.user.upsert({
    where: { id: SYSTEM_USER.id },
    update: {},
    create: {
      id: SYSTEM_USER.id,
      email: SYSTEM_USER.email,
      name: SYSTEM_USER.name,
      role: SYSTEM_USER.role,
      department: SYSTEM_USER.department,
      hasOnboarded: true,
    },
  });
}

/**
 * Capture snapshots for every source in SNAPSHOTTED_SOURCES.
 *
 * Sequential (not parallel) on purpose: each Freshworks call hits a
 * vendor API with rate limits, and we'd rather queue than burst.
 * Three sources × ~2-3s per call = ~10s total runtime; perfectly fine
 * for a nightly cron.
 *
 * Returns the full per-source result array. The CLI prints each, and
 * exits non-zero if ANY source had `status === 'error'` (skip is OK —
 * it just means the upstream had no value to record this run).
 */
export async function runDailySnapshots(
  prisma: PrismaClient,
  asOf: Date = normalizeAsOfUtc(),
): Promise<SnapshotResult[]> {
  await ensureSystemUser(prisma);
  const results: SnapshotResult[] = [];
  for (const spec of SNAPSHOTTED_SOURCES) {
    results.push(await captureSnapshot(prisma, spec, asOf));
  }
  return results;
}
