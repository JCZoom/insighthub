'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Library, Plus, X, BarChart3, PieChart, Table2, Gauge, Type, LayoutGrid } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useViewport } from '@/hooks/useViewport';
import { cn } from '@/lib/utils';
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

const TYPE_COLORS: Record<string, string> = {
  kpi_card: 'text-accent-amber',
  line_chart: 'text-accent-blue',
  bar_chart: 'text-accent-blue',
  area_chart: 'text-accent-cyan',
  pie_chart: 'text-accent-purple',
  donut_chart: 'text-accent-purple',
  table: 'text-accent-green',
  text_block: 'text-[var(--text-muted)]',
};

interface WidgetLibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WidgetLibraryPanel({ isOpen, onClose }: WidgetLibraryPanelProps) {
  const [widgets, setWidgets] = useState<WidgetTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { schema, addWidget } = useDashboardStore();
  const viewport = useViewport();

  const fetchWidgets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (filterType) params.set('type', filterType);
      params.set('limit', '30');

      const res = await fetch(`/api/widgets?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setWidgets(data.widgets);
    } catch {
      setWidgets([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, filterType]);

  useEffect(() => {
    if (isOpen) fetchWidgets();
  }, [isOpen, fetchWidgets]);

  const handleAddWidget = async (template: WidgetTemplate) => {
    try {
      const maxY = schema.widgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0);

      const res = await fetch('/api/widgets/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetTemplateId: template.id,
          positionOverride: { y: maxY },
        }),
      });

      if (!res.ok) throw new Error('Fork failed');
      const data = await res.json();
      addWidget(data.widget);
    } catch (error) {
      console.error('Failed to add widget:', error);
    }
  };

  if (!isOpen) return null;

  const typeFilters = [
    { type: null, label: 'All' },
    { type: 'kpi_card', label: 'KPI' },
    { type: 'bar_chart', label: 'Bar' },
    { type: 'line_chart', label: 'Line' },
    { type: 'area_chart', label: 'Area' },
    { type: 'pie_chart', label: 'Pie' },
    { type: 'donut_chart', label: 'Donut' },
    { type: 'table', label: 'Table' },
  ];

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Library size={16} className="text-accent-purple" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Widget Library</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
        >
          <X size={16} className="text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--border-color)]">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search widgets..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent-blue/50 transition-colors"
          />
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-1 mt-2">
          {typeFilters.map(f => (
            <button
              key={f.type || 'all'}
              onClick={() => setFilterType(f.type)}
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                filterType === f.type
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Widget list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-[var(--text-muted)] text-xs">Loading...</div>
        ) : widgets.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)] text-xs">
            {search ? 'No widgets match your search.' : 'No widgets available.'}
          </div>
        ) : (
          widgets.map(w => {
            const Icon = TYPE_ICONS[w.type] || LayoutGrid;
            const iconColor = TYPE_COLORS[w.type] || 'text-[var(--text-muted)]';

            return (
              <div
                key={w.id}
                className="group bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-3 hover:border-accent-blue/30 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className={cn('mt-0.5 shrink-0', iconColor)}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {w.title}
                      </h4>
                      <button
                        onClick={() => handleAddWidget(w)}
                        title="Add to dashboard"
                        className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-all"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] line-clamp-1 mt-0.5">
                      {w.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] text-[var(--text-muted)]">
                        from {w.sourceDashboardTitle}
                      </span>
                      <span className="text-[9px] text-[var(--text-muted)]">
                        {w.usageCount} uses
                      </span>
                    </div>
                    {w.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {w.tags.slice(0, 4).map(tag => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--bg-card-hover)] text-[var(--text-muted)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[var(--border-color)]">
        <p className="text-[10px] text-[var(--text-muted)] text-center">
          {widgets.length} widget{widgets.length !== 1 ? 's' : ''} available — click + to add
        </p>
      </div>
    </>
  );

  if (viewport.isLibraryModal) {
    // Modal layout for tablet/mobile
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
        />

        {/* Modal Sheet */}
        <div className="fixed inset-x-4 top-20 bottom-20 max-w-lg mx-auto z-50 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-xl flex flex-col">
          {content}
        </div>
      </>
    );
  } else {
    // Side panel layout for desktop
    return (
      <div className="w-[320px] border-l border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur-xl flex flex-col h-full">
        {content}
      </div>
    );
  }
}
