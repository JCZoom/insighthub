'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { WidgetRenderer } from './WidgetRenderer';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';
import { WidgetDetailOverlay } from './WidgetDetailOverlay';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { ShortcutHelpOverlay } from './ShortcutHelpOverlay';
import { ShareModal } from './ShareModal';
import { ContextMenu, getCanvasActions, getWidgetActions, useLongPressContextMenu, type ContextMenuAction } from './ContextMenu';
import { MetricExplanationModal } from './MetricExplanationModal';
import { ResizeHandles, type ResizeDirection } from './ResizeHandles';
import { getMinWidgetSize } from '@/components/widgets/widget-utils';
import type { WidgetConfig, FilterConfig } from '@/types';
import { useRouter } from 'next/navigation';
import { Undo2, Redo2, Save, Info, Check, Library, Loader2, GripVertical, Trash2, Pencil, Share2, Keyboard, Settings2, HelpCircle, Filter, X, Download, Camera, Image as ImageIcon, ChevronDown, Copy, BookOpen } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTouchDrag } from '@/hooks/useTouchDrag';
import { isTouchDevice, getTouchTargetSize } from '@/lib/touch-utils';
import { cn } from '@/lib/utils';
import { generateChangeSummaryFromHistory } from '@/lib/ai/change-summarizer';
import { exportToPNG, exportToSVG } from '@/lib/export-utils';

interface DashboardCanvasProps {
  onToggleLibrary?: () => void;
  isLibraryOpen?: boolean;
  onToggleGlossary?: () => void;
  isGlossaryOpen?: boolean;
}

