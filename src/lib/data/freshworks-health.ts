/**
 * Freshworks per-source health probe.
 *
 * Exercises every registered source via `FreshworksDataProvider.queryData`
 * and returns a per-source report that surfaces:
 *   - row count
 *   - latency
 *   - sample field keys from the first returned row (no values — keys only)
 *   - sample value types (so we can see when a "should-be-string" status is
 *     actually undefined and getting defaulted to 'unknown', etc.)
 *   - heuristic flags that highlight data-integrity smells the human eye
 *     wouldn't catch on a colourful dashboard tile:
 *       - ZERO_ROWS           → the source returned 0 rows
 *       - STATUS_ALL_UNKNOWN  → 100% of rows have status === 'unknown'
 *       - ALL_NULL_TIMESTAMPS → every row's created_at / updated_at / updated_time is null
 *       - ALL_NULL_DURATIONS  → every call row has duration_s === null
 *       - SINGLE_BUCKET       → "by_status" / "by_stage" collapsed everything into ONE bucket (probably a parsing bug, not real-world distribution)
 *       - NOT_CONFIGURED      → the product's env vars aren't present
 *       - ERROR               → the source threw
 *
 * Why this exists separately from `freshworks-data-provider.ts`:
 *   The provider is the contract the dashboard uses. The health module is the
 *   operator's microscope on that contract. Keeping it separate means we can
 *   evolve the heuristics (add new flags, tweak thresholds) without touching
 *   the production query path.
 *
 * This module is SERVER-ONLY. It imports `freshworks-data-provider` which
 * pulls in `ioredis`. Do not import this from a client component.
 */

import {
  FreshworksDataProvider,
  listFreshworksSources,
  sourceProduct,
  type FreshworksSource,
} from './freshworks-data-provider';
import type { SessionUser } from '@/lib/auth/session';

export type FreshworksHealthFlag =
  | 'ZERO_ROWS'
  | 'STATUS_ALL_UNKNOWN'
  | 'ALL_NULL_TIMESTAMPS'
  | 'ALL_NULL_DURATIONS'
  | 'SINGLE_BUCKET'
  | 'NOT_CONFIGURED'
  | 'ERROR';

export type FreshworksHealthStatus = 'ok' | 'empty' | 'suspicious' | 'error' | 'not_configured';

export interface FreshworksSourceHealth {
  source: FreshworksSource;
  product: 'freshsales' | 'freshdesk' | 'freshcaller' | 'freshchat';
  status: FreshworksHealthStatus;
  rowCount: number;
  latencyMs: number;
  sampleKeys: string[];
  sampleRow: Record<string, unknown> | null;
  flags: FreshworksHealthFlag[];
  fromCache: boolean;
  error: string | null;
}

export interface FreshworksHealthReport {
  asOf: string;
  durationMs: number;
  summary: {
    ok: number;
    empty: number;
    suspicious: number;
    error: number;
    not_configured: number;
  };
  productAvailability: ReturnType<typeof FreshworksDataProvider.productAvailability>;
  sources: FreshworksSourceHealth[];
}

const TIMESTAMP_KEYS = ['created_at', 'updated_at', 'updated_time', 'ended_at'] as const;

/**
 * Inspect the rows returned for one source and decide which integrity flags
 * to raise. Pure function; no I/O.
 */
function computeFlags(
  source: FreshworksSource,
  rows: Record<string, unknown>[]
): FreshworksHealthFlag[] {
  const flags: FreshworksHealthFlag[] = [];
  if (rows.length === 0) {
    flags.push('ZERO_ROWS');
    return flags;
  }

  const first = rows[0];
  const keys = Object.keys(first);

  // STATUS_ALL_UNKNOWN — applies to detail rows (not aggregates like
  // *_by_status which already collapse to one row per status).
  if (
    keys.includes('status') &&
    !source.endsWith('_by_status') &&
    !source.endsWith('_by_stage') &&
    rows.every((r) => r.status === 'unknown')
  ) {
    flags.push('STATUS_ALL_UNKNOWN');
  }

  // ALL_NULL_TIMESTAMPS — when there's a timestamp column but every row is null.
  const tsKey = TIMESTAMP_KEYS.find((k) => k in first);
  if (tsKey && rows.every((r) => r[tsKey] == null)) {
    flags.push('ALL_NULL_TIMESTAMPS');
  }

  // ALL_NULL_DURATIONS — Freshcaller call rows specifically.
  if (keys.includes('duration_s') && rows.every((r) => r.duration_s == null)) {
    flags.push('ALL_NULL_DURATIONS');
  }

  // SINGLE_BUCKET — *_by_status / *_by_stage collapsing into one row strongly
  // suggests the underlying field isn't being parsed and everything is landing
  // in a default bucket like "unknown". The freshcaller_calls_by_status =
  // {unknown: 100} pattern that motivated this module.
  if (
    (source.endsWith('_by_status') || source.endsWith('_by_stage')) &&
    rows.length === 1
  ) {
    flags.push('SINGLE_BUCKET');
  }

  return flags;
}

