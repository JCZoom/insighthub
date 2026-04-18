'use client';

import { useState, useRef, useCallback } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { WidgetRenderer } from './WidgetRenderer';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';
import { WidgetDetailOverlay } from './WidgetDetailOverlay';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { ShortcutHelpOverlay } from './ShortcutHelpOverlay';
import { ShareModal } from './ShareModal';
import { ContextMenu, getCanvasActions, getWidgetActions, type ContextMenuAction } from './ContextMenu';
import { MetricExplanationModal } from './MetricExplanationModal';
import { ResizeHandles, type ResizeDirection } from './ResizeHandles';
import { getMinWidgetSize } from '@/components/widgets/widget-utils';
import type { WidgetConfig } from '@/types';
import { useRouter } from 'next/navigation';
import { Undo2, Redo2, Save, Info, Check, Library, Loader2, GripVertical, Trash2, Pencil, Share2, Keyboard, Settings2, HelpCircle } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { generateChangeSummaryFromHistory } from '@/lib/ai/change-summarizer';

interface DashboardCanvasProps {
  onToggleLibrary?: () => void;
  isLibraryOpen?: boolean;
}

export function DashboardCanvas({ onToggleLibrary, isLibraryOpen }: DashboardCanvasProps) {
  const {
    schema, title, canUndo, canRedo, isDirty, isAiWorking, selectedWidgetId,
    undo, redo, addWidget, removeWidget, updateWidget, duplicateWidget, moveWidget, resizeWidget, setTitle, selectWidget,
  } = useDashboardStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);
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
    direction: ResizeDirection;
    previewW: number;
    previewH: number;
    previewX: number;
    previewY: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [detailWidget, setDetailWidget] = useState<WidgetConfig | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [configWidgetId, setConfigWidgetId] = useState<string | null>(null);
  const [explainWidget, setExplainWidget] = useState<WidgetConfig | null>(null);

  const router = useRouter();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: () => handleSave(),
    onToggleHelp: () => setShowHelp(prev => !prev),
  });

  // Handle explain metric requests
  const handleExplainMetric = useCallback((widget: WidgetConfig) => {
    setExplainWidget(widget);
  }, []);

  const handleSave = async () => {
    const store = useDashboardStore.getState();
    let { dashboardId } = store;
    const { schema: currentSchema, title: currentTitle, markSaved, initialize, history, historyIndex } = store;
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
        toast({ type: 'success', title: 'Dashboard saved!', description: 'Saved to your gallery. Find it anytime at /dashboards.' });
      } else {
        // Existing dashboard — save a new version with smart change summary
        const changeNote = generateChangeSummaryFromHistory(history, historyIndex);
        const res = await fetch(`/api/dashboards/${dashboardId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema: currentSchema, changeNote }),
        });
        if (res.ok) {
          markSaved();
          setSaveStatus('saved');
          toast({ type: 'success', title: 'Dashboard saved!', description: 'New version saved successfully.' });
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
        editConfig: () => { selectWidget(widget.id); setConfigWidgetId(widget.id); },
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

  // --- Enhanced resize with multiple directions ---
  const handleResizeStart = (widget: WidgetConfig, direction: ResizeDirection) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { minW, minH } = getMinWidgetSize(widget.type);

    setResizeState({
      widgetId: widget.id,
      direction,
      previewW: widget.position.w,
      previewH: widget.position.h,
      previewX: widget.position.x,
      previewY: widget.position.y,
    });

    const calcSizeAndPosition = (px: number, py: number) => {
      if (!gridRef.current) return {
        w: widget.position.w, h: widget.position.h,
        x: widget.position.x, y: widget.position.y
      };

      const gridRect = gridRef.current.getBoundingClientRect();
      const cellW = gridRect.width / layout.columns;
      const cellH = layout.rowHeight + layout.gap;

      // Current widget bounds in pixels
      const currentLeft = gridRect.left + widget.position.x * cellW;
      const currentTop = gridRect.top + widget.position.y * cellH;
      const currentRight = currentLeft + widget.position.w * cellW;
      const currentBottom = currentTop + widget.position.h * cellH;

      let newX = widget.position.x;
      let newY = widget.position.y;
      let newW = widget.position.w;
      let newH = widget.position.h;

      // Handle different resize directions
      switch (direction) {
        case 'se': // Southeast - resize width and height
          newW = Math.max(minW, Math.min(Math.round((px - currentLeft) / cellW), layout.columns - widget.position.x));
          newH = Math.max(minH, Math.round((py - currentTop) / cellH));
          break;
        case 'e': // East - resize width only
          newW = Math.max(minW, Math.min(Math.round((px - currentLeft) / cellW), layout.columns - widget.position.x));
          break;
        case 's': // South - resize height only
          newH = Math.max(minH, Math.round((py - currentTop) / cellH));
          break;
        case 'sw': // Southwest - resize width and height, move x
          const newWidthSW = Math.max(minW, Math.round((currentRight - px) / cellW));
          newW = Math.min(newWidthSW, widget.position.x + widget.position.w);
          newX = Math.max(0, widget.position.x + widget.position.w - newW);
          newH = Math.max(minH, Math.round((py - currentTop) / cellH));
          break;
        case 'w': // West - resize width, move x
          const newWidthW = Math.max(minW, Math.round((currentRight - px) / cellW));
          newW = Math.min(newWidthW, widget.position.x + widget.position.w);
          newX = Math.max(0, widget.position.x + widget.position.w - newW);
          break;
        case 'nw': // Northwest - resize width and height, move x and y
          const newWidthNW = Math.max(minW, Math.round((currentRight - px) / cellW));
          newW = Math.min(newWidthNW, widget.position.x + widget.position.w);
          newX = Math.max(0, widget.position.x + widget.position.w - newW);
          const newHeightNW = Math.max(minH, Math.round((currentBottom - py) / cellH));
          newH = Math.min(newHeightNW, widget.position.y + widget.position.h);
          newY = Math.max(0, widget.position.y + widget.position.h - newH);
          break;
        case 'n': // North - resize height, move y
          const newHeightN = Math.max(minH, Math.round((currentBottom - py) / cellH));
          newH = Math.min(newHeightN, widget.position.y + widget.position.h);
          newY = Math.max(0, widget.position.y + widget.position.h - newH);
          break;
        case 'ne': // Northeast - resize width and height, move y
          newW = Math.max(minW, Math.min(Math.round((px - currentLeft) / cellW), layout.columns - widget.position.x));
          const newHeightNE = Math.max(minH, Math.round((currentBottom - py) / cellH));
          newH = Math.min(newHeightNE, widget.position.y + widget.position.h);
          newY = Math.max(0, widget.position.y + widget.position.h - newH);
          break;
      }

      return { w: newW, h: newH, x: newX, y: newY };
    };

    const handleMove = (me: PointerEvent) => {
      const { w, h, x, y } = calcSizeAndPosition(me.clientX, me.clientY);
      setResizeState(prev => prev ? {
        ...prev,
        previewW: w,
        previewH: h,
        previewX: x,
        previewY: y,
      } : null);
    };

    const handleUp = (ue: PointerEvent) => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      const { w, h, x, y } = calcSizeAndPosition(ue.clientX, ue.clientY);

      // Apply changes if dimensions or position changed
      if (w !== widget.position.w || h !== widget.position.h) {
        resizeWidget(widget.id, w, h);
      }
      if (x !== widget.position.x || y !== widget.position.y) {
        moveWidget(widget.id, x, y);
      }

      setResizeState(null);
    };

    // Set cursor based on direction
    const cursors: Record<ResizeDirection, string> = {
      'se': 'nwse-resize', 'sw': 'nesw-resize', 'nw': 'nwse-resize', 'ne': 'nesw-resize',
      'e': 'ew-resize', 'w': 'ew-resize', 'n': 'ns-resize', 's': 'ns-resize',
    };

    document.body.style.cursor = cursors[direction];
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  return (
    <div className="flex-1 flex min-h-0">
      {/* Canvas + toolbar column */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => {
                const trimmed = editTitle.trim();
                if (trimmed && trimmed !== title) setTitle(trimmed);
                else setEditTitle(title);
                setIsEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                if (e.key === 'Escape') { setEditTitle(title); setIsEditingTitle(false); }
              }}
              className="text-lg font-semibold text-[var(--text-primary)] bg-transparent border-b-2 border-accent-blue outline-none px-1 -ml-1 w-64"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setEditTitle(title); setIsEditingTitle(true); }}
              className="flex items-center gap-1.5 text-lg font-semibold text-[var(--text-primary)] hover:text-accent-blue transition-colors group/title"
              title="Click to rename"
            >
              {title}
              <Pencil size={12} className="text-[var(--text-muted)] opacity-0 group-hover/title:opacity-100 transition-opacity" />
            </button>
          )}
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
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-card)] transition-colors"
            title="Share dashboard"
          >
            <Share2 size={14} />
            <span className="hidden lg:inline">Share</span>
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard size={14} className="text-[var(--text-muted)]" />
          </button>
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
        <span>Demo mode — using sample data. Right-click to add widgets. Drag to move, corner to resize, double-click to edit config.</span>
      </div>

      {/* Widget grid */}
      <div
        className="flex-1 overflow-auto p-4 relative"
        onContextMenu={handleCanvasContextMenu}
        onClick={(e) => {
          // Click on empty canvas deselects
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-grid]')) {
            selectWidget(null);
            setConfigWidgetId(null);
          }
        }}
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
                onClick={(e) => { e.stopPropagation(); selectWidget(widget.id); }}
                onDoubleClick={(e) => { e.stopPropagation(); selectWidget(widget.id); setConfigWidgetId(widget.id); }}
                onContextMenu={(e) => handleWidgetContextMenu(e, widget)}
                style={{
                  gridColumn: `${(resizeState?.widgetId === widget.id ? resizeState.previewX : widget.position.x) + 1} / span ${resizeState?.widgetId === widget.id ? resizeState.previewW : widget.position.w}`,
                  gridRow: `${(resizeState?.widgetId === widget.id ? resizeState.previewY : widget.position.y) + 1} / span ${resizeState?.widgetId === widget.id ? resizeState.previewH : widget.position.h}`,
                }}
                className={`min-h-0 relative group transition-shadow ${
                  dragState?.widgetId === widget.id ? 'opacity-40 ring-2 ring-accent-blue/30 rounded-xl scale-[0.98]' : ''
                }${resizeState?.widgetId === widget.id ? ' ring-2 ring-accent-purple rounded-xl' : ''
                }${selectedWidgetId === widget.id && !dragState && !resizeState ? ' ring-2 ring-accent-cyan rounded-xl' : ''}`}
              >
                {/* Drag handle */}
                <div
                  onPointerDown={(e) => handleDragStart(e, widget)}
                  className="absolute top-1 left-1 z-10 p-1 rounded-md bg-[var(--bg-card)]/80 border border-[var(--border-color)] opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
                  title="Drag to reposition"
                >
                  <GripVertical size={12} className="text-[var(--text-muted)]" />
                </div>
                {/* Info/Explain button (top-right, third) */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleExplainMetric(widget); }}
                  className="absolute top-1 right-17 z-10 p-1.5 rounded-md bg-[var(--bg-card)]/90 border border-[var(--border-color)] opacity-90 hover:opacity-100 hover:bg-accent-purple/20 hover:border-accent-purple/40 transition-all"
                  title="Explain this metric"
                >
                  <HelpCircle size={12} className="text-[var(--text-secondary)] hover:text-accent-purple transition-colors" />
                </button>
                {/* Edit config button (top-right, second) */}
                <button
                  onClick={(e) => { e.stopPropagation(); selectWidget(widget.id); setConfigWidgetId(widget.id); }}
                  className="absolute top-1 right-9 z-10 p-1.5 rounded-md bg-[var(--bg-card)]/80 border border-[var(--border-color)] opacity-0 group-hover:opacity-100 hover:bg-accent-cyan/20 hover:border-accent-cyan/40 transition-all"
                  title="Edit widget config"
                >
                  <Settings2 size={12} className="text-[var(--text-muted)] hover:text-accent-cyan transition-colors" />
                </button>
                {/* Delete button (top-right) */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeWidget(widget.id); }}
                  className="absolute top-1 right-1 z-10 p-1.5 rounded-md bg-[var(--bg-card)]/80 border border-[var(--border-color)] opacity-0 group-hover:opacity-100 hover:bg-accent-red/20 hover:border-accent-red/40 transition-all"
                  title={`Delete ${widget.title}`}
                >
                  <Trash2 size={12} className="text-[var(--text-muted)] hover:text-accent-red transition-colors" />
                </button>
                {/* Enhanced resize handles (all edges and corners) */}
                <ResizeHandles
                  widget={widget}
                  isActive={resizeState?.widgetId === widget.id}
                  onResizeStart={(e, direction) => handleResizeStart(widget, direction)(e)}
                />
                <WidgetErrorBoundary
                  key={`err-${widget.id}-${widget.type}-${widget.dataConfig?.source || ''}`}
                  widgetTitle={widget.title}
                >
                  <WidgetRenderer
                    config={widget}
                    onDetailClick={setDetailWidget}
                    onExplainMetric={handleExplainMetric}
                  />
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

      {/* Modals — rendered outside the scroll container so fixed positioning works */}
      {showHelp && <ShortcutHelpOverlay onClose={() => setShowHelp(false)} />}
      {showShare && <ShareModal onClose={() => setShowShare(false)} />}
      {explainWidget && (
        <MetricExplanationModal
          widget={explainWidget}
          onClose={() => setExplainWidget(null)}
        />
      )}
      </div>

      {/* Widget config panel — slides in from right when editing */}
      {configWidgetId && (
        <WidgetConfigPanel
          widgetId={configWidgetId}
          onClose={() => setConfigWidgetId(null)}
        />
      )}
    </div>
  );
}