export function DashboardCanvas({ onToggleLibrary, isLibraryOpen, onToggleGlossary, isGlossaryOpen }: DashboardCanvasProps) {
  const {
    schema, title, canUndo, canRedo, isDirty, isAiWorking, selectedWidgetId, selectedWidgetIds,
    undo, redo, addWidget, removeWidget, updateWidget, duplicateWidget, moveWidget, moveWidgets, resizeWidget, setTitle, selectWidget, selectWidgets, toggleSelection, addGlobalFilter, removeGlobalFilter, clearGlobalFilters,
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [marqueeState, setMarqueeState] = useState<{
    startX: number; startY: number;
    currentX: number; currentY: number;
    containerRect: DOMRect;
  } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isTouch] = useState(() => isTouchDevice());
  const [dragHoldState, setDragHoldState] = useState<{
    widgetId: string;
    isHolding: boolean;
  } | null>(null);

  // Track active event listeners for cleanup on unmount
  const activeListenersRef = useRef<{
    pointermove?: (event: PointerEvent) => void;
    pointerup?: (event: PointerEvent) => void;
  }>({});

  const router = useRouter();

  // Long press context menu support
  const { createLongPressHandler, LongPressRing } = useLongPressContextMenu();

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      // Remove any remaining event listeners
      if (activeListenersRef.current.pointermove) {
        document.removeEventListener('pointermove', activeListenersRef.current.pointermove);
      }
      if (activeListenersRef.current.pointerup) {
        document.removeEventListener('pointerup', activeListenersRef.current.pointerup);
      }
      // Reset body styles
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: () => handleSave(),
    onSaveAs: () => handleSaveAs(),
    onToggleHelp: () => setShowHelp(prev => !prev),
  });

  // Handle explain metric requests
  const handleExplainMetric = useCallback((widget: WidgetConfig) => {
    setExplainWidget(widget);
  }, []);

  // Handle chart clicks for filtering
  const handleChartClick = useCallback((field: string, value: unknown) => {
    // Create a filter config for the clicked data point
    const filterConfig: FilterConfig = {
      field,
      label: `${field}: ${String(value)}`,
      type: 'select',
      defaultValue: value,
      options: [{ label: String(value), value: String(value) }],
    };
    addGlobalFilter(filterConfig);
    toast({ type: 'success', title: 'Filter applied', description: `Filtering by ${field}: ${String(value)}` });
  }, [addGlobalFilter, toast]);

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

  const handleSaveAs = async () => {
    const store = useDashboardStore.getState();
    const { schema: currentSchema, title: currentTitle, initialize } = store;
    const copyTitle = currentTitle.replace(/\s*\(Copy(?: \d+)?\)$/, '') + ' (Copy)';
    setSaveStatus('saving');
    setShowSaveMenu(false);
    try {
      const createRes = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: copyTitle, schema: currentSchema }),
      });
      if (!createRes.ok) {
        toast({ type: 'error', title: 'Save As failed', description: 'Could not create dashboard copy.' });
        setSaveStatus('idle');
        return;
      }
      const { dashboard } = await createRes.json();
      initialize(dashboard.id, copyTitle, currentSchema);
      router.replace(`/dashboard/${dashboard.id}`);
      setSaveStatus('saved');
      toast({ type: 'success', title: 'Saved as new dashboard!', description: `"${copyTitle}" created in your gallery.` });
    } catch {
      toast({ type: 'error', title: 'Save As failed', description: 'Network error.' });
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

  // --- Marquee (lasso) multi-select with touch optimization ---
  const handleMarqueeStart = (e: React.PointerEvent) => {
    // For touch devices, require longer hold to distinguish from scroll
    const isTouch = e.pointerType !== 'mouse';

    // Only start marquee on primary pointer (left-click or first touch)
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't start if clicking on a widget or interactive element
    if (target.closest('[data-widget-id]') || target.closest('button') || target.closest('a')) return;
    // Only start on the container or grid background
    if (!scrollContainerRef.current) return;

    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    const startTime = Date.now();
    const holdThreshold = isTouch ? 200 : 0; // Require short hold on touch to avoid conflict with scroll
    let hasStartedMarquee = false;

    const startMarquee = () => {
      if (hasStartedMarquee) return;
      hasStartedMarquee = true;
      setMarqueeState({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        containerRect,
      });
    };

    // For mouse, start immediately
    if (!isTouch) {
      startMarquee();
    }

    const handleMove = (me: PointerEvent) => {
      const timeSinceStart = Date.now() - startTime;
      const dx = Math.abs(me.clientX - e.clientX);
      const dy = Math.abs(me.clientY - e.clientY);
      const movement = Math.sqrt(dx * dx + dy * dy);

      // For touch, check if we should start marquee based on time and movement
      if (isTouch && !hasStartedMarquee && timeSinceStart >= holdThreshold && movement < 20) {
        startMarquee();
      }

      // If marquee has started, update it
      if (hasStartedMarquee) {
        setMarqueeState(prev => prev ? { ...prev, currentX: me.clientX, currentY: me.clientY } : null);
      }
    };

    const handleUp = () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      activeListenersRef.current.pointermove = undefined;
      activeListenersRef.current.pointerup = undefined;

      // Compute which widgets are inside the marquee
      setMarqueeState(prev => {
        if (!prev || !gridRef.current) return null;
        const minX = Math.min(prev.startX, prev.currentX);
        const maxX = Math.max(prev.startX, prev.currentX);
        const minY = Math.min(prev.startY, prev.currentY);
        const maxY = Math.max(prev.startY, prev.currentY);
        // Only count as marquee if dragged at least 10px
        if (maxX - minX < 10 && maxY - minY < 10) {
          // This was a click, not a drag — deselect
          selectWidget(null);
          setConfigWidgetId(null);
          return null;
        }
        const selected: string[] = [];
        for (const w of widgets) {
          const el = document.getElementById(`widget-${w.id}`);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          // Check overlap (not full containment — partial overlap selects)
          if (rect.right > minX && rect.left < maxX && rect.bottom > minY && rect.top < maxY) {
            selected.push(w.id);
          }
        }
        if (selected.length > 0) {
          selectWidgets(selected);
        } else {
          selectWidget(null);
        }
        return null;
      });
    };

    activeListenersRef.current.pointermove = handleMove;
    activeListenersRef.current.pointerup = handleUp;
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  // --- Drag-and-drop (supports multi-selection) with touch optimization ---
  const createDragHandler = (widget: WidgetConfig) => {
    const isMultiDrag = selectedWidgetIds.length > 1 && selectedWidgetIds.includes(widget.id);

    return useTouchDrag({
      holdThreshold: isTouch ? 300 : 0,
      onHoldStart: () => {
        setDragHoldState({ widgetId: widget.id, isHolding: true });
        // Haptic feedback for hold start
        if ('vibrate' in navigator) {
          navigator.vibrate([20]);
        }
      },
      onHoldEnd: () => {
        setDragHoldState(null);
      },
      onDragStart: (e: PointerEvent) => {
        setDragHoldState(null);
        setDragState({
          widgetId: widget.id,
          startX: e.clientX,
          startY: e.clientY,
          origX: widget.position.x,
          origY: widget.position.y,
          ghostX: widget.position.x,
          ghostY: widget.position.y,
        });
      },
      onDragMove: (me: PointerEvent) => {
        if (!gridRef.current || !dragState) return;
        const gridRect = gridRef.current.getBoundingClientRect();
        const cellW = gridRect.width / layout.columns;
        const cellH = layout.rowHeight + layout.gap;
        const dx = me.clientX - dragState.startX;
        const dy = me.clientY - dragState.startY;
        const newX = Math.max(0, Math.min(layout.columns - widget.position.w, Math.round(widget.position.x + dx / cellW)));
        const newY = Math.max(0, Math.round(widget.position.y + dy / cellH));
        setDragState(prev => prev ? { ...prev, ghostX: newX, ghostY: newY } : null);
      },
      onDragEnd: (ue: PointerEvent) => {
        if (!gridRef.current || !dragState) {
          setDragState(null);
          return;
        }
        const gridRect = gridRef.current.getBoundingClientRect();
        const cellW = gridRect.width / layout.columns;
        const cellH = layout.rowHeight + layout.gap;
        const dx = ue.clientX - dragState.startX;
        const dy = ue.clientY - dragState.startY;
        const deltaCol = Math.round(dx / cellW);
        const deltaRow = Math.round(dy / cellH);

        if (deltaCol !== 0 || deltaRow !== 0) {
          if (isMultiDrag) {
            // Move all selected widgets by the same delta
            const store = useDashboardStore.getState();
            const moves = selectedWidgetIds.map(id => {
              const w = store.schema.widgets.find(wg => wg.id === id);
              if (!w) return null;
              return {
                id,
                x: Math.max(0, Math.min(layout.columns - w.position.w, w.position.x + deltaCol)),
                y: Math.max(0, w.position.y + deltaRow),
              };
            }).filter((m): m is {id: string; x: number; y: number} => m !== null);
            if (moves.length > 0) moveWidgets(moves);
          } else {
            const newX = Math.max(0, Math.min(layout.columns - widget.position.w, widget.position.x + deltaCol));
            const newY = Math.max(0, widget.position.y + deltaRow);
            moveWidget(widget.id, newX, newY);
          }
        }
        setDragState(null);
      },
      enableMouseDrag: true,
    });
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
      // Clear from active listeners tracking
      activeListenersRef.current.pointermove = undefined;
      activeListenersRef.current.pointerup = undefined;

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

    // Track listeners for cleanup
    activeListenersRef.current.pointermove = handleMove;
    activeListenersRef.current.pointerup = handleUp;

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  return (
    <div className="flex-1 flex min-h-0">
      {/* Canvas + toolbar column */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Toolbar */}
      <div className="relative z-20 flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50 backdrop-blur-sm">
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
          {schema.globalFilters.length > 0 && (
            <div className="flex items-center gap-1.5">
              {schema.globalFilters.map((filter) => (
                <span key={filter.field} className="flex items-center gap-1 pill pill-cyan text-xs">
                  <Filter size={10} />
                  {filter.label}
                  <button
                    onClick={() => removeGlobalFilter(filter.field)}
                    className="ml-1 hover:bg-white/20 rounded px-1 transition-colors"
                    title="Remove filter"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              {schema.globalFilters.length > 1 && (
                <button
                  onClick={clearGlobalFilters}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  title="Clear all filters"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 rounded-lg hover:bg-[var(--bg-card)] disabled:opacity-30 transition-colors"
            title="Undo (⌘Z / Ctrl+Z)"
          >
            <Undo2 size={16} className="text-[var(--text-secondary)]" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 rounded-lg hover:bg-[var(--bg-card)] disabled:opacity-30 transition-colors"
            title="Redo (⌘⇧Z / Ctrl+Shift+Z)"
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
              title="Browse Widget Library (L)"
            >
              <Library size={14} />
              <span className="hidden lg:inline">Widgets</span>
            </button>
          )}
          {onToggleGlossary && (
            <button
              onClick={onToggleGlossary}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isGlossaryOpen
                  ? 'bg-accent-purple/10 text-accent-purple'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
              }`}
              title="Glossary reference panel"
            >
              <BookOpen size={14} />
              <span className="hidden lg:inline">Glossary</span>
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
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-card)] transition-colors"
              title="Export dashboard"
            >
              <Download size={14} />
              <span className="hidden lg:inline">Export</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl shadow-black/20 py-1">
                  <button
                    onClick={() => { exportToPNG('dashboard-grid', `${title.replace(/[^a-zA-Z0-9]/g, '_')}_dashboard`); setShowExportMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <Camera size={12} /> Export Dashboard as PNG
                  </button>
                  <button
                    onClick={() => { exportToSVG('dashboard-grid', `${title.replace(/[^a-zA-Z0-9]/g, '_')}_dashboard`); setShowExportMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <ImageIcon size={12} /> Export Dashboard as SVG
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
            title="Keyboard shortcuts (?) • ⌘K palette"
          >
            <Keyboard size={14} className="text-[var(--text-muted)]" />
          </button>
          <div className="relative flex items-center">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg bg-accent-green/10 text-accent-green text-sm font-medium hover:bg-accent-green/20 transition-colors disabled:opacity-50"
              title="Save dashboard (⌘S / Ctrl+S)"
            >
              {saveStatus === 'saving' ? <Loader2 size={14} className="animate-spin" /> : saveStatus === 'saved' ? <Check size={14} /> : <Save size={14} />}
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => setShowSaveMenu(prev => !prev)}
              className="flex items-center px-2 py-1.5 rounded-r-lg bg-accent-green/10 text-accent-green hover:bg-accent-green/20 transition-colors border-l border-accent-green/20"
              title="Save options"
            >
              <ChevronDown size={12} />
            </button>
            {showSaveMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSaveMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl shadow-black/20 py-1">
                  <button
                    onClick={handleSaveAs}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors"
                    title="Save as new dashboard (⌘⇧S / Ctrl+Shift+S)"
                  >
                    <Copy size={12} /> Save As…
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Demo mode banner */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-accent-amber/5 border-b border-accent-amber/20 text-xs text-accent-amber">
        <Info size={12} />
        <span>Demo mode — using sample data. Right-click to add widgets. Drag to move, corner to resize, double-click to edit config.</span>
      </div>

      {/* Widget grid */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-4 relative"
        onContextMenu={handleCanvasContextMenu}
        onPointerDown={handleMarqueeStart}
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
            id="dashboard-grid"
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
              gridAutoRows: `${layout.rowHeight}px`,
            }}
          >
            {/* Drag ghost outline(s) — shows destination for all selected widgets during multi-drag */}
            {dragState && (() => {
              const draggedWidget = widgets.find(w => w.id === dragState.widgetId);
              if (!draggedWidget) return null;
              const deltaCol = dragState.ghostX - draggedWidget.position.x;
              const deltaRow = dragState.ghostY - draggedWidget.position.y;
              const isMulti = selectedWidgetIds.length > 1 && selectedWidgetIds.includes(dragState.widgetId);
              if (isMulti) {
                return selectedWidgetIds.map(id => {
                  const w = widgets.find(wg => wg.id === id);
                  if (!w) return null;
                  const ghostX = Math.max(0, Math.min(layout.columns - w.position.w, w.position.x + deltaCol));
                  const ghostY = Math.max(0, w.position.y + deltaRow);
                  return (
                    <div
                      key={`ghost-${id}`}
                      style={{
                        gridColumn: `${ghostX + 1} / span ${w.position.w}`,
                        gridRow: `${ghostY + 1} / span ${w.position.h}`,
                      }}
                      className="rounded-xl border-2 border-dashed border-accent-blue/50 bg-accent-blue/5 pointer-events-none transition-all duration-100"
                    />
                  );
                });
              }
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

            {widgets.map((widget: WidgetConfig) => {
              const isSelected = selectedWidgetIds.includes(widget.id);
              const isMultiSelected = isSelected && selectedWidgetIds.length > 1;
              const isDragging = dragState?.widgetId === widget.id;
              const isMultiDragging = isDragging && selectedWidgetIds.length > 1 && isSelected;
              const isResizing = resizeState?.widgetId === widget.id;
              return (
              <div
                key={widget.id}
                id={`widget-${widget.id}`}
                data-widget-id={widget.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (e.shiftKey || e.metaKey) {
                    toggleSelection(widget.id);
                  } else {
                    selectWidget(widget.id);
                  }
                }}
                onDoubleClick={(e) => { e.stopPropagation(); selectWidget(widget.id); setConfigWidgetId(widget.id); }}
                onContextMenu={(e) => handleWidgetContextMenu(e, widget)}
                style={{
                  gridColumn: `${(isResizing ? resizeState.previewX : widget.position.x) + 1} / span ${isResizing ? resizeState.previewW : widget.position.w}`,
                  gridRow: `${(isResizing ? resizeState.previewY : widget.position.y) + 1} / span ${isResizing ? resizeState.previewH : widget.position.h}`,
                }}
                className={`min-h-0 relative group transition-shadow ${
                  isDragging ? 'opacity-40 ring-2 ring-accent-blue/30 rounded-xl scale-[0.98]' : ''
                }${isMultiDragging ? '' : ''}${
                  isResizing ? ' ring-2 ring-accent-purple rounded-xl' : ''
                }${isSelected && !isDragging && !isResizing ? (isMultiSelected ? ' ring-2 ring-accent-blue rounded-xl' : ' ring-2 ring-accent-cyan rounded-xl') : ''
                }${isMultiDragging === false && isSelected && selectedWidgetIds.length > 1 && dragState && !isDragging ? ' opacity-60 ring-2 ring-accent-blue/30 rounded-xl scale-[0.98]' : ''}`}
              >
                {/* Drag handle - larger and more accessible for touch */}
                <div
                  {...createDragHandler(widget)}
                  {...createLongPressHandler((e: PointerEvent) => {
                    handleWidgetContextMenu(
                      { clientX: e.clientX, clientY: e.clientY, preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent,
                      widget
                    );
                  })}
                  className={cn(
                    "absolute top-1 left-1 z-10 rounded-md bg-[var(--bg-card)]/80 border border-[var(--border-color)] cursor-grab active:cursor-grabbing transition-all",
                    isTouch
                      ? "p-2 opacity-80" // Always visible and larger on touch
                      : "p-1 opacity-0 group-hover:opacity-100", // Hover behavior on desktop
                    dragHoldState?.widgetId === widget.id && dragHoldState.isHolding
                      ? "scale-110 bg-accent-blue/20 border-accent-blue/40"
                      : ""
                  )}
                  style={{
                    minWidth: isTouch ? getTouchTargetSize() + 'px' : 'auto',
                    minHeight: isTouch ? getTouchTargetSize() + 'px' : 'auto',
                  }}
                  title={isTouch ? "Drag to reposition • Long press for menu" : "Drag to reposition"}
                >
                  <GripVertical size={isTouch ? 16 : 12} className="text-[var(--text-muted)]" />
                </div>
                {/* Glossary terms badge */}
                {widget.glossaryTermIds && widget.glossaryTermIds.length > 0 && (
                  <div
                    className="absolute bottom-1 left-1 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-purple/10 border border-accent-purple/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`${widget.glossaryTermIds.length} glossary term${widget.glossaryTermIds.length !== 1 ? 's' : ''} linked`}
                  >
                    <BookOpen size={9} className="text-accent-purple" />
                    <span className="text-[9px] font-medium text-accent-purple">{widget.glossaryTermIds.length}</span>
                  </div>
                )}
                {/* Download/export button (top-right, fourth) */}
                <button
                  onClick={(e) => { e.stopPropagation(); exportToPNG(`widget-${widget.id}`, `${widget.title.replace(/[^a-zA-Z0-9]/g, '_')}_widget`); }}
                  className="absolute top-1 right-[6.5rem] z-10 p-1.5 rounded-md bg-[var(--bg-card)]/80 border border-[var(--border-color)] opacity-0 group-hover:opacity-100 hover:bg-accent-green/20 hover:border-accent-green/40 transition-all"
                  title="Export widget as PNG"
                >
                  <Download size={12} className="text-[var(--text-muted)] hover:text-accent-green transition-colors" />
                </button>
                {/* Info/Explain button (top-right, third) */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleExplainMetric(widget); }}
                  className="absolute top-1 right-17 z-10 p-1.5 rounded-md bg-[var(--bg-card)]/80 border border-[var(--border-color)] opacity-0 group-hover:opacity-100 hover:bg-accent-purple/20 hover:border-accent-purple/40 transition-all"
                  title="Explain this metric"
                >
                  <HelpCircle size={12} className="text-[var(--text-muted)] hover:text-accent-purple transition-colors" />
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
                  title={`Delete ${widget.title} (Del)`}
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
                    onChartClick={handleChartClick}
                  />
                </WidgetErrorBoundary>
              </div>
              );
            })}
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

        {/* Marquee selection rectangle */}
        {marqueeState && (() => {
          const left = Math.min(marqueeState.startX, marqueeState.currentX) - marqueeState.containerRect.left;
          const top = Math.min(marqueeState.startY, marqueeState.currentY) - marqueeState.containerRect.top + (scrollContainerRef.current?.scrollTop || 0);
          const width = Math.abs(marqueeState.currentX - marqueeState.startX);
          const height = Math.abs(marqueeState.currentY - marqueeState.startY);
          if (width < 5 && height < 5) return null;
          return (
            <div
              className="absolute border-2 border-accent-blue/60 bg-accent-blue/10 rounded-sm pointer-events-none z-40"
              style={{ left, top, width, height }}
            />
          );
        })()}

        {/* Multi-selection count badge */}
        {selectedWidgetIds.length > 1 && !dragState && (
          <div className="absolute top-2 left-2 z-40 px-2 py-1 rounded-lg bg-accent-blue/90 text-white text-xs font-medium shadow-lg pointer-events-none">
            {selectedWidgetIds.length} widgets selected
          </div>
        )}

        {/* Long press ring indicator */}
        <LongPressRing />

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