function statusFromFlags(flags: FreshworksHealthFlag[], rowCount: number): FreshworksHealthStatus {
  if (flags.includes('ERROR')) return 'error';
  if (flags.includes('NOT_CONFIGURED')) return 'not_configured';
  if (flags.includes('ZERO_ROWS') && flags.length === 1) return 'empty';
  if (flags.length > 0) return 'suspicious';
  if (rowCount === 0) return 'empty';
  return 'ok';
}

/**
 * Best-effort sanitize a sample row for safe operator inspection.
 *
 * We deliberately TRUNCATE long strings (>120 chars) so transcripts or huge
 * blobs don't blow up the UI, and we replace anything that looks like a long
 * digit sequence with a placeholder so phone numbers / account numbers don't
 * leak into screenshots.
 *
 * This is belt-and-braces: the provider already applies its product-specific
 * redactors for VIEWER/CREATOR roles. ADMIN sees raw rows from the provider —
 * but the health page is an operator surface, not a data surface, so we trim
 * once more here.
 */
function sanitizeSample(row: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v == null) {
      out[k] = null;
    } else if (typeof v === 'string') {
      const truncated = v.length > 120 ? `${v.slice(0, 117)}…` : v;
      out[k] = truncated.replace(/\d{7,}/g, '«digits»');
    } else if (typeof v === 'object') {
      // Stringify nested objects so the UI can render them flat. Length-capped.
      try {
        const s = JSON.stringify(v);
        out[k] = s.length > 120 ? `${s.slice(0, 117)}…` : s;
      } catch {
        out[k] = '[unserializable]';
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Probe every Freshworks source as the supplied user. Returns one row per
 * registered source with row counts, sample keys, latency, and flags.
 *
 * Sources whose product isn't configured (no env vars) are reported as
 * `not_configured` with `NOT_CONFIGURED` flag — they are NOT executed.
 *
 * Sources that throw during execution are caught and reported as `error`.
 * One failing source never blocks the rest of the probe.
 */
export async function probeFreshworksHealth(user: SessionUser): Promise<FreshworksHealthReport> {
  const start = Date.now();
  const availability = FreshworksDataProvider.productAvailability();
  const sources = listFreshworksSources();

  // Probe in parallel — each source goes through its product's per-key cache
  // and rate-limiter so we don't overwhelm the upstream API.
  const results = await Promise.all(
    sources.map(async (source): Promise<FreshworksSourceHealth> => {
      const product = sourceProduct(source);
      const sourceStart = Date.now();

      if (!availability[product]) {
        return {
          source,
          product,
          status: 'not_configured',
          rowCount: 0,
          latencyMs: 0,
          sampleKeys: [],
          sampleRow: null,
          flags: ['NOT_CONFIGURED'],
          fromCache: false,
          error: null,
        };
      }

      try {
        const result = await FreshworksDataProvider.queryData(source, user);
        const flags = computeFlags(source, result.data);
        return {
          source,
          product,
          status: statusFromFlags(flags, result.totalRows),
          rowCount: result.totalRows,
          latencyMs: Date.now() - sourceStart,
          sampleKeys: result.data[0] ? Object.keys(result.data[0]) : [],
          sampleRow: sanitizeSample(result.data[0]),
          flags,
          fromCache: result.fromCache,
          error: null,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          source,
          product,
          status: 'error',
          rowCount: 0,
          latencyMs: Date.now() - sourceStart,
          sampleKeys: [],
          sampleRow: null,
          flags: ['ERROR'],
          fromCache: false,
          error: message.length > 240 ? `${message.slice(0, 237)}…` : message,
        };
      }
    })
  );

  const summary = {
    ok: 0,
    empty: 0,
    suspicious: 0,
    error: 0,
    not_configured: 0,
  };
  for (const r of results) {
    summary[r.status] += 1;
  }

  return {
    asOf: new Date().toISOString(),
    durationMs: Date.now() - start,
    summary,
    productAvailability: availability,
    sources: results,
  };
}
