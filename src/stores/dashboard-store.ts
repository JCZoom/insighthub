'use client';

import { create } from 'zustand';
import type { DashboardSchema, SchemaPatch, WidgetConfig, FilterConfig } from '@/types';
import { EMPTY_DASHBOARD_SCHEMA } from '@/types';
import { applyPatches } from '@/lib/ai/schema-patcher';

// Cap undo history to prevent unbounded memory growth during long editing sessions.
// 50 entries is enough to undo any reasonable sequence of AI refinements.
const MAX_HISTORY_ENTRIES = 50;

interface HistoryEntry {
  schema: DashboardSchema;
  note: string;
  timestamp: Date;
}

function pushHistory(
  history: HistoryEntry[],
  historyIndex: number,
  entry: HistoryEntry,
): { history: HistoryEntry[]; historyIndex: number } {
  const trimmed = history.slice(0, historyIndex + 1);
  trimmed.push(entry);
  // Drop oldest entries if we exceed the cap
  if (trimmed.length > MAX_HISTORY_ENTRIES) {
    const excess = trimmed.length - MAX_HISTORY_ENTRIES;
    return { history: trimmed.slice(excess), historyIndex: trimmed.length - excess - 1 };
  }
  return { history: trimmed, historyIndex: trimmed.length - 1 };
}

interface DashboardState {
  // Current state
  dashboardId: string | null;
  title: string;
  schema: DashboardSchema;
  isDirty: boolean;
  isSaving: boolean;
  isAiWorking: boolean;
  selectedWidgetId: string | null;
  selectedWidgetIds: string[];

  // Undo/redo
  history: HistoryEntry[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  initialize: (id: string | null, title: string, schema: DashboardSchema) => void;
  applyPatch: (patches: SchemaPatch[], note: string) => void;
  addWidget: (widget: WidgetConfig) => void;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, changes: Partial<WidgetConfig>) => void;
  duplicateWidget: (widgetId: string) => void;
  moveWidget: (widgetId: string, x: number, y: number) => void;
  resizeWidget: (widgetId: string, w: number, h: number) => void;
  setTitle: (title: string) => void;
  setAiWorking: (working: boolean) => void;
  selectWidget: (id: string | null) => void;
  selectWidgets: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  moveWidgets: (moves: Array<{id: string; x: number; y: number}>) => void;
  removeWidgets: (ids: string[]) => void;
  jumpToHistory: (index: number) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
  reset: () => void;
  // Global filters
  addGlobalFilter: (filter: FilterConfig) => void;
  removeGlobalFilter: (field: string) => void;
  clearGlobalFilters: () => void;
  updateGlobalFilter: (field: string, value: unknown) => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  dashboardId: null,
  title: 'Untitled Dashboard',
  schema: EMPTY_DASHBOARD_SCHEMA,
  isDirty: false,
  isSaving: false,
  isAiWorking: false,
  selectedWidgetId: null,
  selectedWidgetIds: [],
  history: [{ schema: EMPTY_DASHBOARD_SCHEMA, note: 'Initial state', timestamp: new Date() }],
  historyIndex: 0,
  canUndo: false,
  canRedo: false,

  initialize: (id, title, schema) => {
    set({
      dashboardId: id,
      title,
      schema,
      isDirty: false,
      history: [{ schema, note: 'Loaded', timestamp: new Date() }],
      historyIndex: 0,
      canUndo: false,
      canRedo: false,
    });
  },

  applyPatch: (patches, note) => {
    const { schema, history, historyIndex } = get();
    const newSchema = applyPatches(schema, patches);
    const next = pushHistory(history, historyIndex, { schema: newSchema, note, timestamp: new Date() });

    set({
      schema: newSchema,
      isDirty: true,
      ...next,
      canUndo: next.historyIndex > 0,
      canRedo: false,
    });
  },

  addWidget: (widget) => {
    const { schema, history, historyIndex } = get();

    // Title-banner widgets always pin to the very top of the dashboard,
    // pushing all existing widgets down to accommodate.
    const isBanner =
      widget.type === 'text_block' &&
      widget.visualConfig?.customStyles?.variant === 'banner';

    let newWidgets: typeof schema.widgets;
    if (isBanner) {
      const bannerH = widget.position?.h || 2;
      const pinnedBanner = { ...widget, position: { ...widget.position, x: 0, y: 0, w: 12, h: bannerH } };
      const shifted = schema.widgets.map(w => ({
        ...w,
        position: { ...w.position, y: w.position.y + bannerH },
      }));
      newWidgets = [pinnedBanner, ...shifted];
    } else {
      newWidgets = [...schema.widgets, widget];
    }

    const newSchema = { ...schema, widgets: newWidgets };
    const next = pushHistory(history, historyIndex, { schema: newSchema, note: `Added ${widget.title}`, timestamp: new Date() });

    set({
      schema: newSchema,
      isDirty: true,
      ...next,
      canUndo: next.historyIndex > 0,
      canRedo: false,
    });
  },

