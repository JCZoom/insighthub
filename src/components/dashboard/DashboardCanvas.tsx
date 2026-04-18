'use client';

import { useState, useRef, useCallback } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { WidgetRenderer } from './WidgetRenderer';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';
import { WidgetDetailOverlay } from './WidgetDetailOverlay';
import { ContextMenu, getCanvasActions, getWidgetActions, type ContextMenuAction } from './ContextMenu';
import type { WidgetConfig } from '@/types';
import { useRouter } from 'next/navigation';
import { Undo2, Redo2, Save, Info, Check, Library, Loader2, GripVertical, Maximize2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface DashboardCanvasProps {
  onToggleLibrary?: () => void;
  isLibraryOpen?: boolean;
}

export function DashboardCanvas({ onToggleLibrary, isLibraryOpen }: DashboardCanvasProps) {
  const {
    schema, title, canUndo, canRedo, isDirty, isAiWorking,
    undo, redo, addWidget, removeWidget, updateWidget, duplicateWidget, moveWidget, resizeWidget,
  } = useDashboardStore();
  const { widgets, layout } = schema;
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const { toast } = useToast();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; actions: ContextMenuAction[] } | null>(null);
  const [dragState, setDragState] = useState<{
    widgetId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    ghostX: number;
    ghostY: number;
  } | null>(null);
  const [resizeState, setResizeState] = useState<{
    widgetId: string;
    previewW: number;
    previewH: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [detailWidget, setDetailWidget] = useState<WidgetConfig | null>(null);

  const router = useRouter();

  const handleSave = async () => {
    const store = useDashboardStore.getState();
    let { dashboardId } = store;
    const { schema: currentSchema, title: currentTitle, markSaved, initialize } = store;
    setSaveStatus('saving');
    try {
      // If no dashboardId, create the dashboard first
      if (!dashboardId) {
        const createRes = await fetch('/api/dashboards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: currentTitle,
            schema: currentSchema,
          }),
        });
        if (!createRes.ok) {
          toast({ type: 'error', title: 'Save failed', description: 'Could not create dashboard.' });
          setSaveStatus('idle');
          return;
        }
        const { dashboard } = await createRes.json();
        dashboardId = dashboard.id;
        // Re-initialize the store with the new DB id so future saves use PUT
        initialize(dashboardId!, currentTitle, currentSchema);
        // Update the URL so the user is now on /dashboard/[id] instead of /dashboard/new
        router.replace(`/dashboard/${dashboardId}`);
        markSaved();
        setSaveStatus('saved');
        toast({ type: 'success', title: 'Dashboard created & saved' });
      } else {
        // Existing dashboard — save a new version
        const res = await fetch(`/api/dashboards/${dashboardId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema: currentSchema, changeNote: 'Manual save' }),
        });
        if (res.ok) {
          markSaved();
          setSaveStatus('saved');
          toast({ type: 'success', title: 'Dashboard saved' });
        } else {
          toast({ type: 'error', title: 'Save failed', description: 'Could not save to server.' });
          setSaveStatus('idle');
        }
      }
    } catch {
      toast({ type: 'error', title: 'Save failed', description: 'Network error.' });
      setSaveStatus('idle');
    }
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // --- Right-click on empty canvas ---
  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    closeContextMenu();
    const maxY = widgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0);

    const makeWidget = (type: WidgetConfig['type'], title: string, w: number, h: number): WidgetConfig => ({
      id: `widget-${type}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      position: { x: 0, y: maxY, w, h },
      dataConfig: { source: type === 'kpi_card' ? 'kpi_summary' : type === 'table' ? 'tickets_by_team' : 'revenue_by_month', aggregation: type === 'kpi_card' ? { function: 'sum', field: 'mrr' } : undefined },
      visualConfig: {},
    });

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      actions: getCanvasActions({
        addKpi: () => addWidget(makeWidget('kpi_card', 'New KPI', 3, 2)),
        addChart: () => addWidget(makeWidget('bar_chart', 'New Chart', 6, 4)),
        addTable: () => addWidget(makeWidget('table', 'New Table', 12, 4)),
        addText: () => addWidget({ id: `widget-text-${Math.random().toString(36).slice(2, 6)}`, type: 'text_block', title: 'Text', position: { x: 0, y: maxY, w: 6, h: 2 }, dataConfig: { source: '' }, visualConfig: {} }),
        openLibrary: () => onToggleLibrary?.(),
      }),
    });
  };

  // --- Right-click on widget ---
  const handleWidgetContextMenu = (e: React.MouseEvent, widget: WidgetConfig) => {
    e.preventDefault();
    e.stopPropagation();
    closeContextMenu();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      actions: getWidgetActions({
        duplicate: () => duplicateWidget(widget.id),
        delete: () => removeWidget(widget.id),
        widen: () => {
          const newW = Math.min(widget.position.w + 3, layout.columns - widget.position.x);
          updateWidget(widget.id, { position: { ...widget.position, w: newW } });
        },
        narrow: () => {
          const newW = Math.max(widget.position.w - 3, 1);
          updateWidget(widget.id, { position: { ...widget.position, w: newW } });
        },
      }),
    });
  };

  // --- Drag-and-drop ---
  const handleDragStart = (e: React.PointerEvent, widget: WidgetConfig) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      widgetId: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: widget.position.x,
      origY: widget.position.y,
      ghostX: widget.position.x,
      ghostY: widget.position.y,
    });

    const handleMove = (me: PointerEvent) => {
      if (!gridRef.current) return;
      const gridRect = gridRef.current.getBoundingClientRect();
      const cellW = gridRect.width / layout.columns;
      const cellH = layout.rowHeight + layout.gap;
      const dx = me.clientX - e.clientX;
      const dy = me.clientY - e.clientY;
      const newX = Math.max(0, Math.min(layout.columns - widget.position.w, Math.round(widget.position.x + dx / cellW)));
      const newY = Math.max(0, Math.round(widget.position.y + dy / cellH));
      setDragState(prev => prev ? { ...prev, ghostX: newX, ghostY: newY } : null);
    };

    const handleUp = (ue: PointerEvent) => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      if (!gridRef.current) { setDragState(null); return; }
      const gridRect = gridRef.current.getBoundingClientRect();
      const cellW = gridRect.width / layout.columns;
      const cellH = layout.rowHeight + layout.gap;
      const dx = ue.clientX - e.clientX;
      const dy = ue.clientY - e.clientY;
      const newX = Math.max(0, Math.min(layout.columns - widget.position.w, Math.round(widget.position.x + dx / cellW)));
      const newY = Math.max(0, Math.round(widget.position.y + dy / cellH));
      if (newX !== widget.position.x || newY !== widget.position.y) {
        moveWidget(widget.id, newX, newY);
      }
      setDragState(null);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  // --- Resize drag ---
  const handleResizeStart = (e: React.PointerEvent, widget: WidgetConfig) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeState({ widgetId: widget.id, previewW: widget.position.w, previewH: widget.position.h });

    const calcSize = (px: number, py: number) => {
      if (!gridRef.current) return { w: widget.position.w, h: widget.position.h };
      const gridRect = gridRef.current.getBoundingClientRect();
      const cellW = gridRect.width / layout.columns;
      const cellH = layout.rowHeight + layout.gap;
      const originPx = gridRect.left + widget.position.x * cellW;
      const originPy = gridRect.top + widget.position.y * cellH;
      const newW = Math.max(1, Math.min(Math.round((px - originPx) / cellW), layout.columns - widget.position.x));
      const newH = Math.max(1, Math.round((py - originPy) / cellH));
      return { w: newW, h: newH };
    };

    const handleMove = (me: PointerEvent) => {
      const { w, h } = calcSize(me.clientX, me.clientY);
      setResizeState(prev => prev ? { ...prev, previewW: w, previewH: h } : null);
    };

    const handleUp = (ue: PointerEvent) => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const { w, h } = calcSize(ue.clientX, ue.clientY);
      if (w !== widget.position.w || h !== widget.position.h) {
        resizeWidget(widget.id, w, h);
      }
      setResizeState(null);
    };

    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
          {isDirty && <span className="pill pill-amber">Unsaved</span>}
          {isAiWorking && (
            <span className="flex items-center gap-1.5 pill pill-blue">
              <Loader2 size={10} className="animate-spin" />
              AI working…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 rounded-lg hover:bg-[var(--bg-card)] disabled:opacity-30 transition-colors"
            title="Undo (⌘Z)"
          >
            <Undo2 size={16} className="text-[var(--text-secondary)]" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 rounded-lg hover:bg-[var(--bg-card)] disabled:opacity-30 transition-colors"
            title="Redo (⌘⇧Z)"
          >
            <Redo2 size={16} className="text-[var(--text-secondary)]" />
          </button>
          <div className="w-px h-6 bg-[var(--border-color)] mx-1" />
          {onToggleLibrary && (
            <button
              onClick={onToggleLibrary}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isLibraryOpen
                  ? 'bg-accent-purple/10 text-accent-purple'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
              }`}
              title="Browse Widget Library"
            >
              <Library size={14} />
              <span className="hidden lg:inline">Widgets</span>
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-green/10 text-accent-green text-sm font-medium hover:bg-accent-green/20 transition-colors disabled:opacity-50"
          >
            {saveStatus === 'saving' ? <Loader2 size={14} className="animate-spin" /> : saveStatus === 'saved' ? <Check size={14} /> : <Save size={14} />}
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Demo mode banner */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-accent-amber/5 border-b border-accent-amber/20 text-xs text-accent-amber">
        <Info size={12} />
        <span>Demo mode — using sample data. Right-click to add widgets. Drag grip to move, corner to resize.</span>
      </div>

      {/* Widget grid */}
      <div
        className="flex-1 overflow-auto p-4 relative"
        onContextMenu={handleCanvasContextMenu}
      >
        {/* AI working shimmer overlay */}
        {isAiWorking && (
          <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
            <div className="absolute inset-0 bg-accent-blue/[0.03] animate-pulse" />
            <div className="bg-[var(--bg-card)]/90 backdrop-blur-md border border-accent-blue/20 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-lg pointer-events-auto">
              <Loader2 size={20} className="animate-spin text-accent-blue" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Building your dashboard…</p>
                <p className="text-[10px] text-[var(--text-muted)]">The AI is generating your widgets</p>
              </div>
            </div>
          </div>
        )}

        {widgets.length === 0 && !isAiWorking ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4 opacity-20">📊</div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Empty Canvas</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mb-4">
              Use the chat panel to describe what you&apos;d like to visualize, or right-click to add widgets manually.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Try: &ldquo;Show me monthly churn rate by plan for the past year&rdquo;
            </p>
          </div>
        ) : (
          <div
            ref={gridRef}
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
              gridAutoRows: `${layout.rowHeight}px`,
            }}
          >
            {/* Drag ghost outline */}
            {dragState && (() => {
              const draggedWidget = widgets.find(w => w.id === dragState.widgetId);
              if (!draggedWidget) return null;
              return (
                <div
                  style={{
                    gridColumn: `${dragState.ghostX + 1} / span ${draggedWidget.position.w}`,
                    gridRow: `${dragState.ghostY + 1} / span ${draggedWidget.position.h}`,
                  }}
                  className="rounded-xl border-2 border-dashed border-accent-blue/50 bg-accent-blue/5 pointer-events-none transition-all duration-100"
                />
              );
            })()}

            {widgets.map((widget: WidgetConfig) => (
              <div
                key={widget.id}
                onContextMenu={(e) => handleWidgetContextMenu(e, widget)}
                style={{
                  gridColumn: `${widget.position.x + 1} / span ${resizeState?.widgetId === widget.id ? resizeState.previewW : widget.position.w}`,
                  gridRow: `${widget.position.y + 1} / span ${resizeState?.widgetId === widget.id ? resizeState.previewH : widget.position.h}`,
                }}
                className={`min-h-0 relative group transition-shadow ${
                  dragState?.widgetId === widget.id ? 'opacity-40 ring-2 ring-accent-blue/30 rounded-xl scale-[0.98]' : ''
                }${resizeState?.widgetId === widget.id ? ' ring-2 ring-accent-purple rounded-xl' : ''}`}
              >
                {/* Drag handle */}
                <div
                  onPointerDown={(e) => handleDragStart(e, widget)}
                  className="absolute top-1 left-1 z-10 p-1 rounded-md bg-[var(--bg-card)]/80 border border-[var(--border-color)] opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
                  title="Drag to reposition"
                >
                  <GripVertical size={12} className="text-[var(--text-muted)]" />
                </div>
                {/* Resize handle (SE corner) */}
                <div
                  onPointerDown={(e) => handleResizeStart(e, widget)}
                  className={`absolute bottom-0 right-0 z-10 w-5 h-5 flex items-end justify-end cursor-nwse-resize transition-opacity ${
                    resizeState?.widgetId === widget.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title="Drag to resize"
                >
                  <Maximize2 size={10} className="text-[var(--text-muted)] rotate-90 m-1" />
                </div>
                <WidgetErrorBoundary widgetTitle={widget.title}>
                  <WidgetRenderer config={widget} onDetailClick={setDetailWidget} />
                </WidgetErrorBoundary>
              </div>
            ))}
          </div>
        )}

        {/* Context menu portal */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            actions={contextMenu.actions}
            onClose={closeContextMenu}
          />
        )}

        {/* Widget detail overlay */}
        {detailWidget && (
          <WidgetDetailOverlay config={detailWidget} onClose={() => setDetailWidget(null)} />
        )}
      </div>
    </div>
  );
}
