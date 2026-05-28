/**
 * verify-freshdesk-truth.ts — programmatic ground-truth check for the
 * Freshdesk-derived KPIs surfaced on /admin/freshworks/health and the
 * AI-builder dashboards.
 *
 * WHY THIS EXISTS
 * ───────────────
 * `freshdesk_open_ticket_count` and `freshdesk_overdue_ticket_count`
 * are computed by FreshworksDataProvider from a 100-row windowed slice
 * (see fetchTicketsForPoP() in src/lib/data/freshworks-data-provider.ts).
 * When either underlying API call returns ≥100 rows, the dashboard sets
 * `comparison_unavailable_reason: "API window at 100-row cap…"` and
 * refuses to compute the period-over-period number — but it STILL shows
 * the windowed `value`, which may undercount the true open ticket
 * population if the tenant has more open tickets than fit in two
 * 100-row pages.
 *
 * GROUND TRUTH STRATEGY
 * ─────────────────────
 * Uses Freshdesk's `/api/v2/search/tickets?query="status:N"` endpoint
 * for each status code. The response includes a `total` field that
 * reports the TRUE count, even when `results` is capped at 300. This
 * gives us an authoritative per-status count in O(1) calls per status
 * — far cheaper than walking the full /api/v2/tickets pagination,
 * which on this tenant would mean 140+ page fetches.
 *
 * USAGE
 * ─────
 *   npx tsx scripts/verify-freshdesk-truth.ts
 *
 * Optional env:
 *   DISPLAYED_OPEN_COUNT=27    # what the dashboard shows; verdict
 *                              # compares against this. Defaults to
 *                              # whatever the dashboard returns at run
 *                              # time (we don't auto-fetch since prod
 *                              # is auth-gated; pass it manually).
 *
 * EXIT CODES
 * ──────────
 *   0  Verification ran successfully (verdict is informational).
 *   1  Configuration / API error.
 */

import path from 'node:path';

// ── Env loading ──────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  // Node 20.6+ ships process.loadEnvFile; fall back to a tiny parser
  // for older runtimes. tsx ^4.21 ships its own resolver; this is a
  // belt-and-braces attempt so the script Just Works.
  const loader = (process as unknown as {
    loadEnvFile?: (p: string) => void;
  }).loadEnvFile;
  if (typeof loader === 'function') {
    try {
      loader(envPath);
      return;
    } catch (err) {
      // File not present or unreadable; carry on — env may be exported
      // by the shell already.
      if ((err as { code?: string }).code !== 'ENOENT') {
        console.warn(`[verify] loadEnvFile warning: ${(err as Error).message}`);
      }
      return;
    }
  }
  // Manual minimal parser fallback (KEY=VALUE, ignoring blanks/comments).
  try {
    const fs = require('node:fs') as typeof import('node:fs');
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      // strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // No .env.local — caller must export env vars themselves.
  }
}

loadEnv();

// ── Config ───────────────────────────────────────────────────────────────────

const FRESHDESK_API_KEY = process.env.FRESHDESK_API_KEY;
const FRESHDESK_DOMAIN = process.env.FRESHDESK_DOMAIN;
const DISPLAYED_OPEN_COUNT = process.env.DISPLAYED_OPEN_COUNT
  ? Number(process.env.DISPLAYED_OPEN_COUNT)
  : null;

if (!FRESHDESK_API_KEY || !FRESHDESK_DOMAIN) {
  console.error(
    '[verify] FRESHDESK_API_KEY and FRESHDESK_DOMAIN must be set ' +
      '(in .env.local or exported in the shell).'
  );
  process.exit(1);
}

// Freshdesk numeric statuses (mirrors src/lib/integrations/freshworks/freshdesk/client.ts).
const FRESHDESK_STATUS: Record<number, string> = {
  2: 'Open',
  3: 'Pending',
  4: 'Resolved',
  5: 'Closed',
  6: 'Waiting on Customer',
  7: 'Waiting on Third Party',
};

// "Open" predicate — must mirror ticketIsOpen() in
// src/lib/integrations/freshworks/freshdesk/client.ts.
const OPEN_STATUSES = [2, 3, 6, 7] as const;

// ── HTTP ─────────────────────────────────────────────────────────────────────

function authHeader(): string {
  // Freshdesk uses HTTP Basic with API_KEY as the username and "X" as a
  // placeholder password.
  const credentials = Buffer.from(`${FRESHDESK_API_KEY}:X`).toString('base64');
  return `Basic ${credentials}`;
}

function buildBaseUrl(domain: string): string {
  // Accept either "mytenant.freshdesk.com" or "https://mytenant.freshdesk.com".
  const stripped = domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return `https://${stripped}`;
}

