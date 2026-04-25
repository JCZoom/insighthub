'use client';

import React, { useState, useMemo } from 'react';
import {
  Code,
  ShieldCheck,
  Activity,
  Clipboard,
  ClipboardCheck,
  Lock,
  AlertTriangle,
  CheckCircle,
  Info,
  Server,
  Zap,
} from 'lucide-react';
import type {
  QueryAuditReport,
  AppliedPolicyInfo,
  MaskedColumnInfo,
} from '@/types/visual-query';

interface QueryAuditPanelProps {
  audit?: QueryAuditReport;
  /**
   * Fallback SQL to show when the server hasn't returned an audit report yet
   * (for example, before the first execution). Displayed in the "Your Query"
   * tab with a notice explaining this is the client preview only.
   */
  fallbackSql?: string;
  className?: string;
}

type TabId = 'your-query' | 'executed' | 'security' | 'execution';

/**
 * Transparency panel for Visual Query Builder executions. Surfaces:
 *   1. The SQL generated from the user's drag-and-drop config.
 *   2. The SQL the server actually executed (post-RLS).
 *   3. The security policies + masked columns the server applied.
 *   4. Execution metadata (time, cache, data source, row count).
 *
 * Designed to give a data analytics owner everything they need to verify
 * that InsightHub is not leaking data and is running queries they approve of.
 */