  removeWidget: (widgetId) => {
    const { schema, history, historyIndex } = get();
    const widget = schema.widgets.find(w => w.id === widgetId);
    const newSchema = { ...schema, widgets: schema.widgets.filter(w => w.id !== widgetId) };
    const next = pushHistory(history, historyIndex, { schema: newSchema, note: `Removed ${widget?.title || 'widget'}`, timestamp: new Date() });

    set({
      schema: newSchema,
      isDirty: true,
      ...next,
      canUndo: next.historyIndex > 0,
      canRedo: false,
    });
  },

  updateWidget: (widgetId, changes) => {
    const { schema, history, historyIndex } = get();
    const newSchema = {
      ...schema,
      widgets: schema.widgets.map(w =>
        w.id === widgetId ? { ...w, ...changes } : w,
      ),
    };
    const next = pushHistory(history, historyIndex, { schema: newSchema, note: 'Updated widget', timestamp: new Date() });

    set({
      schema: newSchema,
      isDirty: true,
      ...next,
      canUndo: next.historyIndex > 0,
      canRedo: false,
    });
  },

  duplicateWidget: (widgetId) => {
    const { schema, history, historyIndex } = get();
    const source = schema.widgets.find(w => w.id === widgetId);
    if (!source) return;
    const maxY = schema.widgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0);
    const clone: WidgetConfig = {
      ...structuredClone(source),
      id: `widget-${source.type}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${source.title} (copy)`,
      position: { ...source.position, y: maxY },
    };
    const newSchema = { ...schema, widgets: [...schema.widgets, clone] };
    const next = pushHistory(history, historyIndex, { schema: newSchema, note: `Duplicated ${source.title}`, timestamp: new Date() });
    set({ schema: newSchema, isDirty: true, ...next, canUndo: next.historyIndex > 0, canRedo: false });
  },

  moveWidget: (widgetId, x, y) => {
    const { schema, history, historyIndex } = get();
    const newSchema = {
      ...schema,
      widgets: schema.widgets.map(w =>
        w.id === widgetId ? { ...w, position: { ...w.position, x, y } } : w
      ),
    };
    const next = pushHistory(history, historyIndex, { schema: newSchema, note: 'Moved widget', timestamp: new Date() });
    set({ schema: newSchema, isDirty: true, ...next, canUndo: next.historyIndex > 0, canRedo: false });
  },

  resizeWidget: (widgetId, w, h) => {
    const { schema, history, historyIndex } = get();
    const widget = schema.widgets.find(wg => wg.id === widgetId);
    if (!widget) return;
    // Clamp: min 1 col / 1 row, max to grid edge
    const clampedW = Math.max(1, Math.min(w, schema.layout.columns - widget.position.x));
    const clampedH = Math.max(1, h);
    if (clampedW === widget.position.w && clampedH === widget.position.h) return;
    const newSchema = {
      ...schema,
      widgets: schema.widgets.map(wg =>
        wg.id === widgetId ? { ...wg, position: { ...wg.position, w: clampedW, h: clampedH } } : wg
      ),
    };
    const next = pushHistory(history, historyIndex, { schema: newSchema, note: 'Resized widget', timestamp: new Date() });
    set({ schema: newSchema, isDirty: true, ...next, canUndo: next.historyIndex > 0, canRedo: false });
  },

  setTitle: (title) => set({ title, isDirty: true }),

  setAiWorking: (working) => set({ isAiWorking: working }),

  selectWidget: (id) => set({ selectedWidgetId: id, selectedWidgetIds: id ? [id] : [] }),

  selectWidgets: (ids) => set({ selectedWidgetIds: ids, selectedWidgetId: ids[0] || null }),

  toggleSelection: (id) => {
    const { selectedWidgetIds } = get();
    const next = selectedWidgetIds.includes(id)
      ? selectedWidgetIds.filter(wid => wid !== id)
      : [...selectedWidgetIds, id];
    set({ selectedWidgetIds: next, selectedWidgetId: next[0] || null });
  },

  moveWidgets: (moves) => {
    const { schema, history, historyIndex } = get();
    const moveMap = new Map(moves.map(m => [m.id, m]));
    const newSchema = {
      ...schema,
      widgets: schema.widgets.map(w => {
        const move = moveMap.get(w.id);
        return move ? { ...w, position: { ...w.position, x: move.x, y: move.y } } : w;
      }),
    };
    const next = pushHistory(history, historyIndex, { schema: newSchema, note: `Moved ${moves.length} widgets`, timestamp: new Date() });
    set({ schema: newSchema, isDirty: true, ...next, canUndo: next.historyIndex > 0, canRedo: false });
  },

  removeWidgets: (ids) => {
    const { schema, history, historyIndex } = get();
    const idSet = new Set(ids);
    const newSchema = { ...schema, widgets: schema.widgets.filter(w => !idSet.has(w.id)) };
    const next = pushHistory(history, historyIndex, { schema: newSchema, note: `Removed ${ids.length} widgets`, timestamp: new Date() });
    set({ schema: newSchema, isDirty: true, selectedWidgetId: null, selectedWidgetIds: [], ...next, canUndo: next.historyIndex > 0, canRedo: false });
  },

  jumpToHistory: (index) => {
    const { history } = get();
    if (index < 0 || index >= history.length) return;
    set({
      schema: history[index].schema,
      historyIndex: index,
      canUndo: index > 0,
      canRedo: index < history.length - 1,
      isDirty: true,
    });
  },

  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    set({
      schema: history[newIndex].schema,
      historyIndex: newIndex,
      canUndo: newIndex > 0,
      canRedo: true,
      isDirty: true,
    });
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({
      schema: history[newIndex].schema,
      historyIndex: newIndex,
      canUndo: true,
      canRedo: newIndex < history.length - 1,
      isDirty: true,
    });
  },

  markSaved: () => set({ isDirty: false, isSaving: false }),

  reset: () => set({
    dashboardId: null,
    title: 'Untitled Dashboard',
    schema: EMPTY_DASHBOARD_SCHEMA,
    isDirty: false,
    isSaving: false,
    selectedWidgetId: null,
    selectedWidgetIds: [],
    history: [{ schema: EMPTY_DASHBOARD_SCHEMA, note: 'Initial state', timestamp: new Date() }],
    historyIndex: 0,
    canUndo: false,
    canRedo: false,
  }),

  // Global filter actions
  addGlobalFilter: (filter) => {
    const { schema, history, historyIndex } = get();
    const newFilters = [...schema.globalFilters];
    // Replace if filter with same field exists, otherwise add
    const existingIndex = newFilters.findIndex(f => f.field === filter.field);
    if (existingIndex >= 0) {
      newFilters[existingIndex] = filter;
    } else {
      newFilters.push(filter);
    }
    const newSchema = { ...schema, globalFilters: newFilters };
    const next = pushHistory(history, historyIndex, { schema: newSchema, note: `Added filter: ${filter.label}`, timestamp: new Date() });
    set({ schema: newSchema, isDirty: true, ...next, canUndo: next.historyIndex > 0, canRedo: false });
  },

  removeGlobalFilter: (field) => {
    const { schema, history, historyIndex } = get();
    const filter = schema.globalFilters.find(f => f.field === field);
    const newSchema = { ...schema, globalFilters: schema.globalFilters.filter(f => f.field !== field) };
    const next = pushHistory(history, historyIndex, { schema: newSchema, note: `Removed filter: ${filter?.label || field}`, timestamp: new Date() });
    set({ schema: newSchema, isDirty: true, ...next, canUndo: next.historyIndex > 0, canRedo: false });
  },

  clearGlobalFilters: () => {
    const { schema, history, historyIndex } = get();
    if (schema.globalFilters.length === 0) return;
    const newSchema = { ...schema, globalFilters: [] };
    const next = pushHistory(history, historyIndex, { schema: newSchema, note: 'Cleared all filters', timestamp: new Date() });
    set({ schema: newSchema, isDirty: true, ...next, canUndo: next.historyIndex > 0, canRedo: false });
  },

  updateGlobalFilter: (field, value) => {
    const { schema } = get();
    const updatedFilters = schema.globalFilters.map(f =>
      f.field === field ? { ...f, defaultValue: value } : f
    );
    const newSchema = { ...schema, globalFilters: updatedFilters };
    set({ schema: newSchema, isDirty: true });
  },
}));
