'use client';

import { create } from 'zustand';
import type { DashboardSchema, SchemaPatch, WidgetConfig } from '@/types';
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
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
  reset: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  dashboardId: null,
  title: 'Untitled Dashboard',
  schema: EMPTY_DASHBOARD_SCHEMA,
  isDirty: false,
  isSaving: false,
  isAiWorking: false,
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
    const newSchema = { ...schema, widgets: [...schema.widgets, widget] };
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
    history: [{ schema: EMPTY_DASHBOARD_SCHEMA, note: 'Initial state', timestamp: new Date() }],
    historyIndex: 0,
    canUndo: false,
    canRedo: false,
  }),
}));
