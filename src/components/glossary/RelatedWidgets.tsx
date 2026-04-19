'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, BarChart3, PieChart, Table2, Gauge, Type, LayoutGrid, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findRelatedWidgets } from '@/lib/widget-matching';
import type { GlossaryEntry } from '@/app/glossary/glossary-client';
import type { WidgetTemplate } from '@/lib/data/widget-library';
import { WidgetPreviewModal } from './WidgetPreviewModal';
import { AddToDashboardModal } from './AddToDashboardModal';

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

interface RelatedWidgetsProps {
  glossaryTerm: GlossaryEntry;
}

interface ScoredWidget extends WidgetTemplate {
  relevanceScore: number;
}

export function RelatedWidgets({ glossaryTerm }: RelatedWidgetsProps) {
  const [widgets, setWidgets] = useState<ScoredWidget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewWidget, setPreviewWidget] = useState<WidgetTemplate | null>(null);
  const [addToDashboardWidget, setAddToDashboardWidget] = useState<WidgetTemplate | null>(null);

  const fetchRelatedWidgets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/widgets?limit=50');
      if (!res.ok) throw new Error('Failed to fetch widgets');

      const data = await res.json();
      const allWidgets: WidgetTemplate[] = data.widgets;

      // Find related widgets using our matching algorithm
      const related = findRelatedWidgets(glossaryTerm, allWidgets, 6);
      setWidgets(related);
    } catch (error) {
      console.error('Failed to fetch related widgets:', error);
      setWidgets([]);
    } finally {
      setIsLoading(false);
    }
  }, [glossaryTerm]);

  useEffect(() => {
    fetchRelatedWidgets();
  }, [fetchRelatedWidgets]);

  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-accent-purple" />
          <span className="text-xs text-[var(--text-secondary)]">Finding related widgets...</span>
        </div>
      </div>
    );
  }

  if (widgets.length === 0) {
    return null; // Don't show the section if no related widgets
  }

  const visibleWidgets = isExpanded ? widgets : widgets.slice(0, 3);

  return (
    <>
      <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LayoutGrid size={14} className="text-accent-purple" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Related Widgets
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              ({widgets.length})
            </span>
          </div>
          {widgets.length > 3 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-xs text-accent-blue hover:text-accent-blue/80 transition-colors"
            >
              <span>{isExpanded ? 'Show Less' : 'Show All'}</span>
              <ChevronDown
                size={12}
                className={cn('transition-transform', isExpanded && 'rotate-180')}
              />
            </button>
          )}
        </div>

        <div className="space-y-2">
          {visibleWidgets.map(widget => {
            const Icon = TYPE_ICONS[widget.type] || LayoutGrid;
            const iconColor = TYPE_COLORS[widget.type] || 'text-[var(--text-muted)]';

            return (
              <div
                key={widget.id}
                className="group bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3 hover:border-accent-purple/30 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className={cn('mt-0.5 shrink-0', iconColor)}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {widget.title}
                        </h4>
                        <p className="text-[10px] text-[var(--text-secondary)] line-clamp-2 mt-0.5">
                          {widget.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setPreviewWidget(widget)}
                          title="Preview widget"
                          className="p-1 rounded-md opacity-0 group-hover:opacity-100 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-all"
                        >
                          <Eye size={10} />
                        </button>
                        <button
                          onClick={() => setAddToDashboardWidget(widget)}
                          title="Add to dashboard"
                          className="p-1 rounded-md opacity-0 group-hover:opacity-100 bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 transition-all"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] text-[var(--text-muted)]">
                        {widget.type.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[var(--text-muted)]">
                          {Math.round(widget.relevanceScore)}% match
                        </span>
                        <span className="text-[9px] text-[var(--text-muted)]">
                          {widget.usageCount} uses
                        </span>
                      </div>
                    </div>
                    {widget.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {widget.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="px-1 py-0.5 rounded text-[8px] bg-[var(--bg-card-hover)] text-[var(--text-muted)]"
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
          })}
        </div>

        <p className="text-[10px] text-[var(--text-muted)] mt-3 text-center">
          Widgets matched by tags, title, and data source relevance
        </p>
      </div>

      {/* Widget Preview Modal */}
      {previewWidget && (
        <WidgetPreviewModal
          widget={previewWidget}
          onClose={() => setPreviewWidget(null)}
          onAddToDashboard={() => {
            setPreviewWidget(null);
            setAddToDashboardWidget(previewWidget);
          }}
        />
      )}

      {/* Add to Dashboard Modal */}
      {addToDashboardWidget && (
        <AddToDashboardModal
          widget={addToDashboardWidget}
          onClose={() => setAddToDashboardWidget(null)}
        />
      )}
    </>
  );
}