/**
 * Search the Freshdesk tickets index for a specific status.
 *
 * `/api/v2/search/tickets?query="status:N"` returns:
 *   { total: number, results: Ticket[] }
 *
 * `total` is the authoritative count of all matching tickets, even
 * though `results` is capped at 30 per page / 300 total. That's
 * exactly what we want — we don't care about the ticket rows here,
 * only the count.
 *
 * Note: the search index is "near-real-time" per Freshdesk docs;
 * counts may lag the source of truth by tens of seconds. For
 * verification at hourly+ resolution this is fine.
 */
async function searchCountByStatus(
  status: number
): Promise<{ total: number; latencyMs: number }> {
  const baseUrl = buildBaseUrl(FRESHDESK_DOMAIN!);
  // Freshdesk's search query must be double-quoted then URL-encoded.
  const query = encodeURIComponent(`"status:${status}"`);
  const url = `${baseUrl}/api/v2/search/tickets?query=${query}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
    },
  });
  const latencyMs = Date.now() - t0;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Freshdesk ${res.status} ${res.statusText} on status=${status}: ${body.slice(0, 240)}`
    );
  }
  const data = (await res.json()) as { total?: number };
  if (typeof data?.total !== 'number') {
    throw new Error(
      `Unexpected search response shape on status=${status}: ${JSON.stringify(data).slice(0, 240)}`
    );
  }
  return { total: data.total, latencyMs };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔎 Freshdesk ground-truth verification');
  console.log(`   domain: ${FRESHDESK_DOMAIN}`);
  console.log(`   method: /api/v2/search/tickets (uses authoritative \`total\` field)`);
  console.log('');

  const t0 = Date.now();
  const counts = new Map<number, number>();
  for (const status of Object.keys(FRESHDESK_STATUS).map(Number)) {
    process.stdout.write(`   ${FRESHDESK_STATUS[status].padEnd(24)} `);
    try {
      const { total, latencyMs } = await searchCountByStatus(status);
      counts.set(status, total);
      console.log(`total=${String(total).padStart(6)}  (${latencyMs}ms)`);
    } catch (err) {
      console.log(`❌ ${(err as Error).message}`);
      process.exit(1);
    }
  }
  const wallMs = Date.now() - t0;

  console.log('');
  console.log('   ─────────────────────────────────────────────────────────────');
  console.log('   Distribution by status:');
  for (const status of Object.keys(FRESHDESK_STATUS).map(Number)) {
    const label = FRESHDESK_STATUS[status];
    const count = counts.get(status) ?? 0;
    const isOpen = (OPEN_STATUSES as readonly number[]).includes(status);
    console.log(
      `     ${isOpen ? '🟢' : '⚪'} ${label.padEnd(24)} ${String(count).padStart(7)}` +
        (isOpen ? '   (counts as Open)' : '')
    );
  }
  console.log('');

  const trueOpen = (OPEN_STATUSES as readonly number[]).reduce(
    (acc, s) => acc + (counts.get(s) ?? 0),
    0
  );
  const trueAll = Array.from(counts.values()).reduce((acc, v) => acc + v, 0);

  console.log(`   TRUE open (statuses 2,3,6,7): ${trueOpen}`);
  console.log(`   TRUE total (statuses 2-7):    ${trueAll}`);
  console.log(`   wall time:                    ${wallMs}ms`);
  console.log('');

  // ── Verdict ────────────────────────────────────────────────────────────────
  if (DISPLAYED_OPEN_COUNT == null) {
    console.log('   ℹ️  DISPLAYED_OPEN_COUNT not provided. To get a verdict:');
    console.log(
      '       DISPLAYED_OPEN_COUNT=<value-from-dashboard> npx tsx scripts/verify-freshdesk-truth.ts'
    );
  } else {
    const delta = trueOpen - DISPLAYED_OPEN_COUNT;
    const pctOff =
      trueOpen === 0
        ? 0
        : Math.round((Math.abs(delta) / Math.max(1, trueOpen)) * 100);
    console.log(`   Dashboard shows: ${DISPLAYED_OPEN_COUNT}`);
    console.log(`   Ground truth:    ${trueOpen}`);
    console.log(`   Delta:           ${delta >= 0 ? '+' : ''}${delta}  (${pctOff}% off)`);
    console.log('');
    if (delta === 0) {
      console.log('   🟢 GREEN — Dashboard count matches ground truth exactly. Safe to demo as a KPI.');
    } else if (pctOff <= 10) {
      console.log('   🟡 YELLOW — Within 10% of ground truth. Acceptable for high-level demo,');
      console.log('              but be ready to explain "live snapshot, not a closed-period total."');
    } else {
      console.log(`   🔴 RED — Dashboard count is off by ${pctOff}%. Do NOT demo as a KPI without`);
      console.log('             fixing the pagination in src/lib/integrations/freshworks/freshdesk/client.ts');
      console.log('             and src/lib/data/freshworks-data-provider.ts.');
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('verify-freshdesk-truth fatal:', err);
  process.exit(1);
});
