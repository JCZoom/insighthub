'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { Clock, RotateCcw, CheckCircle2, CloudDownload, Loader2, Bookmark, GitCompare, Plus, Minus, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import { useToast } from '@/components/ui/toast';
import type { DashboardSchema, WidgetConfig } from '@/types';

interface SavedVersion {
  id: string;
  version: number;
  changeNote: string | null;
  createdAt: string;
  createdBy: string;
}

// ── Schema Diff Engine ──────────────────────────────────────────────────────

interface WidgetDiff {
  type: 'added' | 'removed' | 'modified';
  widget: WidgetConfig;
  changes?: string[];
}

function diffSchemas(before: DashboardSchema, after: DashboardSchema): WidgetDiff[] {
  const diffs: WidgetDiff[] = [];
  const beforeMap = new Map(before.widgets.map(w => [w.id, w]));
  const afterMap = new Map(after.widgets.map(w => [w.id, w]));

  // Added widgets
  for (const [wid, widget] of afterMap) {
    if (!beforeMap.has(wid)) {
      diffs.push({ type: 'added', widget });
    }
  }

  // Removed widgets
  for (const [wid, widget] of beforeMap) {
    if (!afterMap.has(wid)) {
      diffs.push({ type: 'removed', widget });
    }
  }

  // Modified widgets
  for (const [wid, afterWidget] of afterMap) {
    const beforeWidget = beforeMap.get(wid);
    if (!beforeWidget) continue;
    const changes: string[] = [];
    if (beforeWidget.title !== afterWidget.title) changes.push('title');
    if (beforeWidget.type !== afterWidget.type) changes.push('type');
    if (JSON.stringify(beforeWidget.position) !== JSON.stringify(afterWidget.position)) changes.push('position');
    if (JSON.stringify(beforeWidget.dataConfig) !== JSON.stringify(afterWidget.dataConfig)) changes.push('data');
    if (JSON.stringify(beforeWidget.visualConfig) !== JSON.stringify(afterWidget.visualConfig)) changes.push('style');
    if (changes.length > 0) {
      diffs.push({ type: 'modified', widget: afterWidget, changes });
    }
  }

  return diffs;
}

// ── Diff Overlay Modal ──────────────────────────────────────────────────────

