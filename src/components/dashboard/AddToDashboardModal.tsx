'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, LayoutDashboard, Loader2, Check, Plus, ArrowRight } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { cn } from '@/lib/utils';
import type { WidgetConfig } from '@/types';

interface DashboardOption {
  id: string;
  title: string;
  ownerName: string;
  widgetCount: number;
  updatedAt: string;
}

interface AddToDashboardModalProps {
  widget: WidgetConfig;
  onClose: () => void;
  onSuccess?: (targetDashboardId: string, targetTitle: string) => void;
}

export function AddToDashboardModal({ widget, onClose, onSuccess }: AddToDashboardModalProps) {
  const { dashboardId: currentDashboardId } = useDashboardStore();
  const [dashboards, setDashboards] = useState<DashboardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's dashboards on mount
  useEffect(() => {
    async function fetchDashboards() {
      try {
        const res = await fetch('/api/dashboards?limit=100');
        if (!res.ok) throw new Error('Failed to load dashboards');
        const { dashboards: list } = await res.json();
        const mapped: DashboardOption[] = (list || [])
          .filter((d: { id: string }) => d.id !== currentDashboardId)
          .map((d: { id: string; title: string; owner?: { name?: string }; updatedAt: string; _count?: { versions?: number } }) => ({
            id: d.id,
            title: d.title,
            ownerName: d.owner?.name || 'You',
            widgetCount: d._count?.versions || 0,
            updatedAt: d.updatedAt,
          }));
        setDashboards(mapped);
      } catch {
        setError('Could not load your dashboards.');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboards();
  }, [currentDashboardId]);

  const filtered = dashboards.filter(d => {
    if (!search) return true;
    return d.title.toLowerCase().includes(search.toLowerCase());
  });

  const handleAdd = useCallback(async (targetId: string) => {
    setSending(targetId);
    setError(null);
    try {
      const res = await fetch(`/api/dashboards/${targetId}/add-widget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widget,
          sourceDashboardId: currentDashboardId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add widget');
      }
      setSuccessId(targetId);
      const target = dashboards.find(d => d.id === targetId);
      onSuccess?.(targetId, target?.title || 'dashboard');
      // Auto-close after brief success display
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(null);
    }
  }, [widget, currentDashboardId, dashboards, onSuccess, onClose]);

  const handleCreateNew = useCallback(async () => {
    setSending('__new__');
    setError(null);
    try {
      // Create a new dashboard with this widget pre-loaded
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Dashboard with ${widget.title}`,
          schema: {
            layout: { columns: 12, rowHeight: 80, gap: 16 },
            globalFilters: [],
            widgets: [{
              ...widget,
              id: `widget-${widget.type}-${Math.random().toString(36).slice(2, 8)}`,
              position: { ...widget.position, x: 0, y: 0 },
            }],
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to create dashboard');
      const { dashboard } = await res.json();
      setSuccessId('__new__');
      onSuccess?.(dashboard.id, dashboard.title);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(null);
    }
  }, [widget, onSuccess, onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl shadow-black/30 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Copy Widget to Dashboard</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Add &ldquo;{widget.title}&rdquo; to another dashboard
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors">
            <X size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search your dashboards..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent-blue/50 transition-colors"
            />
          </div>
        </div>

        {/* Dashboard list */}
        <div className="px-5 py-3 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-accent-blue" />
              <span className="ml-2 text-sm text-[var(--text-muted)]">Loading dashboards...</span>
            </div>
          ) : filtered.length === 0 && dashboards.length === 0 ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-6">
              No other dashboards found. Create one below.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-6">
              No dashboards match &ldquo;{search}&rdquo;
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map(d => {
                const isSending = sending === d.id;
                const isSuccess = successId === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => !isSending && !isSuccess && handleAdd(d.id)}
                    disabled={!!sending || !!successId}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                      isSuccess
                        ? 'bg-accent-green/10 border border-accent-green/30'
                        : 'hover:bg-[var(--bg-card-hover)] border border-transparent',
                      (!!sending || !!successId) && !isSending && !isSuccess && 'opacity-50',
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      isSuccess ? 'bg-accent-green/20' : 'bg-accent-blue/10',
                    )}>
                      {isSuccess ? (
                        <Check size={14} className="text-accent-green" />
                      ) : isSending ? (
                        <Loader2 size={14} className="animate-spin text-accent-blue" />
                      ) : (
                        <LayoutDashboard size={14} className="text-accent-blue" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{d.title}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{d.ownerName}</p>
                    </div>
                    {!isSending && !isSuccess && (
                      <ArrowRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-accent-red/10 border border-accent-red/20 text-xs text-accent-red">
            {error}
          </div>
        )}

        {/* Footer — Create new dashboard option */}
        <div className="px-5 py-3 border-t border-[var(--border-color)]">
          <button
            onClick={handleCreateNew}
            disabled={!!sending || !!successId}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
              successId === '__new__'
                ? 'bg-accent-green/10 border border-accent-green/30'
                : 'hover:bg-accent-blue/5 border border-dashed border-[var(--border-color)] hover:border-accent-blue/40',
              (!!sending || !!successId) && sending !== '__new__' && successId !== '__new__' && 'opacity-50',
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              successId === '__new__' ? 'bg-accent-green/20' : 'bg-accent-blue/10',
            )}>
              {successId === '__new__' ? (
                <Check size={14} className="text-accent-green" />
              ) : sending === '__new__' ? (
                <Loader2 size={14} className="animate-spin text-accent-blue" />
              ) : (
                <Plus size={14} className="text-accent-blue" />
              )}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-[var(--text-primary)]">Create new dashboard</p>
              <p className="text-xs text-[var(--text-muted)]">Start a new dashboard with this widget</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
