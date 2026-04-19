'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { WidgetConfig } from '@/types';
import { queryDataSync } from '@/lib/data/sample-data';
import { X, Copy, Check, Code2, Database, Table2, Clock, ChevronDown, ChevronUp, Download, BookOpen, ExternalLink } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

interface WidgetQueryPanelProps {
  widget: WidgetConfig;
  onClose: () => void;
}

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  formula: string | null;
  category: string;
  examples: string | null;
  relatedTerms: string;
  dataSource: string | null;
}

/** Generate a representative SQL query from a widget's dataConfig */
function generateSQL(widget: WidgetConfig): string {
  const { source, aggregation, groupBy, filters, orderBy, limit, query } = widget.dataConfig;

  // If there's an explicit query, return it
  if (query) return query;

  const tableName = source || 'unknown_table';

  // SELECT clause
  let selectFields: string[] = [];
  if (groupBy && groupBy.length > 0) {
    selectFields = [...groupBy];
  }
  if (aggregation) {
    const fn = aggregation.function.toUpperCase();
    const field = aggregation.field || '*';
    selectFields.push(`${fn}(${field}) AS ${aggregation.field || 'value'}`);
  }
  if (selectFields.length === 0) {
    selectFields = ['*'];
  }

  let sql = `SELECT ${selectFields.join(',\n       ')}\n  FROM ${tableName}`;

  // WHERE clause
  if (filters && filters.length > 0) {
    const conditions = filters.map(f => {
      if (f.type === 'select' && f.defaultValue !== undefined) {
        return `${f.field} = '${String(f.defaultValue)}'`;
      }
      if (f.type === 'date_range') {
        return `${f.field} BETWEEN :start_date AND :end_date`;
      }
      return `${f.field} IS NOT NULL`;
    });
    sql += `\n WHERE ${conditions.join('\n   AND ')}`;
  }

  // GROUP BY clause
  if (groupBy && groupBy.length > 0) {
    sql += `\n GROUP BY ${groupBy.join(', ')}`;
  }

  // ORDER BY clause
  if (orderBy && orderBy.length > 0) {
    sql += `\n ORDER BY ${orderBy.map(o => `${o.field} ${o.direction.toUpperCase()}`).join(', ')}`;
  } else if (groupBy && groupBy.length > 0) {
    sql += `\n ORDER BY ${groupBy[0]} ASC`;
  }

  // LIMIT clause
  if (limit) {
    sql += `\n LIMIT ${limit}`;
  }

  return sql;
}

/** Generate a stable "last refreshed" timestamp based on widget id hash */
function getLastRefreshed(widgetId: string): Date {
  let hash = 0;
  for (let i = 0; i < widgetId.length; i++) {
    hash = ((hash << 5) - hash) + widgetId.charCodeAt(i);
    hash |= 0;
  }
  const minutesAgo = Math.abs(hash % 180); // 0-180 minutes ago
  return new Date(Date.now() - minutesAgo * 60 * 1000);
}

function getFreshnessColor(date: Date): string {
  const hoursAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 1) return 'text-accent-green';
  if (hoursAgo < 6) return 'text-accent-amber';
  return 'text-accent-red';
}