function DiffOverlay({ diffs, fromLabel, toLabel, onClose }: {
  diffs: WidgetDiff[];
  fromLabel: string;
  toLabel: string;
  onClose: () => void;
}) {
  const added = diffs.filter(d => d.type === 'added');
  const removed = diffs.filter(d => d.type === 'removed');
  const modified = diffs.filter(d => d.type === 'modified');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl shadow-black/20 overflow-hidden fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <GitCompare size={16} className="text-accent-purple" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Version Diff</h3>
              <p className="text-[10px] text-[var(--text-muted)]">{fromLabel} → {toLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors">
            <X size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
          {diffs.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">No changes between these versions.</p>
          )}

          {/* Summary badges */}
          {diffs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {added.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-accent-green/10 text-accent-green">
                  <Plus size={10} /> {added.length} added
                </span>
              )}
              {removed.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-accent-red/10 text-accent-red">
                  <Minus size={10} /> {removed.length} removed
                </span>
              )}
              {modified.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-accent-amber/10 text-accent-amber">
                  <Pencil size={10} /> {modified.length} modified
                </span>
              )}
            </div>
          )}

          {/* Added widgets */}
          {added.map(d => (
            <div key={d.widget.id} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-accent-green/20 bg-accent-green/5">
              <Plus size={14} className="text-accent-green mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-[var(--text-primary)]">{d.widget.title}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{d.widget.type.replace(/_/g, ' ')} widget added</p>
              </div>
            </div>
          ))}

          {/* Removed widgets */}
          {removed.map(d => (
            <div key={d.widget.id} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-accent-red/20 bg-accent-red/5">
              <Minus size={14} className="text-accent-red mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-[var(--text-primary)] line-through">{d.widget.title}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{d.widget.type.replace(/_/g, ' ')} widget removed</p>
              </div>
            </div>
          ))}

          {/* Modified widgets */}
          {modified.map(d => (
            <div key={d.widget.id} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5">
              <Pencil size={14} className="text-accent-amber mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-[var(--text-primary)]">{d.widget.title}</p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Changed: {d.changes?.join(', ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function VersionTimeline() {
  const { dashboardId, history, historyIndex, schema, initialize, jumpToHistory, title } = useDashboardStore();
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [checkpointName, setCheckpointName] = useState('');
  const [showCheckpointInput, setShowCheckpointInput] = useState(false);
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);
  const [diffState, setDiffState] = useState<{ diffs: WidgetDiff[]; fromLabel: string; toLabel: string } | null>(null);
  const { toast } = useToast();

  // Fetch saved versions from API
  const fetchVersions = useCallback(async () => {
    if (!dashboardId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setSavedVersions(data.versions || []);
      }
    } catch {
      // Silently fail — local history is always available
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  // Save named checkpoint
  const saveCheckpoint = async () => {
    if (!dashboardId || !checkpointName.trim()) return;
    setSavingCheckpoint(true);
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema, changeNote: checkpointName.trim() }),
      });
      if (res.ok) {
        toast({ type: 'success', title: `Checkpoint saved: "${checkpointName.trim()}"` });
        setCheckpointName('');
        setShowCheckpointInput(false);
        fetchVersions();
      } else {
        toast({ type: 'error', title: 'Failed to save checkpoint' });
      }
    } catch {
      toast({ type: 'error', title: 'Failed to save checkpoint', description: 'Network error' });
    } finally {
      setSavingCheckpoint(false);
    }
  };

  // Show diff between current schema and a history entry
  const showLocalDiff = (targetIndex: number) => {
    if (targetIndex === historyIndex) return;
    const from = history[targetIndex].schema;
    const to = history[historyIndex].schema;
    const diffs = diffSchemas(from, to);
    setDiffState({
      diffs,
      fromLabel: `v${targetIndex + 1} "${history[targetIndex].note}"`,
      toLabel: `v${historyIndex + 1} (current)`,
    });
  };

  const handleRevert = async (version: SavedVersion) => {
    if (!dashboardId) return;
    setReverting(version.id);
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}/revert/${version.id}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.schema) {
          initialize(dashboardId, title, data.schema);
          toast({ type: 'success', title: `Reverted to v${version.version}` });
          fetchVersions();
        }
      } else {
        toast({ type: 'error', title: 'Revert failed' });
      }
    } catch {
      toast({ type: 'error', title: 'Revert failed', description: 'Network error' });
    } finally {
      setReverting(null);
    }
  };

  const hasLocalHistory = history.length > 1;
  const hasSavedVersions = savedVersions.length > 0;

  if (!hasLocalHistory && !hasSavedVersions) return null;

  return (
    <div className="p-3 border-t border-[var(--border-color)]">
      {/* Named Checkpoint */}
      <div className="mb-3">
        {showCheckpointInput ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={checkpointName}
              onChange={(e) => setCheckpointName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveCheckpoint();
                if (e.key === 'Escape') { setShowCheckpointInput(false); setCheckpointName(''); }
              }}
              placeholder="e.g. Before Q4 changes"
              className="flex-1 min-w-0 px-2 py-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
              autoFocus
              disabled={savingCheckpoint}
            />
            <button
              onClick={saveCheckpoint}
              disabled={savingCheckpoint || !checkpointName.trim()}
              className="px-2 py-1 rounded-md bg-accent-blue/10 text-accent-blue text-[10px] font-medium hover:bg-accent-blue/20 transition-colors disabled:opacity-40"
            >
              {savingCheckpoint ? <Loader2 size={10} className="animate-spin" /> : 'Save'}
            </button>
            <button
              onClick={() => { setShowCheckpointInput(false); setCheckpointName(''); }}
              className="p-1 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <X size={12} className="text-[var(--text-muted)]" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCheckpointInput(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-accent-blue hover:bg-accent-blue/5 border border-dashed border-[var(--border-color)] hover:border-accent-blue/30 transition-colors"
          >
            <Bookmark size={11} />
            Save named checkpoint
          </button>
        )}
      </div>

      {/* Saved versions (from DB) */}
      {hasSavedVersions && (
        <>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CloudDownload size={12} />
            Saved Versions ({savedVersions.length})
            {loading && <Loader2 size={10} className="animate-spin" />}
          </h4>
          <div className="space-y-1 max-h-28 overflow-y-auto mb-3">
            {savedVersions.map((v) => (
              <button
                key={v.id}
                onClick={() => handleRevert(v)}
                disabled={reverting === v.id}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors',
                  'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]',
                  reverting === v.id && 'opacity-50'
                )}
              >
                {reverting === v.id ? (
                  <Loader2 size={11} className="animate-spin shrink-0" />
                ) : v.changeNote ? (
                  <Bookmark size={11} className="text-accent-amber shrink-0" />
                ) : (
                  <RotateCcw size={11} className="opacity-40 shrink-0" />
                )}
                <span className="flex-1 truncate">{v.changeNote || `Version ${v.version}`}</span>
                <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                  v{v.version}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Local undo history */}
      {hasLocalHistory && (
        <>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock size={12} />
            Session History ({history.length})
          </h4>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {history.map((entry, i) => (
              <div key={i} className="flex items-center gap-0.5">
                <button
                  onClick={() => { if (i !== historyIndex) jumpToHistory(i); }}
                  className={cn(
                    'flex-1 flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors min-w-0',
                    i === historyIndex
                      ? 'bg-accent-blue/10 text-accent-blue cursor-default'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] cursor-pointer'
                  )}
                >
                  {i === historyIndex ? (
                    <CheckCircle2 size={11} className="shrink-0" />
                  ) : (
                    <RotateCcw size={11} className="opacity-40 shrink-0" />
                  )}
                  <span className="flex-1 truncate">{entry.note}</span>
                  <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                    v{i + 1}
                  </span>
                </button>
                {i !== historyIndex && (
                  <Tooltip content={`Compare v${i + 1} with current`}>
                    <button
                      onClick={() => showLocalDiff(i)}
                      className="p-1 rounded hover:bg-accent-purple/10 transition-colors shrink-0"
                    >
                      <GitCompare size={10} className="text-accent-purple/60 hover:text-accent-purple" />
                    </button>
                  </Tooltip>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Diff overlay */}
      {diffState && (
        <DiffOverlay
          diffs={diffState.diffs}
          fromLabel={diffState.fromLabel}
          toLabel={diffState.toLabel}
          onClose={() => setDiffState(null)}
        />
      )}
    </div>
  );
}