export const QueryAuditPanel: React.FC<QueryAuditPanelProps> = ({
  audit,
  fallbackSql,
  className = '',
}) => {
  const [tab, setTab] = useState<TabId>('your-query');

  const hasAudit = Boolean(audit);

  const tabs: { id: TabId; label: string; icon: React.ElementType; badge?: string | number }[] = [
    { id: 'your-query', label: 'Your Query', icon: Code },
    {
      id: 'executed',
      label: 'What Ran',
      icon: Server,
      badge: audit?.wasModified ? 'modified' : undefined,
    },
    {
      id: 'security',
      label: 'Security',
      icon: ShieldCheck,
      badge: audit
        ? (audit.appliedPolicies.length + audit.maskedColumns.length) || undefined
        : undefined,
    },
    { id: 'execution', label: 'Execution', icon: Activity },
  ];

  return (
    <div
      className={`border-t border-[var(--border-color)] bg-[var(--bg-card)]/30 ${className}`}
    >
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b border-[var(--border-color)]">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md transition-colors ${
                isActive
                  ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] border-b-transparent -mb-px'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span
                  className={`ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                    t.id === 'executed' && audit?.wasModified
                      ? 'bg-accent-amber/15 text-accent-amber border border-accent-amber/30'
                      : 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Quick verdict pill */}
        <div className="ml-auto flex items-center gap-2 pb-2">
          {hasAudit && <AuditVerdictPill audit={audit!} />}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4 max-h-80 overflow-y-auto text-sm">
        {!hasAudit ? (
          <EmptyState fallbackSql={fallbackSql} />
        ) : tab === 'your-query' ? (
          <YourQueryTab sql={audit!.userSql} />
        ) : tab === 'executed' ? (
          <ExecutedTab audit={audit!} />
        ) : tab === 'security' ? (
          <SecurityTab audit={audit!} />
        ) : (
          <ExecutionTab audit={audit!} />
        )}
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

function AuditVerdictPill({ audit }: { audit: QueryAuditReport }) {
  // Green = clean (no modifications, no masking). Amber = RLS/masking applied.
  const hasSecurityLayer =
    audit.wasModified ||
    audit.appliedPolicies.length > 0 ||
    audit.maskedColumns.length > 0;

  if (!hasSecurityLayer) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-accent-green/10 text-accent-green border border-accent-green/30">
        <CheckCircle className="w-3 h-3" /> Clean — ran as-is
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/30">
      <ShieldCheck className="w-3 h-3" /> Security applied
    </span>
  );
}

function EmptyState({ fallbackSql }: { fallbackSql?: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 rounded-md bg-[var(--bg-primary)]/40 border border-[var(--border-color)]">
        <Info className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[var(--text-secondary)]">
            Run the query to see the full audit trail — including the SQL that
            actually executes on the server, any RLS policies applied, and
            which columns were masked.
          </p>
          {fallbackSql && (
            <p className="text-xs text-[var(--text-muted)] mt-1">
              The SQL below is a client-side preview only. The server
              regenerates SQL from your visual config when you click Run.
            </p>
          )}
        </div>
      </div>
      {fallbackSql && <SqlBlock sql={fallbackSql} />}
    </div>
  );
}

function YourQueryTab({ sql }: { sql: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p>
          The SQL your drag-and-drop configuration produces — what you
          <em> asked </em> the system to run. Compare with the &quot;What Ran&quot; tab
          to see any server-side modifications.
        </p>
      </div>
      <SqlBlock sql={sql} />
    </div>
  );
}

function ExecutedTab({ audit }: { audit: QueryAuditReport }) {
  if (!audit.wasModified) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 p-3 rounded-md bg-accent-green/5 border border-accent-green/20">
          <CheckCircle className="w-4 h-4 text-accent-green flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[var(--text-primary)]">
              No server modifications
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              The server executed your query as-is. No row-level security
              filters were injected.
            </p>
          </div>
        </div>
        <SqlBlock sql={audit.executedSql} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 rounded-md bg-accent-amber/5 border border-accent-amber/20">
        <AlertTriangle className="w-4 h-4 text-accent-amber flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-[var(--text-primary)]">
            Query modified by row-level security
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            The server injected {audit.appliedPolicies.length} RLS
            {audit.appliedPolicies.length === 1 ? ' policy' : ' policies'} before
            executing. Review the Security tab for details on which policies
            applied and why.
          </p>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
          Your SQL
        </p>
        <SqlBlock sql={audit.userSql} muted />
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5" /> Executed SQL (post-RLS)
        </p>
        <SqlBlock sql={audit.executedSql} />
      </div>
    </div>
  );
}

function SecurityTab({ audit }: { audit: QueryAuditReport }) {
  const { appliedPolicies, maskedColumns, accessLevel, securityContext } = audit;

  return (
    <div className="space-y-4">
      {/* Access level + identity */}
      <div className="grid grid-cols-2 gap-3">
        <InfoCard
          label="Access level"
          value={accessLevel}
          tone={
            accessLevel === 'FULL'
              ? 'green'
              : accessLevel === 'FILTERED'
                ? 'amber'
                : 'red'
          }
          icon={Lock}
        />
        <InfoCard
          label="Role"
          value={securityContext.userRole}
          icon={ShieldCheck}
        />
        {securityContext.department && (
          <InfoCard label="Department" value={securityContext.department} />
        )}
        {securityContext.region && (
          <InfoCard label="Region" value={securityContext.region} />
        )}
        <InfoCard
          label="Financial access"
          value={securityContext.hasFinancialAccess ? 'Granted' : 'Restricted'}
          tone={securityContext.hasFinancialAccess ? 'green' : 'red'}
        />
        <InfoCard
          label="PII access"
          value={securityContext.hasPiiAccess ? 'Granted' : 'Restricted'}
          tone={securityContext.hasPiiAccess ? 'green' : 'red'}
        />
      </div>

      {/* Applied RLS policies */}
      <Section
        title={`Row-level security policies (${appliedPolicies.length})`}
        icon={ShieldCheck}
      >
        {appliedPolicies.length === 0 ? (
          <EmptyNote>No RLS policies applied to this query.</EmptyNote>
        ) : (
          <div className="space-y-2">
            {appliedPolicies.map((p) => (
              <PolicyCard key={p.id} policy={p} />
            ))}
          </div>
        )}
      </Section>

      {/* Masked columns */}
      <Section
        title={`Masked columns (${maskedColumns.length})`}
        icon={Lock}
      >
        {maskedColumns.length === 0 ? (
          <EmptyNote>
            No columns were masked. Either the query touched no sensitive data,
            or your role has full access to all returned columns.
          </EmptyNote>
        ) : (
          <div className="space-y-1.5">
            {maskedColumns.map((m) => (
              <MaskedColumnRow key={m.column} mask={m} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function ExecutionTab({ audit }: { audit: QueryAuditReport }) {
  const sourceTone = audit.dataSource === 'snowflake' ? 'green' : 'amber';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <InfoCard
          label="Data source"
          value={audit.dataSource === 'snowflake' ? 'Snowflake' : 'Sample data'}
          tone={sourceTone}
          icon={Server}
        />
        <InfoCard
          label="Cache"
          value={audit.fromCache ? 'Hit' : 'Miss'}
          tone={audit.fromCache ? 'green' : 'muted'}
          icon={Zap}
        />
        <InfoCard
          label="Execution time"
          value={formatMs(audit.executionTimeMs)}
          icon={Activity}
        />
        <InfoCard label="Rows returned" value={audit.rowCount.toLocaleString()} />
        <InfoCard label="Row limit" value={audit.rowLimit.toLocaleString()} />
        <InfoCard label="Source" value={audit.source} />
      </div>

      {audit.skippedFeatures && audit.skippedFeatures.length > 0 && (
        <div className="border border-accent-amber/30 bg-accent-amber/5 rounded-md p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-accent-amber text-xs font-semibold uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5" />
            Unsupported in sample mode
          </div>
          <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-0.5">
            {audit.skippedFeatures.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-xs text-[var(--text-muted)] border border-[var(--border-color)] rounded-md p-2 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div>
          <p>Executed at {new Date(audit.executedAt).toLocaleString()}</p>
          {audit.dataSource === 'sample' && (
            <p className="mt-1">
              Sample-data mode: the JS evaluator executes WHERE/GROUP BY/
              aggregations/ORDER BY/LIMIT over in-memory rows so results match
              the SQL shown. Connect Snowflake for JOINs, formulas, and
              production RLS.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Primitives
// ───────────────────────────────────────────────────────────────────────────

function SqlBlock({ sql, muted = false }: { sql: string; muted?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  };

  return (
    <div className="relative">
      <pre
        className={`p-3 pr-10 rounded-md text-xs overflow-x-auto border ${
          muted
            ? 'bg-[var(--bg-primary)]/40 border-dashed border-[var(--border-color)] text-[var(--text-secondary)]'
            : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-primary)]'
        }`}
      >
        <code>{sql}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]/50"
        aria-label="Copy SQL"
      >
        {copied ? (
          <ClipboardCheck className="w-3.5 h-3.5 text-accent-green" />
        ) : (
          <Clipboard className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </h4>
      {children}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-[var(--text-muted)] italic p-2 border border-dashed border-[var(--border-color)] rounded-md">
      {children}
    </p>
  );
}

function InfoCard({
  label,
  value,
  tone = 'default',
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'green' | 'amber' | 'red' | 'muted';
  icon?: React.ElementType;
}) {
  const toneClasses = useMemo(() => {
    switch (tone) {
      case 'green':
        return 'bg-accent-green/5 border-accent-green/25 text-accent-green';
      case 'amber':
        return 'bg-accent-amber/5 border-accent-amber/25 text-accent-amber';
      case 'red':
        return 'bg-accent-red/5 border-accent-red/25 text-accent-red';
      case 'muted':
        return 'bg-[var(--bg-primary)]/40 border-[var(--border-color)] text-[var(--text-muted)]';
      default:
        return 'bg-[var(--bg-primary)]/60 border-[var(--border-color)] text-[var(--text-primary)]';
    }
  }, [tone]);

  return (
    <div className={`p-2 rounded-md border ${toneClasses}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-70">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium break-words">{value}</div>
    </div>
  );
}

function PolicyCard({ policy }: { policy: AppliedPolicyInfo }) {
  return (
    <div className="p-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)]/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--text-primary)]">
            {policy.name}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            {policy.description}
          </div>
        </div>
        <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/30">
          P{policy.priority}
        </span>
      </div>
      <pre className="mt-2 p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] overflow-x-auto">
        <code>{policy.resolvedCondition}</code>
      </pre>
    </div>
  );
}

function MaskedColumnRow({ mask }: { mask: MaskedColumnInfo }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-primary)]/50 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <Lock className="w-3 h-3 text-accent-red flex-shrink-0" />
        <code className="font-mono text-[var(--text-primary)] truncate">
          {mask.column}
        </code>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="px-1.5 py-0.5 rounded bg-accent-red/10 text-accent-red border border-accent-red/25 text-[10px] font-medium">
          {mask.sensitivityLevel}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] text-[10px] font-medium">
          {mask.maskingType}
        </span>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ───────────────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export default QueryAuditPanel;
