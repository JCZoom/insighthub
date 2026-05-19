/**
 * /demo/freshsales-pipeline — Sales Pipeline Live demo dashboard.
 *
 * Built for the 2026-05-20 stakeholder review (JD Gershan / Lior Zamir /
 * Avi Katz). Renders live Freshsales CRM data through the
 * `FreshworksDataProvider`, which is the same data path a production
 * dashboard widget would use.
 *
 * Compliance highlights surfaced ON the page itself:
 *   - CUSTOMER_CONFIDENTIAL classification badge (G-01)
 *   - Per-user role indicator + "masked" / "unmasked" banner (G-01, G-02)
 *   - Cache-state diagnostic (60s TTL — G-05)
 *   - Admin-only "Purge cache" button (G-05 demo lever)
 *   - Audit-log link reminder for the read events
 *
 * NOT a production dashboard. This page exists for demo control;
 * production integration into the dashboard catalog is a Tier-2 follow-up.
 */

import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import {
  FreshworksDataProvider,
  isFreshworksSource,
  type FreshworksProviderResult,
} from '@/lib/data/freshworks-data-provider';
import { isFreshsalesConfigured } from '@/lib/integrations/freshworks';
import PurgeCacheButton from './PurgeCacheButton';

export const dynamic = 'force-dynamic'; // never statically prerender — live data

interface LoadedSource {
  source: string;
  result: FreshworksProviderResult | null;
  error: string | null;
}

async function safeQuery(source: string, user: Awaited<ReturnType<typeof getCurrentUser>>): Promise<LoadedSource> {
  if (!isFreshworksSource(source)) {
    return { source, result: null, error: `Unknown source: ${source}` };
  }
  try {
    const result = await FreshworksDataProvider.queryData(source, user);
    return { source, result, error: null };
  } catch (e) {
    return { source, result: null, error: (e as Error).message };
  }
}

