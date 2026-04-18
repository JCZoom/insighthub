'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Settings2, Database, Palette, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { getAvailableSources } from '@/lib/data/sample-data';
import type { WidgetConfig, WidgetType, ThresholdConfig } from '@/types';

// ── Constants ────────────────────────────────────────────────────────────────

const WIDGET_TYPES: { value: WidgetType; label: string }[] = [
  { value: 'kpi_card', label: 'KPI Card' },
  { value: 'line_chart', label: 'Line Chart' },
  { value: 'bar_chart', label: 'Bar Chart' },
  { value: 'stacked_bar', label: 'Stacked Bar' },
  { value: 'area_chart', label: 'Area Chart' },
  { value: 'pie_chart', label: 'Pie Chart' },
  { value: 'donut_chart', label: 'Donut Chart' },
  { value: 'scatter_plot', label: 'Scatter Plot' },
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'table', label: 'Table' },
  { value: 'pivot_table', label: 'Pivot Table' },
  { value: 'funnel', label: 'Funnel' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'metric_row', label: 'Metric Row' },
  { value: 'text_block', label: 'Text Block' },
  { value: 'divider', label: 'Divider' },
];

const COLOR_SCHEMES = [
  { value: 'blue', label: 'Blue', color: '#6baaff' },
  { value: 'green', label: 'Green', color: '#56c47a' },
  { value: 'purple', label: 'Purple', color: '#b48eff' },
  { value: 'amber', label: 'Amber', color: '#dba644' },
  { value: 'cyan', label: 'Cyan', color: '#4dcec2' },
  { value: 'red', label: 'Red', color: '#f47670' },
];

const AGG_FUNCTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'count_distinct', label: 'Count Distinct' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'median', label: 'Median' },
];

type Tab = 'general' | 'data' | 'visual';

// ── Component ────────────────────────────────────────────────────────────────

interface WidgetConfigPanelProps {
  widgetId: string;
  onClose: () => void;
}

export function WidgetConfigPanel({ widgetId, onClose }: WidgetConfigPanelProps) {
  const { schema, updateWidget } = useDashboardStore();
  const widget = schema.widgets.find(w => w.id === widgetId);
  const [tab, setTab] = useState<Tab>('general');
  const dataSources = useRef(getAvailableSources().filter((s, i, arr) => arr.indexOf(s) === i && !s.startsWith('sample_')).sort()).current;

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const update = useCallback(
    (changes: Partial<WidgetConfig>) => {
      updateWidget(widgetId, changes);
    },
    [widgetId, updateWidget],
  );

  if (!widget) return null;

  const tabs: { key: Tab; label: string; icon: typeof Settings2 }[] = [
    { key: 'general', label: 'General', icon: Settings2 },
    { key: 'data', label: 'Data', icon: Database },
    { key: 'visual', label: 'Visual', icon: Palette },
  ];

  return (
    <div
      className="w-80 h-full border-l border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur-xl flex flex-col shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
          Edit: {widget.title}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-[var(--bg-card)] transition-colors"
        >
          <X size={14} className="text-[var(--text-muted)]" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--border-color)]">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              tab === key
                ? 'text-accent-cyan border-b-2 border-accent-cyan bg-accent-cyan/5'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/50'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'general' && <GeneralTab widget={widget} update={update} />}
        {tab === 'data' && <DataTab widget={widget} update={update} dataSources={dataSources} />}
        {tab === 'visual' && <VisualTab widget={widget} update={update} />}
      </div>
    </div>
  );
}

// ── Shared form field component ──────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  onCommit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit?.()}
      onKeyDown={(e) => { if (e.key === 'Enter') { onCommit?.(); (e.target as HTMLInputElement).blur(); } }}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-accent-cyan/50 focus:border-accent-cyan/50 transition-colors"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-accent-cyan/50 focus:border-accent-cyan/50 transition-colors appearance-none pr-8"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          checked ? 'bg-accent-cyan' : 'bg-[var(--bg-card)] border border-[var(--border-color)]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

// ── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab({
  widget,
  update,
}: {
  widget: WidgetConfig;
  update: (changes: Partial<WidgetConfig>) => void;
}) {
  const [localTitle, setLocalTitle] = useState(widget.title);
  const [localSubtitle, setLocalSubtitle] = useState(widget.subtitle || '');

  // Sync local state when widget changes externally (e.g. undo/redo)
  useEffect(() => {
    setLocalTitle(widget.title);
    setLocalSubtitle(widget.subtitle || '');
  }, [widget.title, widget.subtitle]);

  const commitTitle = () => {
    if (localTitle.trim() && localTitle !== widget.title) update({ title: localTitle.trim() });
  };
  const commitSubtitle = () => {
    const val = localSubtitle.trim();
    if (val !== (widget.subtitle || '')) update({ subtitle: val || undefined });
  };

  return (
    <>
      <div>
        <FieldLabel>Title</FieldLabel>
        <TextInput
          value={localTitle}
          onChange={(v) => setLocalTitle(v)}
          onCommit={commitTitle}
          placeholder="Widget title"
        />
        {localTitle !== widget.title && (
          <p className="mt-1 text-[10px] text-accent-cyan/60">Press Enter or click away to apply</p>
        )}
      </div>

      <div>
        <FieldLabel>Subtitle</FieldLabel>
        <TextInput
          value={localSubtitle}
          onChange={(v) => setLocalSubtitle(v)}
          onCommit={commitSubtitle}
          placeholder="Optional subtitle"
        />
        {localSubtitle !== (widget.subtitle || '') && (
          <p className="mt-1 text-[10px] text-accent-cyan/60">Press Enter or click away to apply</p>
        )}
      </div>

      <div>
        <FieldLabel>Widget Type</FieldLabel>
        <SelectInput
          value={widget.type}
          onChange={(v) => update({ type: v as WidgetType })}
          options={WIDGET_TYPES}
        />
      </div>

      <div>
        <FieldLabel>Position</FieldLabel>
        <div className="grid grid-cols-4 gap-2">
          {(['x', 'y', 'w', 'h'] as const).map((key) => (
            <div key={key}>
              <span className="text-[10px] text-[var(--text-muted)] uppercase">{key}</span>
              <input
                type="number"
                value={widget.position[key]}
                min={key === 'w' || key === 'h' ? 1 : 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  update({ position: { ...widget.position, [key]: Math.max(key === 'w' || key === 'h' ? 1 : 0, val) } });
                }}
                className="w-full px-2 py-1.5 text-xs text-center rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-accent-cyan/50 transition-colors"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Data Tab ─────────────────────────────────────────────────────────────────

function DataTab({
  widget,
  update,
  dataSources,
}: {
  widget: WidgetConfig;
  update: (changes: Partial<WidgetConfig>) => void;
  dataSources: string[];
}) {
  const sourceOptions = dataSources.map((s) => ({
    value: s,
    label: s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  const aggField = widget.dataConfig.aggregation?.field || '';
  const aggFunction = widget.dataConfig.aggregation?.function || 'sum';

  return (
    <>
      <div>
        <FieldLabel>Data Source</FieldLabel>
        <SelectInput
          value={widget.dataConfig.source}
          onChange={(v) =>
            update({
              dataConfig: { ...widget.dataConfig, source: v },
            })
          }
          options={[{ value: '', label: '— Select source —' }, ...sourceOptions]}
        />
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
          Sample data source for this widget
        </p>
      </div>

      <div>
        <FieldLabel>Aggregation Function</FieldLabel>
        <SelectInput
          value={aggFunction}
          onChange={(v) =>
            update({
              dataConfig: {
                ...widget.dataConfig,
                aggregation: {
                  ...widget.dataConfig.aggregation,
                  function: v as 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median',
                  field: aggField,
                },
              },
            })
          }
          options={AGG_FUNCTIONS}
        />
      </div>

      <div>
        <FieldLabel>Aggregation Field</FieldLabel>
        <TextInput
          value={aggField}
          onChange={(v) =>
            update({
              dataConfig: {
                ...widget.dataConfig,
                aggregation: {
                  ...widget.dataConfig.aggregation,
                  function: aggFunction as 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median',
                  field: v,
                },
              },
            })
          }
          placeholder="e.g. mrr, ticket_count"
        />
      </div>

      <div>
        <FieldLabel>Limit</FieldLabel>
        <input
          type="number"
          value={widget.dataConfig.limit ?? ''}
          min={1}
          placeholder="No limit"
          onChange={(e) => {
            const val = e.target.value ? parseInt(e.target.value) : undefined;
            update({
              dataConfig: { ...widget.dataConfig, limit: val },
            });
          }}
          className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-accent-cyan/50 transition-colors"
        />
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
          Max rows returned from query
        </p>
      </div>
    </>
  );
}

// ── Text Block constants ──────────────────────────────────────────────────────

const TEXT_VARIANTS: { value: string; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'banner', label: 'Banner' },
  { value: 'callout', label: 'Callout' },
  { value: 'header', label: 'Section Header' },
  { value: 'quote', label: 'Quote' },
];

const TEXT_BG_COLORS: { value: string; label: string; color: string }[] = [
  { value: '', label: 'Default', color: 'transparent' },
  { value: 'blue', label: 'Blue', color: 'rgba(107,170,255,0.15)' },
  { value: 'green', label: 'Green', color: 'rgba(86,196,122,0.15)' },
  { value: 'purple', label: 'Purple', color: 'rgba(180,142,255,0.15)' },
  { value: 'amber', label: 'Amber', color: 'rgba(219,166,68,0.15)' },
  { value: 'cyan', label: 'Cyan', color: 'rgba(77,206,194,0.15)' },
  { value: 'red', label: 'Red', color: 'rgba(244,118,112,0.15)' },
  { value: 'dark', label: 'Dark', color: 'rgba(0,0,0,0.5)' },
];

const TEXT_COLORS: { value: string; label: string; color: string }[] = [
  { value: '', label: 'Default', color: '#999' },
  { value: 'blue', label: 'Blue', color: '#6baaff' },
  { value: 'green', label: 'Green', color: '#56c47a' },
  { value: 'purple', label: 'Purple', color: '#b48eff' },
  { value: 'amber', label: 'Amber', color: '#dba644' },
  { value: 'cyan', label: 'Cyan', color: '#4dcec2' },
  { value: 'red', label: 'Red', color: '#f47670' },
  { value: 'white', label: 'White', color: '#ffffff' },
];

const FONT_SIZES: { value: string; label: string }[] = [
  { value: '', label: 'Default' },
  { value: 'xs', label: 'XS' },
  { value: 'sm', label: 'SM' },
  { value: 'base', label: 'Base' },
  { value: 'lg', label: 'LG' },
  { value: 'xl', label: 'XL' },
  { value: '2xl', label: '2XL' },
  { value: '3xl', label: '3XL' },
];

const TEXT_ICONS: { value: string; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
  { value: 'lightbulb', label: 'Lightbulb' },
  { value: 'target', label: 'Target' },
  { value: 'trending', label: 'Trending' },
  { value: 'star', label: 'Star' },
  { value: 'zap', label: 'Zap' },
];

// ── Visual Tab ───────────────────────────────────────────────────────────────

function VisualTab({
  widget,
  update,
}: {
  widget: WidgetConfig;
  update: (changes: Partial<WidgetConfig>) => void;
}) {
  const vc = widget.visualConfig;

  const updateVisual = (changes: Partial<WidgetConfig['visualConfig']>) => {
    update({ visualConfig: { ...vc, ...changes } });
  };

  const updateCustomStyle = (key: string, value: string) => {
    const current = vc.customStyles ?? {};
    const draft: Record<string, string> = { ...current, [key]: value };
    // Clean out empty values
    if (!draft[key]) delete draft[key];
    updateVisual({ customStyles: Object.keys(draft).length > 0 ? draft : undefined });
  };

  const isTextBlock = widget.type === 'text_block';
  const supportsThresholds = ['kpi_card', 'gauge', 'line_chart', 'bar_chart', 'area_chart'].includes(widget.type);
  const cs = vc.customStyles ?? {};

  // Threshold management functions
  const addThreshold = () => {
    const thresholds = vc.thresholds || [];
    const newThreshold = { value: 0, color: '#6baaff', label: 'Threshold' };
    updateVisual({ thresholds: [...thresholds, newThreshold] });
  };

  const updateThreshold = (index: number, changes: Partial<ThresholdConfig>) => {
    const thresholds = vc.thresholds || [];
    const updated = thresholds.map((t, i) => i === index ? { ...t, ...changes } : t);
    updateVisual({ thresholds: updated });
  };

  const removeThreshold = (index: number) => {
    const thresholds = vc.thresholds || [];
    const filtered = thresholds.filter((_, i) => i !== index);
    updateVisual({ thresholds: filtered.length > 0 ? filtered : undefined });
  };

  // Text block gets a specialized panel
  if (isTextBlock) {
    return (
      <>
        <div>
          <FieldLabel>Variant</FieldLabel>
          <SelectInput
            value={cs.variant || 'plain'}
            onChange={(v) => updateCustomStyle('variant', v)}
            options={TEXT_VARIANTS}
          />
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">
            Sets the overall look — banner, callout, section header, etc.
          </p>
        </div>

        <div>
          <FieldLabel>Background Color</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {TEXT_BG_COLORS.map(({ value, label, color }) => (
              <button
                key={value}
                onClick={() => updateCustomStyle('backgroundColor', value)}
                title={label}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  (cs.backgroundColor || '') === value
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-[var(--border-color)] hover:border-white/30 hover:scale-105'
                }`}
                style={{ backgroundColor: color || 'var(--bg-card)' }}
              />
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Title Color</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {TEXT_COLORS.map(({ value, label, color }) => (
              <button
                key={value}
                onClick={() => updateCustomStyle('titleColor', value)}
                title={label}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  (cs.titleColor || '') === value
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent hover:border-white/30 hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Text Color</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {TEXT_COLORS.map(({ value, label, color }) => (
              <button
                key={value}
                onClick={() => updateCustomStyle('textColor', value)}
                title={label}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  (cs.textColor || '') === value
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent hover:border-white/30 hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Border Accent</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {TEXT_COLORS.map(({ value, label, color }) => (
              <button
                key={value}
                onClick={() => updateCustomStyle('borderAccent', value)}
                title={label}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  (cs.borderAccent || '') === value
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent hover:border-white/30 hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Font Size</FieldLabel>
            <SelectInput
              value={cs.fontSize || ''}
              onChange={(v) => updateCustomStyle('fontSize', v)}
              options={FONT_SIZES}
            />
          </div>
          <div>
            <FieldLabel>Alignment</FieldLabel>
            <SelectInput
              value={cs.textAlign || ''}
              onChange={(v) => updateCustomStyle('textAlign', v)}
              options={[
                { value: '', label: 'Default' },
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Font Weight</FieldLabel>
            <SelectInput
              value={cs.fontWeight || ''}
              onChange={(v) => updateCustomStyle('fontWeight', v)}
              options={[
                { value: '', label: 'Default' },
                { value: 'normal', label: 'Normal' },
                { value: 'medium', label: 'Medium' },
                { value: 'semibold', label: 'Semibold' },
                { value: 'bold', label: 'Bold' },
              ]}
            />
          </div>
          <div>
            <FieldLabel>Icon</FieldLabel>
            <SelectInput
              value={cs.icon || ''}
              onChange={(v) => updateCustomStyle('icon', v)}
              options={TEXT_ICONS}
            />
          </div>
        </div>
      </>
    );
  }

  // Standard chart/widget visual controls
  return (
    <>
      <div>
        <FieldLabel>Color Scheme</FieldLabel>
        <div className="flex gap-2 flex-wrap">
          {COLOR_SCHEMES.map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => updateVisual({ colorScheme: value })}
              title={label}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                vc.colorScheme === value
                  ? 'border-white scale-110 shadow-lg'
                  : 'border-transparent hover:border-white/30 hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <ToggleSwitch
          checked={vc.showLegend !== false}
          onChange={(v) => updateVisual({ showLegend: v })}
          label="Show Legend"
        />
        <ToggleSwitch
          checked={vc.showGrid !== false}
          onChange={(v) => updateVisual({ showGrid: v })}
          label="Show Grid"
        />
        <ToggleSwitch
          checked={vc.showLabels !== false}
          onChange={(v) => updateVisual({ showLabels: v })}
          label="Show Labels"
        />
        <ToggleSwitch
          checked={vc.stacked === true}
          onChange={(v) => updateVisual({ stacked: v })}
          label="Stacked"
        />
        <ToggleSwitch
          checked={vc.animate !== false}
          onChange={(v) => updateVisual({ animate: v })}
          label="Animate"
        />
      </div>

      {/* Thresholds Section */}
      {supportsThresholds && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <FieldLabel>Thresholds</FieldLabel>
            <button
              onClick={addThreshold}
              className="p-1 rounded-md hover:bg-[var(--bg-card)] transition-colors group"
              title="Add threshold"
            >
              <Plus size={12} className="text-[var(--text-muted)] group-hover:text-accent-cyan" />
            </button>
          </div>

          <div className="space-y-3">
            {(vc.thresholds || []).map((threshold, index) => (
              <ThresholdEditor
                key={index}
                threshold={threshold}
                index={index}
                onUpdate={(changes) => updateThreshold(index, changes)}
                onRemove={() => removeThreshold(index)}
              />
            ))}
            {(!vc.thresholds || vc.thresholds.length === 0) && (
              <p className="text-[10px] text-[var(--text-muted)] text-center py-2">
                No thresholds defined. Click + to add one.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Threshold Editor ─────────────────────────────────────────────────────────

interface ThresholdEditorProps {
  threshold: ThresholdConfig;
  index: number;
  onUpdate: (changes: Partial<ThresholdConfig>) => void;
  onRemove: () => void;
}

function ThresholdEditor({ threshold, index, onUpdate, onRemove }: ThresholdEditorProps) {
  const THRESHOLD_COLORS = [
    { value: '#f47670', label: 'Red' },
    { value: '#dba644', label: 'Amber' },
    { value: '#56c47a', label: 'Green' },
    { value: '#6baaff', label: 'Blue' },
    { value: '#4dcec2', label: 'Cyan' },
    { value: '#b48eff', label: 'Purple' },
    { value: '#666666', label: 'Gray' },
  ];

  return (
    <div className="p-3 rounded-lg bg-[var(--bg-card)]/50 border border-[var(--border-color)]/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          Threshold {index + 1}
        </span>
        <button
          onClick={onRemove}
          className="p-1 rounded-md hover:bg-[var(--bg-primary)]/50 transition-colors group"
          title="Remove threshold"
        >
          <Trash2 size={11} className="text-[var(--text-muted)] group-hover:text-red-400" />
        </button>
      </div>

      {/* Value and Label Row */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
            Value
          </label>
          <input
            type="number"
            value={threshold.value}
            onChange={(e) => onUpdate({ value: parseFloat(e.target.value) || 0 })}
            step="any"
            className="w-full px-2 py-1.5 text-xs rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-accent-cyan/50 transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
            Label
          </label>
          <input
            type="text"
            value={threshold.label || ''}
            onChange={(e) => onUpdate({ label: e.target.value || undefined })}
            placeholder="Optional"
            className="w-full px-2 py-1.5 text-xs rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-accent-cyan/50 transition-colors"
          />
        </div>
      </div>

      {/* Color Picker */}
      <div>
        <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Color
        </label>
        <div className="flex gap-2 flex-wrap">
          {THRESHOLD_COLORS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onUpdate({ color: value })}
              title={label}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                threshold.color === value
                  ? 'border-white scale-110 shadow-lg'
                  : 'border-transparent hover:border-white/30 hover:scale-105'
              }`}
              style={{ backgroundColor: value }}
            />
          ))}
          {/* Custom color input */}
          <div className="relative">
            <input
              type="color"
              value={threshold.color}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white/30 cursor-pointer"
              title="Custom color"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
