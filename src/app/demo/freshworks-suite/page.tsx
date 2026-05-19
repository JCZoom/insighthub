/**
 * /demo/freshworks-suite — Freshworks Suite Live demo dashboard.
 *
 * Built for the 2026-05-20 stakeholder review. Renders LIVE data from all
 * 4 Freshworks products (Freshsales, Freshdesk, Freshcaller, Freshchat)
 * through the shared `FreshworksDataProvider`, surfacing compliance
 * evidence (classification, redaction, audit, retention) on every section.
 *
 * Compliance highlights surfaced ON the page:
 *   - CUSTOMER_CONFIDENTIAL classification badge per product (G-01)
 *   - Per-user role indicator + "masked" / "unmasked" banner
 *   - Per-product configuration status
 *   - Admin-only "Purge ALL Freshworks caches" button (G-05 demo lever)
 *   - Compliance footer with file/policy references
 *
 * NOT a production dashboard. Production integration into the dashboard
 * catalog is a Tier-2 follow-up after the audit.
 */

import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import {
  FreshworksDataProvider,
  isFreshworksSource,
  type FreshworksProviderResult,
  type FreshworksSource,
} from '@/lib/data/freshworks-data-provider';
import PurgeAllCachesButton from './PurgeAllCachesButton';

export const dynamic = 'force-dynamic';

interface LoadedSource {
  source: FreshworksSource;
  result: FreshworksProviderResult | null;
  error: string | null;
}

