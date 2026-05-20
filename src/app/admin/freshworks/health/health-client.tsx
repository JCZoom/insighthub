'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CircleSlash,
  Power,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mirror of the server-side types in `src/lib/data/freshworks-health.ts`.
// Duplicated here so this client module has zero server imports (and therefore
// doesn't accidentally try to bundle `ioredis` — see the bundling-boundaries
// crash course in docs/).

type Flag =
  | 'ZERO_ROWS'
  | 'STATUS_ALL_UNKNOWN'
  | 'ALL_NULL_TIMESTAMPS'
  | 'ALL_NULL_DURATIONS'
  | 'SINGLE_BUCKET'
  | 'NOT_CONFIGURED'
  | 'ERROR';

type Status = 'ok' | 'empty' | 'suspicious' | 'error' | 'not_configured';

interface SourceHealth {
  source: string;
  product: 'freshsales' | 'freshdesk' | 'freshcaller' | 'freshchat';
  status: Status;
  rowCount: number;
  latencyMs: number;
  sampleKeys: string[];
  sampleRow: Record<string, unknown> | null;
  flags: Flag[];
  fromCache: boolean;
  error: string | null;
}

interface HealthReport {
  asOf: string;
  durationMs: number;
  summary: Record<Status, number>;
  productAvailability: Record<SourceHealth['product'], boolean>;
  sources: SourceHealth[];
}

// ── Visual config ────────────────────────────────────────────────────────────

const STATUS_META: Record<
  Status,
  { label: string; tone: string; Icon: typeof CheckCircle2 }
> = {
  ok: {
    label: 'OK',
    tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    Icon: CheckCircle2,
  },
  suspicious: {
    label: 'Suspicious',
    tone: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    Icon: AlertTriangle,
  },
  empty: {
    label: 'Empty',
    tone: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    Icon: CircleSlash,
  },
  error: {
    label: 'Error',
    tone: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    Icon: XCircle,
  },
  not_configured: {
    label: 'Not configured',
    tone: 'bg-slate-700/40 text-slate-400 border-slate-600/40',
    Icon: Power,
  },
};

const FLAG_EXPLAIN: Record<Flag, string> = {
  ZERO_ROWS: 'Source returned 0 rows. Either the upstream API is empty, the endpoint is wrong, or the response is being parsed into an empty array.',
  STATUS_ALL_UNKNOWN: 'Every row\'s `status` is "unknown" — the field-name resolver isn\'t matching this tenant\'s API response shape.',
  ALL_NULL_TIMESTAMPS: 'Every row\'s timestamp field is null. The field name in this tenant\'s response probably differs from what we\'re reading.',
  ALL_NULL_DURATIONS: 'Every call row has duration_s=null — Freshcaller duration field-name mismatch.',
  SINGLE_BUCKET: 'A *_by_status / *_by_stage source collapsed into one bucket. Likely the grouping field isn\'t being parsed and everything is defaulting to one label.',
  NOT_CONFIGURED: 'This product\'s API key is not present in the environment, so the source was skipped.',
  ERROR: 'The source threw an exception. See the inline error message.',
};