function formatMoney(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default async function FreshsalesPipelineDemo() {
  // Auth — every authenticated user sees the page, masking handled downstream.
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Authentication required</h1>
          <p className="text-gray-600">Sign in to view the live Freshsales demo.</p>
        </div>
      </main>
    );
  }

  if (!isFreshsalesConfigured()) {
    return (
      <main className="min-h-screen p-8 max-w-4xl mx-auto">
        <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-6 rounded-lg">
          <h1 className="text-2xl font-semibold mb-2">⚠️ Freshworks connector not configured</h1>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Set <code className="font-mono">FRESHSALES_API_KEY</code> and{' '}
            <code className="font-mono">FRESHSALES_DOMAIN</code> in the server env, then reload.
            See <code>docs/VENDOR_REGISTER.md</code> V-01.
          </p>
        </div>
      </main>
    );
  }

  // Fetch all sources in parallel — the connector handles cache + audit.
  const [openCount, pipelineValue, dealsByStage, topDeals] = await Promise.all([
    safeQuery('freshsales_open_deal_count', user),
    safeQuery('freshsales_pipeline_value', user),
    safeQuery('freshsales_deals_by_stage', user),
    safeQuery('freshsales_top_deals', user),
  ]);

  const isMasked = user.role === 'VIEWER' || user.role === 'CREATOR';
  const userIsAdmin = isAdmin(user);

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto space-y-6">
      {/* Header + compliance banner */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">Sales Pipeline — Live</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Live data from Freshsales CRM via the InsightHub Freshworks connector.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 font-medium">
              <span aria-hidden>🔒</span>
              CUSTOMER_CONFIDENTIAL
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Owner: {user.name} ({user.role})
            </span>
          </div>
        </div>

        <div
          className={`text-sm p-3 rounded border ${
            isMasked
              ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
              : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          {isMasked ? (
            <>
              <strong>PII masked.</strong> Your role ({user.role}) sees emails, phones, and names
              redacted. POWER_USER and ADMIN see unmasked data. Unmask requires an audit-logged
              admin override.
            </>
          ) : (
            <>
              <strong>Unmasked view.</strong> Your role ({user.role}) sees full PII. Every read is
              audit-logged.
            </>
          )}
        </div>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          title="Open deals"
          value={openCount.result?.data[0]?.value as number | undefined}
          error={openCount.error}
        />
        <KpiCard
          title="Pipeline value (open)"
          value={pipelineValue.result?.data[0]?.value as number | undefined}
          format="money"
          error={pipelineValue.error}
        />
      </section>

      {/* Deals by stage — simple horizontal bar chart */}
      <section className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Deals by stage</h2>
          <span className="text-xs text-gray-500">
            {dealsByStage.result?.totalRows ?? 0} stages
          </span>
        </div>
        {dealsByStage.error && <ErrorBlock message={dealsByStage.error} />}
        {dealsByStage.result && <BarChart rows={dealsByStage.result.data} />}
      </section>

      {/* Top deals table */}
      <section className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Top open deals</h2>
          <span className="text-xs text-gray-500">
            {topDeals.result?.totalRows ?? 0} rows
          </span>
        </div>
        {topDeals.error && <ErrorBlock message={topDeals.error} />}
        {topDeals.result && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4">Deal</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Stage</th>
                  <th className="py-2 pr-4">Primary contact</th>
                  <th className="py-2 pr-4">Expected close</th>
                </tr>
              </thead>
              <tbody>
                {topDeals.result.data.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4">{String(r.name ?? '—')}</td>
                    <td className="py-2 pr-4 font-mono">{formatMoney(r.amount)}</td>
                    <td className="py-2 pr-4">{String(r.stage ?? '—')}</td>
                    <td className="py-2 pr-4">{String(r.primary_contact ?? '—')}</td>
                    <td className="py-2 pr-4">{String(r.expected_close ?? '—')}</td>
                  </tr>
                ))}
                {topDeals.result.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      No open deals in the current Freshsales tenant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Admin retention lever */}
      {userIsAdmin && (
        <section className="border border-purple-300 bg-purple-50 dark:bg-purple-950/20 rounded-lg p-5">
          <h2 className="text-lg font-medium mb-1">🛡️ Admin: retention lever</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            Wipe the Freshsales cache live. Use this during the demo to prove the retention
            mechanism. Every purge emits a <code className="font-mono">retention.purge_freshworks_cache</code> audit log entry.
          </p>
          <PurgeCacheButton />
        </section>
      )}

      {/* Compliance footer */}
      <footer className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-1">
        <div>
          <strong>Data path:</strong> Freshsales REST API (TLS 1.2+) → 60 s Redis cache (key prefix <code>fw:</code>) →
          field-level redaction (mask-by-default for VIEWER/CREATOR) → this page.
        </div>
        <div>
          <strong>Audit trail:</strong> every read emits <code>integration.freshworks.read</code> ·
          retention purges emit <code>retention.purge_freshworks_cache</code> ·
          365-day audit log retention (G-06).
        </div>
        <div>
          <strong>Compliance docs:</strong> <code>docs/VENDOR_REGISTER.md</code> V-01 ·
          <code>docs/ASSET_REGISTER.md</code> INFO-24/25/26, SVC-14 ·
          <code>docs/RISK_REGISTER.md</code> R-041, R-042 ·
          <code>docs/RETENTION_AUTOMATION.md</code>.
        </div>
      </footer>
    </main>
  );
}

function KpiCard({
  title,
  value,
  format,
  error,
}: {
  title: string;
  value: number | undefined;
  format?: 'money';
  error: string | null;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
      <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
      {error && <ErrorBlock message={error} />}
      {!error && (
        <div className="mt-2 text-4xl font-semibold">
          {value === undefined
            ? '—'
            : format === 'money'
              ? value.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                })
              : value.toLocaleString()}
        </div>
      )}
    </div>
  );
}

function BarChart({ rows }: { rows: Record<string, unknown>[] }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.count) || 0));
  if (rows.length === 0) {
    return <div className="text-sm text-gray-500 py-4">No deals to chart.</div>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const stage = String(r.stage ?? 'Unknown');
        const count = Number(r.count) || 0;
        const pct = (count / max) * 100;
        return (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className="w-40 truncate" title={stage}>
              {stage}
            </div>
            <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500 dark:bg-blue-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-12 text-right tabular-nums text-gray-700 dark:text-gray-300">
              {count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded p-3 mt-2">
      {message}
    </div>
  );
}
