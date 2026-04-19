'use client';

import { useCallback, useEffect } from 'react';
import { X, Plus, BarChart3, PieChart, Table2, Gauge, Type, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetRenderer } from '@/components/dashboard/WidgetRenderer';
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

interface WidgetPreviewModalProps {
  widget: WidgetTemplate;
  onClose: () => void;
  onAddToDashboard: () => void;
}

export function WidgetPreviewModal({ widget, onClose, onAddToDashboard }: WidgetPreviewModalProps) {
  const Icon = TYPE_ICONS[widget.type] || LayoutGrid;
  const iconColor = TYPE_COLORS[widget.type] || 'text-[var(--text-muted)]';

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Create a preview version of the widget config with larger dimensions
  const previewConfig = {
    ...widget.config,
    position: { x: 0, y: 0, w: 8, h: 6 }, // Larger preview size
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl mx-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl shadow-black/20 fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-card)]', iconColor)}>
              <Icon size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">{widget.title}</h2>
              <p className="text-xs text-[var(--text-secondary)]">{widget.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Preview Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Preview</h3>
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                <div style={{ height: '400px' }}>
                  <WidgetRenderer config={previewConfig} />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar with metadata */}
          <div className="w-72 border-l border-[var(--border-color)] bg-[var(--bg-card)] p-6 overflow-y-auto">
            <div className="space-y-4">
              {/* Widget Info */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Widget Details</h4>
                <div className="space-y-2.5">
                  <div>
                    <span className="text-xs font-medium text-[var(--text-muted)] block">Type</span>
                    <span className="text-xs text-[var(--text-primary)]">
                      {widget.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[var(--text-muted)] block">Source Dashboard</span>
                    <span className="text-xs text-[var(--text-primary)]">{widget.sourceDashboardTitle}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[var(--text-muted)] block">Usage Count</span>
                    <span className="text-xs text-[var(--text-primary)]">{widget.usageCount} times</span>
                  </div>
                  {widget.config.dataConfig.source && (
                    <div>
                      <span className="text-xs font-medium text-[var(--text-muted)] block">Data Source</span>
                      <span className="text-xs text-[var(--text-primary)] font-mono">
                        {widget.config.dataConfig.source}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {widget.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {widget.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded text-xs bg-[var(--bg-card-hover)] text-[var(--text-secondary)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Configuration */}
              {widget.config.dataConfig && (
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Configuration</h4>
                  <div className="space-y-2">
                    {widget.config.dataConfig.aggregation && (
                      <div>
                        <span className="text-xs font-medium text-[var(--text-muted)] block">Aggregation</span>
                        <span className="text-xs text-[var(--text-primary)] font-mono">
                          {(widget.config.dataConfig.aggregation as any)?.function || 'N/A'}
                        </span>
                      </div>
                    )}
                    {widget.config.dataConfig.groupBy && widget.config.dataConfig.groupBy.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-[var(--text-muted)] block">Group By</span>
                        <span className="text-xs text-[var(--text-primary)] font-mono">
                          {widget.config.dataConfig.groupBy.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between shrink-0">
          <div className="text-xs text-[var(--text-muted)]">
            Preview uses sample data. Actual widget will use your real data.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              Close
            </button>
            <button
              onClick={onAddToDashboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-purple/10 text-accent-purple text-xs font-medium hover:bg-accent-purple/20 transition-colors"
            >
              <Plus size={12} />
              Add to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}