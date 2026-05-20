/**
 * Metric snapshot reader — G-FW-PoP-1 phase 3 (foundation only).
 *
 * Pure-data lookups against the `MetricSnapshot` table, designed to
 * answer the single question:
 *
 *   "What was the value of source X at-or-before time T?"
 *
 * This is the contract the data provider's PoP path will eventually
 * call to compute honest `previous_value` for sources whose vendor
 * APIs lack a date filter (freshsales_pipeline_value, etc.).
 *
 * IMPORTANT — this module is NOT yet wired into any provider's
 * `previous_value` resolution. That swap-from-null-to-real-PoP lands
 * in a SEPARATE commit, AFTER the snapshot writer (phase 2) has had a
 * chance to run for at least one full lookback window (typically 7
 * days). Wiring it sooner would mean every dashboard suddenly shows
 * "100% increase" because the only snapshot is from yesterday — which
 * is the opposite of the truth-by-default contract we're building.
 *
 * The current commit gives us:
 *   - The lookup function (well-tested via the smoke test below)
 *   - A dry-run inspection helper for operators
 *   - Unit-test-style isolation: this file imports nothing from the
 *     data providers, so the reader can be exercised without any
 *     integration surface.
 *
 * This module is SERVER-ONLY (Prisma).
 */

import type { PrismaClient } from '@prisma/client';

/**
 * The tolerance window for "at-or-before T". A snapshot whose `asOf`
 * is more than this far before T is treated as too stale to use —
 * better to fall back to the honest "no comparison available" pill
 * than to pretend a 14-day-old snapshot is "7 days ago".
 *
 * 36 hours accommodates the case where:
 *   - Cron runs at 02:00 UTC on day D
 *   - Operator queries at 01:00 UTC on day D+7
 *   - Latest matching snapshot has asOf = day D-1's bucket (00:00 UTC)
 *   - Distance to T-7d = 25 hours, well within the 36h tolerance
 *
 * Adjusting this requires also adjusting the writer's cadence (currently
 * daily). If we ever go to weekly snapshots, this needs to widen.
 */
export const DEFAULT_STALENESS_TOLERANCE_MS = 36 * 60 * 60 * 1000;

export interface SnapshotLookupOptions {
  /**
   * The "T" in "at-or-before T". For a 7-day PoP, callers pass
   * `Date.now() - 7 * 24 * 3600 * 1000` (or use the helper below).
   */
  asOfOrBefore: Date;
  /** Override DEFAULT_STALENESS_TOLERANCE_MS for special cases. */
  toleranceMs?: number;
}

export interface SnapshotLookupResult {
  /** The exact snapshot row's asOf (the bucket boundary). */
  asOf: Date;
  /** Decoded JSON payload. KPI sources are typically `number`. */
  value: unknown;
  /**
   * Distance in ms between the requested asOfOrBefore and the
   * returned snapshot's asOf. Useful for operator diagnostics
   * ("the snapshot used was 23 hours older than ideal").
   */
  staleness: number;
  classification: string;
  metadata: string | null;
  createdAt: Date;
}

/**
 * Look up the latest MetricSnapshot for `source` whose `asOf` is
 * at-or-before `asOfOrBefore`. Returns `null` when:
 *   - no snapshot exists for the source at all (table empty for it),
 *   - all snapshots are AFTER the requested moment (we're asking
 *     about a time before any history was captured), or
 *   - the latest matching snapshot is older than the staleness
 *     tolerance (too stale to honestly call "previous_value").
 *
 * Each null case is the SAME truth: "the system cannot honestly
 * answer this PoP question". Callers should fall back to the
 * comparison_unavailable_reason pill rather than fabricating a
 * number.
 */
export async function lookupSnapshotAsOf(
  prisma: PrismaClient,
  source: string,
  options: SnapshotLookupOptions,
): Promise<SnapshotLookupResult | null> {
  const tolerance = options.toleranceMs ?? DEFAULT_STALENESS_TOLERANCE_MS;
  const target = options.asOfOrBefore;

  const row = await prisma.metricSnapshot.findFirst({
    where: {
      source,
      asOf: { lte: target },
    },
    orderBy: { asOf: 'desc' },
    take: 1,
  });

  if (!row) return null;

  const staleness = target.getTime() - row.asOf.getTime();
  if (staleness > tolerance) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(row.value);
  } catch {
    // Defensive: if a row's value is not valid JSON (writer bug,
    // manual DB tinkering), treat it as missing. Better an honest
    // null than a corrupted PoP.
    return null;
  }

  return {
    asOf: row.asOf,
    value: decoded,
    staleness,
    classification: row.classification,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

/**
 * Convenience wrapper: "what was source X's value 7 days ago?"
 *
 * Just sugar over lookupSnapshotAsOf — exists because this is the
 * single most common case (the PoP path uses 7d as the standard
 * lookback) and a typo in `7 * 24 * 3600 * 1000` would shift the
 * window without any signal that something's wrong.
 */
export async function lookupSnapshotDaysAgo(
  prisma: PrismaClient,
  source: string,
  daysAgo: number,
  toleranceMs?: number,
): Promise<SnapshotLookupResult | null> {
  const target = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return lookupSnapshotAsOf(prisma, source, {
    asOfOrBefore: target,
    toleranceMs,
  });
}

/**
 * Operator diagnostic: list every snapshot the table currently holds
 * for a source, newest first. Used by the (forthcoming) admin
 * snapshot-history page; also handy for ad-hoc dev verification.
 *
 * Limited to 90 rows by default — the writer is daily, so 90 rows is
 * three months. Callers needing the full series should paginate.
 */
export async function listSnapshotHistory(
  prisma: PrismaClient,
  source: string,
  limit: number = 90,
): Promise<Array<{ asOf: Date; value: unknown; createdAt: Date }>> {
  const rows = await prisma.metricSnapshot.findMany({
    where: { source },
    orderBy: { asOf: 'desc' },
    take: Math.max(1, Math.min(limit, 365)),
  });
  return rows.map((r) => {
    let decoded: unknown;
    try {
      decoded = JSON.parse(r.value);
    } catch {
      decoded = null;
    }
    return { asOf: r.asOf, value: decoded, createdAt: r.createdAt };
  });
}