function formatTimeAgo(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function WidgetQueryPanel({ widget, onClose }: WidgetQueryPanelProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);
  const [showGlossary, setShowGlossary] = useState(false);

  const sql = useMemo(() => generateSQL(widget), [widget]);
  const lastRefreshed = useMemo(() => getLastRefreshed(widget.id), [widget.id]);

  const dataResult = useMemo(() => {
    try {
      return queryDataSync(widget.dataConfig.source || '', widget.dataConfig.groupBy);
    } catch {
      return { data: [], columns: [] };
    }
  }, [widget.dataConfig.source, widget.dataConfig.groupBy]);

  const { data, columns } = dataResult;
  const previewRows = data.slice(0, 10);

  // Fetch glossary terms if widget references them
  useEffect(() => {
    const fetchGlossaryTerms = async () => {
      if (!widget.glossaryTermIds || widget.glossaryTermIds.length === 0) {
        setGlossaryTerms([]);
        return;
      }

      try {
        const promises = widget.glossaryTermIds.map(async (termId) => {
          const response = await fetch(`/api/glossary/${termId}`);
          if (response.ok) {
            return await response.json();
          }
          return null;
        });

        const results = await Promise.all(promises);
        const validTerms = results.filter(Boolean);
        setGlossaryTerms(validTerms);
      } catch (error) {
        console.error('Failed to fetch glossary terms:', error);
        setGlossaryTerms([]);
      }
    };

    fetchGlossaryTerms();
  }, [widget.glossaryTermIds]);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyTSV = () => {
    if (data.length === 0) return;
    const cols = Object.keys(data[0]);
    const header = cols.join('\t');
    const rows = data.map(row => cols.map(c => String(row[c] ?? '')).join('\t'));
    navigator.clipboard.writeText([header, ...rows].join('\n'));
  };

  const handleExportJSON = () => {
    if (data.length === 0) return;
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${widget.title.replace(/[^a-zA-Z0-9]/g, '_')}_data.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenInEditor = () => {
    // Future: Navigate to SQL Editor with pre-loaded query
    // For now, show a helpful message
    alert(`SQL Editor integration coming soon!\n\nQuery:\n${sql}`);
  };

  const handleOpenInPlayground = () => {
    // Create a temporary session data to pass to playground
    const playgroundData = {
      fromWidget: {
        widgetId: widget.id,
        widgetTitle: widget.title,
        sql: sql,
        dataSource: widget.dataConfig.source,
        timestamp: new Date().toISOString()
      }
    };

    // Store in sessionStorage for pickup by playground
    sessionStorage.setItem('playground_import_data', JSON.stringify(playgroundData));

    // Navigate to playground
    router.push('/data/playground?import=widget');
  };

  const freshnessColor = getFreshnessColor(lastRefreshed);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div className="fixed right-0 top-0 h-full w-[420px] max-w-[90vw] bg-[var(--bg-primary)] border-l border-[var(--border-color)] shadow-2xl shadow-black/30 z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-card)]/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-accent-cyan/10">
              <Code2 size={16} className="text-accent-cyan" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{widget.title}</h2>
              <p className="text-[10px] text-[var(--text-muted)]">Query & Data Transparency</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <X size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Data Source + Freshness */}
          <div className="px-5 py-4 border-b border-[var(--border-color)]">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Database size={12} className="text-accent-blue" />
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Data Source</span>
                </div>
                <p className="text-sm font-mono text-accent-cyan">{widget.dataConfig.source || 'N/A'}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  {data.length} rows × {columns.length} columns • Widget type: {widget.type.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end mb-1">
                  <Clock size={10} className={freshnessColor} />
                  <span className={`text-[10px] font-medium ${freshnessColor}`}>
                    {formatTimeAgo(lastRefreshed)}
                  </span>
                </div>
                <p className="text-[9px] text-[var(--text-muted)]">Last refreshed</p>
              </div>
            </div>
          </div>

          {/* SQL Query */}
          <div className="px-5 py-4 border-b border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Code2 size={12} className="text-accent-purple" />
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">SQL Query</span>
              </div>
              <button
                onClick={handleCopySQL}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[var(--text-muted)] hover:text-accent-cyan hover:bg-accent-cyan/10 transition-colors"
              >
                {copied ? (
                  <><Check size={10} className="text-accent-green" /> Copied!</>
                ) : (
                  <><Copy size={10} /> Copy Query</>
                )}
              </button>
            </div>
            <div className="relative rounded-lg bg-[var(--bg-hover)] border border-[var(--border-color)] overflow-hidden">
              <pre className="p-3 text-xs font-mono text-[var(--text-primary)] overflow-x-auto whitespace-pre leading-relaxed">
                {sql.split('\n').map((line, i) => (
                  <span key={i}>
                    {line.split(/(\b(?:SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|AND|OR|AS|ON|JOIN|LEFT|RIGHT|INNER|BETWEEN|IS NOT NULL|ASC|DESC|SUM|AVG|COUNT|MIN|MAX|COUNT_DISTINCT|MEDIAN)\b)/gi).map((part, j) => {
                      if (/^(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|AND|OR|AS|ON|JOIN|LEFT|RIGHT|INNER|BETWEEN|IS NOT NULL|ASC|DESC)$/i.test(part)) {
                        return <span key={j} className="text-accent-blue font-semibold">{part}</span>;
                      }
                      if (/^(SUM|AVG|COUNT|MIN|MAX|COUNT_DISTINCT|MEDIAN)$/i.test(part)) {
                        return <span key={j} className="text-accent-purple">{part}</span>;
                      }
                      return <span key={j}>{part}</span>;
                    })}
                    {i < sql.split('\n').length - 1 ? '\n' : ''}
                  </span>
                ))}
              </pre>
            </div>
            {widget.dataConfig.aggregation && (
              <p className="text-[9px] text-[var(--text-muted)] mt-2">
                Aggregation: <span className="font-mono text-accent-purple">{widget.dataConfig.aggregation.function}({widget.dataConfig.aggregation.field})</span>
                {widget.dataConfig.groupBy?.length ? <> grouped by <span className="font-mono text-accent-cyan">{widget.dataConfig.groupBy.join(', ')}</span></> : null}
              </p>
            )}
          </div>

          {/* Query Actions */}
          <div className="px-5 py-4 border-b border-[var(--border-color)]">
            <div className="flex flex-wrap gap-2">
              {/* SQL Editor and Playground buttons deferred — uncomment when data tools are re-enabled */}
              <Tooltip content="Export data as JSON">
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-accent-green hover:bg-accent-green/10 transition-colors border border-[var(--border-color)] hover:border-accent-green/20"
                  disabled={data.length === 0}
                >
                <Download size={12} />
                  Export JSON
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Glossary Terms */}
          {glossaryTerms.length > 0 && (
            <div className="px-5 py-4 border-b border-[var(--border-color)]">
              <button
                onClick={() => setShowGlossary(!showGlossary)}
                className="flex items-center justify-between w-full mb-3"
              >
                <div className="flex items-center gap-2">
                  <BookOpen size={12} className="text-accent-green" />
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Glossary Terms ({glossaryTerms.length})
                  </span>
                </div>
                {showGlossary ? <ChevronUp size={12} className="text-[var(--text-muted)]" /> : <ChevronDown size={12} className="text-[var(--text-muted)]" />}
              </button>

              {showGlossary && (
                <div className="space-y-3">
                  {glossaryTerms.map(term => (
                    <div key={term.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">{term.term}</h4>
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded text-[9px] font-medium text-accent-green bg-accent-green/10">
                            {term.category}
                          </span>
                          {term.dataSource && (
                            <Tooltip content={`View in glossary: ${term.dataSource}`}>
                              <button
                                className="p-1 rounded hover:bg-[var(--bg-card-hover)] transition-colors"
                              >
                                <ExternalLink size={10} className="text-[var(--text-muted)]" />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mb-2">
                        {term.definition}
                      </p>
                      {term.formula && (
                        <div className="mt-2 p-2 rounded bg-[var(--bg-hover)] border border-[var(--border-color)]">
                          <p className="text-[10px] text-[var(--text-muted)] mb-1">FORMULA</p>
                          <code className="text-xs font-mono text-accent-purple">{term.formula}</code>
                        </div>
                      )}
                      {term.examples && (
                        <div className="mt-2">
                          <p className="text-[10px] text-[var(--text-muted)] mb-1">EXAMPLES</p>
                          <p className="text-xs text-[var(--text-secondary)]">{term.examples}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Raw Data Preview */}
          <div className="px-5 py-4">
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="flex items-center justify-between w-full mb-3"
            >
              <div className="flex items-center gap-2">
                <Table2 size={12} className="text-accent-amber" />
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Raw Data ({data.length} rows)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip content="Copy data as TSV (paste into Excel/Sheets)">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyTSV(); }}
                    className="text-[9px] text-[var(--text-muted)] hover:text-accent-cyan transition-colors"
                  >
                    Copy TSV
                  </button>
                </Tooltip>
                {showRawData ? <ChevronUp size={12} className="text-[var(--text-muted)]" /> : <ChevronDown size={12} className="text-[var(--text-muted)]" />}
              </div>
            </button>

            {showRawData && previewRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-[var(--bg-card)]">
                      {columns.map(col => (
                        <th key={col} className="px-2 py-1.5 text-left font-semibold text-[var(--text-secondary)] border-b border-[var(--border-color)] whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-card-hover)] transition-colors">
                        {columns.map(col => (
                          <td key={col} className="px-2 py-1 text-[var(--text-primary)] font-mono whitespace-nowrap">
                            {typeof row[col] === 'number'
                              ? (row[col] as number).toLocaleString(undefined, { maximumFractionDigits: 2 })
                              : String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length > 10 && (
                  <div className="px-2 py-1.5 text-[9px] text-[var(--text-muted)] bg-[var(--bg-card)] border-t border-[var(--border-color)]">
                    Showing 10 of {data.length} rows
                  </div>
                )}
              </div>
            )}

            {showRawData && previewRows.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] italic">No data available</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-color)] bg-[var(--bg-card)]/50">
          <p className="text-[9px] text-[var(--text-muted)]">
            Query generated from widget configuration. In production, this would reflect the actual Snowflake/database query.
          </p>
        </div>
      </div>
    </>
  );
}

export { generateSQL, getLastRefreshed, getFreshnessColor, formatTimeAgo };