const PRODUCT_COLOR: Record<SourceHealth['product'], string> = {
  freshsales: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  freshdesk: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  freshcaller: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  freshchat: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

// ── Component ────────────────────────────────────────────────────────────────

export function FreshworksHealthClient() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/freshworks/health', {
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as HealthReport;
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const summary = report?.summary;
  const total = report?.sources.length ?? 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">
              Freshworks Source Health
            </h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-3xl leading-relaxed">
              Exercises every registered Freshworks data source and reports row
              counts, field shapes, latency, and integrity flags. Companion to{' '}
              <code className="text-[var(--text-primary)]">/api/admin/freshworks/diagnostics</code>{' '}
              (which reports connector state, not data shape). Use this page
              before publishing any Freshworks-backed dashboard tile to a
              stakeholder.
            </p>
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">
            <strong>Probe failed:</strong> {error}
          </div>
        )}

        {/* Summary tiles */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
            {(Object.keys(STATUS_META) as Status[]).map((s) => {
              const meta = STATUS_META[s];
              const Icon = meta.Icon;
              const count = summary[s] ?? 0;
              return (
                <div
                  key={s}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 flex items-center gap-3',
                    meta.tone
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <div>
                    <div className="text-xl font-semibold leading-none">{count}</div>
                    <div className="text-xs mt-0.5 opacity-80">{meta.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {report && (
          <div className="mb-4 text-xs text-[var(--text-secondary)] flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Probed {total} sources in {report.durationMs} ms
            </span>
            <span>at {new Date(report.asOf).toLocaleString()}</span>
            <span>
              Configured products:{' '}
              {Object.entries(report.productAvailability)
                .filter(([, on]) => on)
                .map(([p]) => p)
                .join(', ') || 'none'}
            </span>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 w-8" />
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Rows</th>
                <th className="px-3 py-2 text-right">Latency</th>
                <th className="px-3 py-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {loading && !report && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--text-secondary)]">
                    Probing 17 sources…
                  </td>
                </tr>
              )}
              {report?.sources.map((row) => {
                const meta = STATUS_META[row.status];
                const Icon = meta.Icon;
                const isOpen = expanded[row.source];
                return (
                  <Fragment key={row.source}>
                    <tr
                      className="border-t border-[var(--border-default)] hover:bg-[var(--bg-hover)]/40 cursor-pointer"
                      onClick={() =>
                        setExpanded((e) => ({ ...e, [row.source]: !e[row.source] }))
                      }
                    >
                      <td className="px-3 py-2 text-[var(--text-secondary)]">
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--text-primary)]">
                        {row.source}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded text-xs border',
                            PRODUCT_COLOR[row.product]
                          )}
                        >
                          {row.product}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border',
                            meta.tone
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-[var(--text-primary)]">
                        {row.rowCount}
                        {row.fromCache && (
                          <span
                            title="Served from Redis cache"
                            className="ml-1 text-[var(--text-secondary)]"
                          >
                            ◊
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-[var(--text-secondary)]">
                        {row.latencyMs} ms
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {row.flags.length === 0 ? (
                            <span className="text-[var(--text-secondary)] text-xs">—</span>
                          ) : (
                            row.flags.map((f) => (
                              <span
                                key={f}
                                title={FLAG_EXPLAIN[f]}
                                className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono"
                              >
                                {f}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-[var(--border-default)] bg-[var(--bg-elevated)]/40">
                        <td />
                        <td colSpan={6} className="px-3 py-3 text-xs">
                          {row.error && (
                            <div className="mb-2 p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono">
                              {row.error}
                            </div>
                          )}
                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <div className="font-semibold text-[var(--text-secondary)] uppercase text-[10px] tracking-wider mb-1">
                                Sample row keys ({row.sampleKeys.length})
                              </div>
                              {row.sampleKeys.length === 0 ? (
                                <div className="text-[var(--text-secondary)]">No row to inspect.</div>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {row.sampleKeys.map((k) => (
                                    <span
                                      key={k}
                                      className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-default)] font-mono text-[11px]"
                                    >
                                      {k}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-[var(--text-secondary)] uppercase text-[10px] tracking-wider mb-1">
                                Sample row (sanitized)
                              </div>
                              {row.sampleRow ? (
                                <pre className="text-[11px] leading-tight bg-[var(--bg-surface)] border border-[var(--border-default)] rounded p-2 overflow-x-auto max-h-48 text-[var(--text-primary)]">
                                  {JSON.stringify(row.sampleRow, null, 2)}
                                </pre>
                              ) : (
                                <div className="text-[var(--text-secondary)]">No sample available.</div>
                              )}
                            </div>
                          </div>
                          {row.flags.length > 0 && (
                            <div className="mt-3 space-y-1">
                              <div className="font-semibold text-[var(--text-secondary)] uppercase text-[10px] tracking-wider">
                                What these flags mean
                              </div>
                              {row.flags.map((f) => (
                                <div key={f} className="text-[var(--text-secondary)]">
                                  <span className="font-mono text-amber-300">{f}</span>: {FLAG_EXPLAIN[f]}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-[var(--text-secondary)] leading-relaxed max-w-3xl">
          <strong className="text-[var(--text-primary)]">Reading this page:</strong>{' '}
          Click any row to expand its sample keys and a sanitized sample value
          payload. Hover any flag pill for an explanation. The ◊ symbol on a
          row count means the result came from the 60-second Redis cache; hit
          Refresh to force a re-probe (cache still applies if upstream was
          touched within 60 s).
        </div>
      </div>
    </div>
  );
}
