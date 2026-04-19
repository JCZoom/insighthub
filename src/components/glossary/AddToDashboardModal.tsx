'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Search, BarChart3, PieChart, Table2, Gauge, Type, LayoutGrid, ChevronRight, FolderOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloneWidgetFromLibrary } from '@/lib/data/widget-library';
import type { WidgetTemplate } from '@/lib/data/widget-library';

const TYPE_ICONS: Record<string, typeof BarChart3> = {
  kpi_card: Gauge,
  line_chart: BarChart3,
  bar_chart: BarChart3,
  area_chart: BarChart3,
  pie_chart: PieChart,
  donut_chart: PieChart,
  table: Table2,
  text_block: Type,
};

interface Dashboard {
  id: string;
  title: string;
  description: string | null;
  owner: {
    name: string;
    email: string;
  };
  folder?: {
    name: string;
  };
  updatedAt: string;
}

interface AddToDashboardModalProps {
  widget: WidgetTemplate;
  onClose: () => void;
}

export function AddToDashboardModal({ widget, onClose }: AddToDashboardModalProps) {
  const [mode, setMode] = useState<'choose' | 'new' | 'existing'>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Dashboard[]>([]);
  const [searching, setSearching] = useState(false);
  const [newDashboardTitle, setNewDashboardTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const Icon = TYPE_ICONS[widget.type] || LayoutGrid;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Debounced dashboard search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim() || mode !== 'existing') {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dashboards?q=${encodeURIComponent(searchQuery.trim())}&limit=10`);
        if (res.ok) {
          const { dashboards } = await res.json();
          setSearchResults(dashboards || []);
        }
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, mode]);

  const createNewDashboard = async () => {
    if (!newDashboardTitle.trim()) return;

    setCreating(true);
    try {
      // Clone the widget with a position that won't overlap
      const widgetConfig = cloneWidgetFromLibrary(widget, { x: 0, y: 0 });

      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newDashboardTitle.trim(),
          description: `Dashboard created from glossary term with ${widget.title} widget`,
          schema: {
            layout: { columns: 12, rowHeight: 80, gap: 16 },
            globalFilters: [],
            widgets: [widgetConfig],
          },
        }),
      });

      if (res.ok) {
        const { dashboard } = await res.json();
        // Redirect to the new dashboard
        window.location.href = `/dashboard/${dashboard.id}`;
      } else {
        throw new Error('Failed to create dashboard');
      }
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      alert('Failed to create dashboard. Please try again.');
    }
    setCreating(false);
  };

  const addToExistingDashboard = async (dashboardId: string) => {
    setAdding(true);
    try {
      // First, get the current dashboard to find next available position
      const dashboardRes = await fetch(`/api/dashboards/${dashboardId}`);
      if (!dashboardRes.ok) throw new Error('Failed to fetch dashboard');

      const { dashboard } = await dashboardRes.json();
      const currentSchema = JSON.parse(dashboard.versions[0].schema);

      // Find next available position
      const existingWidgets = currentSchema.widgets || [];
      const maxY = existingWidgets.reduce((max: number, w: any) => Math.max(max, w.position.y + w.position.h), 0);

      // Clone the widget with the next available position
      const widgetConfig = cloneWidgetFromLibrary(widget, { x: 0, y: maxY });

      // Add widget to the dashboard
      const updatedSchema = {
        ...currentSchema,
        widgets: [...existingWidgets, widgetConfig],
      };

      const updateRes = await fetch(`/api/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: updatedSchema,
          changeNote: `Added ${widget.title} widget from glossary`,
        }),
      });

      if (updateRes.ok) {
        // Redirect to the dashboard
        window.location.href = `/dashboard/${dashboardId}`;
      } else {
        throw new Error('Failed to update dashboard');
      }
    } catch (error) {
      console.error('Failed to add widget to dashboard:', error);
      alert('Failed to add widget to dashboard. Please try again.');
    }
    setAdding(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl shadow-black/20 fade-in max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <Icon size={16} className="text-accent-purple" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Add to Dashboard</h2>
              <p className="text-xs text-[var(--text-secondary)]">{widget.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {mode === 'choose' && (
            <>
              <p className="text-sm text-[var(--text-secondary)]">
                Where would you like to add this widget?
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => setMode('new')}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:border-accent-purple/30 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                    <Plus size={16} className="text-accent-purple" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Create New Dashboard</h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Start a fresh dashboard with this widget
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-muted)]" />
                </button>

                <button
                  onClick={() => setMode('existing')}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:border-accent-purple/30 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                    <FolderOpen size={16} className="text-accent-blue" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add to Existing Dashboard</h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Search your dashboards and add this widget
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-muted)]" />
                </button>
              </div>
            </>
          )}

          {mode === 'new' && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode('choose')}
                  className="text-xs text-accent-blue hover:underline"
                >
                  ← Back
                </button>
              </div>

              <div>
                <label className="text-sm font-semibold text-[var(--text-primary)] block mb-2">
                  Dashboard Name
                </label>
                <input
                  type="text"
                  value={newDashboardTitle}
                  onChange={e => setNewDashboardTitle(e.target.value)}
                  placeholder={`${widget.title} Dashboard`}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent-purple/50 transition-colors"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newDashboardTitle.trim()) {
                      createNewDashboard();
                    }
                  }}
                />
              </div>

              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Preview</h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  A new dashboard will be created with "{widget.title}" as the first widget.
                  You can add more widgets and customize the layout after creation.
                </p>
              </div>
            </>
          )}

          {mode === 'existing' && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode('choose')}
                  className="text-xs text-accent-blue hover:underline"
                >
                  ← Back
                </button>
              </div>

              <div>
                <label className="text-sm font-semibold text-[var(--text-primary)] block mb-2">
                  Search Dashboards
                </label>
                <div className="relative">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]">
                    <Search size={14} className="text-[var(--text-muted)] shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search by dashboard name..."
                      className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                    />
                    {searching && (
                      <Loader2 size={14} className="animate-spin text-accent-blue" />
                    )}
                  </div>

                  {/* Search results */}
                  {searchQuery.trim() && (
                    <div className="mt-2 max-h-60 overflow-y-auto">
                      {searchResults.length > 0 ? (
                        <div className="space-y-1">
                          {searchResults.map(dashboard => (
                            <button
                              key={dashboard.id}
                              onClick={() => addToExistingDashboard(dashboard.id)}
                              disabled={adding}
                              className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:border-accent-purple/30 transition-colors text-left disabled:opacity-50"
                            >
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-[var(--text-primary)] truncate">
                                  {dashboard.title}
                                </h4>
                                <p className="text-xs text-[var(--text-secondary)] truncate">
                                  {dashboard.folder ? `${dashboard.folder.name} • ` : ''}
                                  by {dashboard.owner.name}
                                </p>
                              </div>
                              {adding ? (
                                <Loader2 size={14} className="animate-spin text-accent-blue" />
                              ) : (
                                <Plus size={14} className="text-accent-purple" />
                              )}
                            </button>
                          ))}
                        </div>
                      ) : !searching ? (
                        <div className="p-4 text-center">
                          <p className="text-sm text-[var(--text-muted)]">No dashboards found</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between shrink-0">
          <div className="text-xs text-[var(--text-muted)]">
            {mode === 'new' && 'Widget will be added at the top of the new dashboard'}
            {mode === 'existing' && 'Widget will be added at the bottom of the selected dashboard'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              Cancel
            </button>
            {mode === 'new' && (
              <button
                onClick={createNewDashboard}
                disabled={!newDashboardTitle.trim() || creating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-purple/10 text-accent-purple text-xs font-medium hover:bg-accent-purple/20 transition-colors disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={12} />
                    Create Dashboard
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}