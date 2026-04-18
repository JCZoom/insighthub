'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { Clock, RotateCcw, CheckCircle2, CloudDownload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

interface SavedVersion {
  id: string;
  version: number;
  changeNote: string | null;
  createdAt: string;
  createdBy: string;
}

export function VersionTimeline() {
  const { dashboardId, history, historyIndex, initialize, schema, title } = useDashboardStore();
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
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
                title={`Revert to v${v.version}`}
              >
                {reverting === v.id ? (
                  <Loader2 size={11} className="animate-spin shrink-0" />
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
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded text-xs cursor-default',
                  i === historyIndex
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                )}
              >
                {i === historyIndex ? (
                  <CheckCircle2 size={11} />
                ) : (
                  <RotateCcw size={11} className="opacity-40" />
                )}
                <span className="flex-1 truncate">{entry.note}</span>
                <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                  v{i + 1}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
