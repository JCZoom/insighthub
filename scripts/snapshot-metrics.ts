/**
 * snapshot-metrics.ts — daily MetricSnapshot writer (G-FW-PoP-1 phase 2).
 *
 * Captures the current value of every source in
 * `SNAPSHOTTED_SOURCES` (see src/lib/data/metric-snapshot-writer.ts)
 * and persists each to the `MetricSnapshot` table, idempotently keyed
 * on (source, asOf=midnight UTC).
 *
 * Usage:
 *   npx tsx scripts/snapshot-metrics.ts             # daily run
 *   ASOF=2026-05-15 npx tsx scripts/snapshot-metrics.ts
 *                                                  # backfill specific date
 *
 * Cron wrapper: scripts/cron/snapshot-metrics.sh.
 *
 * Exit codes:
 *   0  every source returned ok or skipped-no-value (skip is
 *      acceptable: it means the source had no value to record this
 *      run, e.g. vendor API was degraded — honest absence is captured
 *      by the absence of a row, not by writing a fake zero)
 *   1  at least one source returned error
 *
 * Demo-safe: this script writes to a table that nothing reads yet
 * (phase 3 ships in a separate commit). Running it tonight or
 * scheduling it pre-demo has zero effect on dashboard rendering.
 */

import { PrismaClient } from '@prisma/client';
import {
  runDailySnapshots,
  normalizeAsOfUtc,
  SNAPSHOTTED_SOURCES,
} from '../src/lib/data/metric-snapshot-writer';

const prisma = new PrismaClient();

function parseAsOfFromEnv(): Date {
  const raw = process.env.ASOF;
  if (!raw) return normalizeAsOfUtc();
  // Accept YYYY-MM-DD; coerce to start-of-UTC-day. Reject anything else
  // loudly rather than silently accepting odd inputs that could
  // shift the bucket and create duplicate rows.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) {
    console.error(`ASOF=${raw} not recognized. Expected YYYY-MM-DD.`);
    process.exit(2);
  }
  const [, y, mo, d] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
}

async function main() {
  const asOf = parseAsOfFromEnv();
  console.log(`📸 snapshot-metrics — asOf=${asOf.toISOString()}`);
  console.log(`   sources: ${SNAPSHOTTED_SOURCES.length}`);
  console.log('');

  const results = await runDailySnapshots(prisma, asOf);

  let okCount = 0;
  let skipCount = 0;
  let errCount = 0;

  for (const r of results) {
    const t = `${r.latencyMs}ms`;
    if (r.status === 'ok') {
      okCount++;
      console.log(`  ✅ ${r.source.padEnd(40)}  value=${r.value}  (${t})`);
    } else if (r.status === 'skipped-no-value') {
      skipCount++;
      console.log(`  ⚠️  ${r.source.padEnd(40)}  skipped: source returned no value (${t})`);
    } else {
      errCount++;
      console.log(`  ❌ ${r.source.padEnd(40)}  error: ${r.error}  (${t})`);
    }
  }

  console.log('');
  console.log(`   ok=${okCount}  skipped=${skipCount}  error=${errCount}`);
  process.exit(errCount > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error('snapshot-metrics fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