async function safeQuery(
  source: FreshworksSource,
  user: Awaited<ReturnType<typeof getCurrentUser>>
): Promise<LoadedSource> {
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
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function formatNumber(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
}

export default async function FreshworksSuiteDemo() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Authentication required</h1>
          <p className="text-gray-600">Sign in to view the Freshworks suite demo.</p>
        </div>
      </main>
    );
  }

  const availability = FreshworksDataProvider.productAvailability();
  const isMasked = user.role === 'VIEWER' || user.role === 'CREATOR';
  const userIsAdmin = isAdmin(user);

  // Fetch only sources whose product is configured. Each product's sources
  // run in parallel; products themselves run in parallel.
  const [
    fsOpenCount, fsPipelineValue, fsDealsByStage, fsTopDeals,
    fdOpenCount, fdOverdueCount, fdTicketsByStatus, fdRecent,
    fcCallsToday, fcByStatus, fcRecent,
    chActive, chByStatus, chRecent,
  ] = await Promise.all([
    availability.freshsales ? safeQuery('freshsales_open_deal_count', user) : null,
    availability.freshsales ? safeQuery('freshsales_pipeline_value', user) : null,
    availability.freshsales ? safeQuery('freshsales_deals_by_stage', user) : null,
    availability.freshsales ? safeQuery('freshsales_top_deals', user) : null,
    availability.freshdesk ? safeQuery('freshdesk_open_ticket_count', user) : null,
    availability.freshdesk ? safeQuery('freshdesk_overdue_ticket_count', user) : null,
    availability.freshdesk ? safeQuery('freshdesk_tickets_by_status', user) : null,
    availability.freshdesk ? safeQuery('freshdesk_recent_tickets', user) : null,
    availability.freshcaller ? safeQuery('freshcaller_calls_today', user) : null,
    availability.freshcaller ? safeQuery('freshcaller_calls_by_status', user) : null,
    availability.freshcaller ? safeQuery('freshcaller_recent_calls', user) : null,
    availability.freshchat ? safeQuery('freshchat_active_conversations', user) : null,
    availability.freshchat ? safeQuery('freshchat_conversations_by_status', user) : null,
    availability.freshchat ? safeQuery('freshchat_recent_conversations', user) : null,
  ]);

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">Freshworks Suite — Live</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Live data from 4 Freshworks products via the InsightHub Freshworks connector.
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

        {/* Per-product configuration status */}
        <div className="flex flex-wrap gap-2 text-xs">
          <ProductBadge name="Freshsales (CRM)" ok={availability.freshsales} />
          <ProductBadge name="Freshdesk (Support)" ok={availability.freshdesk} />
          <ProductBadge name="Freshcaller (Voice)" ok={availability.freshcaller} />
          <ProductBadge name="Freshchat (Messaging)" ok={availability.freshchat} />
        </div>

        <MaskedBanner isMasked={isMasked} role={user.role} />
      </header>

      {/* ── Freshsales section ────────────────────────────────────────────── */}
      <ProductSection
        title="Freshsales — CRM"
        configured={availability.freshsales}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard
            title="Open deals"
            value={fsOpenCount?.result?.data[0]?.value as number | undefined}
            error={fsOpenCount?.error ?? null}
          />
          <KpiCard
            title="Pipeline value (open)"
            value={fsPipelineValue?.result?.data[0]?.value as number | undefined}
            format="money"
            error={fsPipelineValue?.error ?? null}
          />
        </div>
        <ChartBlock title="Deals by stage" loaded={fsDealsByStage} valueKey="count" labelKey="stage" />
        <TableBlock
          title="Top open deals"
          loaded={fsTopDeals}
          columns={['name', 'amount', 'stage', 'primary_contact', 'expected_close']}
          moneyKeys={new Set(['amount'])}
        />
      </ProductSection>

      {/* ── Freshdesk section ─────────────────────────────────────────────── */}
      <ProductSection
        title="Freshdesk — Support tickets"
        configured={availability.freshdesk}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard
            title="Open tickets"
            value={fdOpenCount?.result?.data[0]?.value as number | undefined}
            error={fdOpenCount?.error ?? null}
          />
          <KpiCard
            title="Overdue tickets"
            value={fdOverdueCount?.result?.data[0]?.value as number | undefined}
            error={fdOverdueCount?.error ?? null}
            danger
          />
        </div>
        <ChartBlock title="Tickets by status" loaded={fdTicketsByStatus} valueKey="count" labelKey="status" />
        <TableBlock
          title="Recent tickets"
          loaded={fdRecent}
          columns={['id', 'subject', 'status', 'requester_email', 'due_by']}
        />
      </ProductSection>

      {/* ── Freshcaller section ───────────────────────────────────────────── */}
      <ProductSection
        title="Freshcaller — Voice"
        configured={availability.freshcaller}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard
            title="Calls today (UTC)"
            value={fcCallsToday?.result?.data[0]?.value as number | undefined}
            error={fcCallsToday?.error ?? null}
          />
          <div /> {/* spacer for alignment */}
        </div>
        <ChartBlock title="Calls by status" loaded={fcByStatus} valueKey="count" labelKey="status" />
        <TableBlock
          title="Recent calls"
          loaded={fcRecent}
          columns={['id', 'phone_number', 'status', 'duration_s', 'created_at']}
        />
      </ProductSection>

      {/* ── Freshchat section ─────────────────────────────────────────────── */}
      <ProductSection
        title="Freshchat — Messaging"
        configured={availability.freshchat}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard
            title="Active conversations"
            value={chActive?.result?.data[0]?.value as number | undefined}
            error={chActive?.error ?? null}
          />
          <div />
        </div>
        <ChartBlock title="Conversations by status" loaded={chByStatus} valueKey="count" labelKey="status" />
        <TableBlock
          title="Recent conversations"
          loaded={chRecent}
          columns={['conversation_id', 'status', 'assigned_agent_id', 'updated_time']}
        />
      </ProductSection>

      {/* Admin retention lever */}
      {userIsAdmin && (
        <section className="border border-purple-300 bg-purple-50 dark:bg-purple-950/20 rounded-lg p-5">
          <h2 className="text-lg font-medium mb-1">🛡️ Admin: retention lever (all 4 products)</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            Wipe ALL Freshworks caches (Freshsales + Freshdesk + Freshcaller + Freshchat) live.
            Emits a single <code className="font-mono">retention.purge_freshworks_cache</code> audit entry.
          </p>
          <PurgeAllCachesButton />
        </section>
      )}

      {/* Compliance footer */}
      <footer className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-1">
        <div>
          <strong>Data path:</strong> Freshworks REST APIs (TLS 1.2+) → 60 s Redis cache
          (per-product prefixes <code>fw-sales:</code> <code>fw-desk:</code> <code>fw-call:</code> <code>fw-chat:</code>)
          → field-level redaction (mask-by-default for VIEWER/CREATOR) → this page.
        </div>
        <div>
          <strong>Audit trail:</strong> every read emits <code>integration.freshworks.read</code> tagged with the product ·
          retention purges emit <code>retention.purge_freshworks_cache</code> · 365-day audit log retention (G-06).
        </div>
        <div>
          <strong>Compliance docs:</strong>{' '}
          <code>docs/VENDOR_REGISTER.md</code> V-01/11/12/13 ·{' '}
          <code>docs/ASSET_REGISTER.md</code> ·{' '}
          <code>docs/RISK_REGISTER.md</code> R-041..R-046 ·{' '}
          <code>docs/RETENTION_AUTOMATION.md</code>.
        </div>
      </footer>
    </main>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function ProductBadge({ name, ok }: { name: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
        ok
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
      }`}
    >
      <span aria-hidden>{ok ? '●' : '○'}</span>
      {name}
    </span>
  );
}

function MaskedBanner({ isMasked, role }: { isMasked: boolean; role: string }) {
  return (
    <div
      className={`text-sm p-3 rounded border ${
        isMasked
          ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
          : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
      }`}
    >
      {isMasked ? (
        <>
          <strong>PII masked.</strong> Your role ({role}) sees emails, phones, names, ticket bodies,
          chat content, and voicemail transcripts redacted. POWER_USER and ADMIN see unmasked data.
          Unmask requires an audit-logged admin override.
        </>
      ) : (
        <>
          <strong>Unmasked view.</strong> Your role ({role}) sees full PII across all 4 products.
          Every read is audit-logged with product attribution.
        </>
      )}
    </div>
  );
}

function ProductSection({
  title,
  configured,
  children,
}: {
  title: string;
  configured: boolean;
  children: React.ReactNode;
}) {
  if (!configured) {
    return (
      <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-5 opacity-60">
        <h2 className="text-lg font-medium mb-2">{title}</h2>
        <div className="text-sm text-gray-500">Not configured on this environment. Skipping.</div>
      </section>
    );
  }
  return (
    <section className="space-y-4 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function KpiCard({
  title,
  value,
  format,
  error,
  danger = false,
}: {
  title: string;
  value: number | undefined;
  format?: 'money';
  error: string | null;
  danger?: boolean;
}) {
  const colorClass =
    danger && typeof value === 'number' && value > 0
      ? 'text-red-600 dark:text-red-400'
      : '';
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
      <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
      {error && <ErrorBlock message={error} />}
      {!error && (
        <div className={`mt-2 text-4xl font-semibold ${colorClass}`}>
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

function ChartBlock({
  title,
  loaded,
  valueKey,
  labelKey,
}: {
  title: string;
  loaded: LoadedSource | null;
  valueKey: string;
  labelKey: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{title}</h3>
        <span className="text-xs text-gray-500">
          {loaded?.result?.totalRows ?? 0} categories
        </span>
      </div>
      {loaded?.error && <ErrorBlock message={loaded.error} />}
      {loaded?.result && <BarChart rows={loaded.result.data} valueKey={valueKey} labelKey={labelKey} />}
    </div>
  );
}

function BarChart({
  rows,
  valueKey,
  labelKey,
}: {
  rows: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
}) {
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey]) || 0));
  if (rows.length === 0) {
    return <div className="text-sm text-gray-500 py-2">No data.</div>;
  }
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => {
        const label = String(r[labelKey] ?? 'Unknown');
        const value = Number(r[valueKey]) || 0;
        const pct = (value / max) * 100;
        return (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className="w-44 truncate" title={label}>
              {label}
            </div>
            <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500 dark:bg-blue-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-12 text-right tabular-nums text-gray-700 dark:text-gray-300">
              {value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableBlock({
  title,
  loaded,
  columns,
  moneyKeys,
}: {
  title: string;
  loaded: LoadedSource | null;
  columns: string[];
  moneyKeys?: Set<string>;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{title}</h3>
        <span className="text-xs text-gray-500">{loaded?.result?.totalRows ?? 0} rows</span>
      </div>
      {loaded?.error && <ErrorBlock message={loaded.error} />}
      {loaded?.result && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                {columns.map((c) => (
                  <th key={c} className="py-2 pr-4">
                    {c.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loaded.result.data.map((r, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  {columns.map((c) => {
                    const v = r[c];
                    return (
                      <td key={c} className="py-2 pr-4 align-top">
                        {moneyKeys?.has(c)
                          ? formatMoney(v)
                          : typeof v === 'number'
                            ? formatNumber(v)
                            : String(v ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {loaded.result.data.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="py-6 text-center text-gray-500">
                    No rows in current window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
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
