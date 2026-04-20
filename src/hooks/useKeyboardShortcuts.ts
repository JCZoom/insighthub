'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';

interface KeyboardShortcutOptions {
  onSave?: () => void;
  onSaveAs?: () => void;
  onSearch?: () => void;
  onFocusChat?: () => void;
  onToggleHelp?: () => void;
  onToggleMic?: () => void;
  onTogglePresentationMode?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Guard: prevent double-handling when multiple hook instances are active
    // (e.g. DashboardCanvas + editor page both call useKeyboardShortcuts)
    if ((e as any).__insightHubHandled) return;

    const meta = e.metaKey || e.ctrlKey;
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    const store = useDashboardStore.getState();

    // Undo: Cmd+Z
    if (meta && !e.shiftKey && e.key === 'z') {
      if (isInput) return;
      e.preventDefault();
      if (store.canUndo) store.undo();
      (e as any).__insightHubHandled = true;
      return;
    }

    // Redo: Cmd+Shift+Z or Cmd+Y
    if ((meta && e.shiftKey && (e.key === 'z' || e.key === 'Z')) || (meta && e.key === 'y')) {
      if (isInput) return;
      e.preventDefault();
      if (store.canRedo) store.redo();
      (e as any).__insightHubHandled = true;
      return;
    }

    // Save As: Cmd+Shift+S
    if (meta && e.shiftKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      optionsRef.current.onSaveAs?.();
      (e as any).__insightHubHandled = true;
      return;
    }

    // Save: Cmd+S
    if (meta && !e.shiftKey && e.key === 's') {
      e.preventDefault();
      optionsRef.current.onSave?.();
      (e as any).__insightHubHandled = true;
      return;
    }

    // Duplicate: Cmd+D
    if (meta && e.key === 'd') {
      if (isInput) return;
      e.preventDefault();
      if (store.selectedWidgetId) store.duplicateWidget(store.selectedWidgetId);
      (e as any).__insightHubHandled = true;
      return;
    }

    // Delete: Backspace or Delete
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
      e.preventDefault();
      if (store.selectedWidgetIds.length > 1) {
        store.removeWidgets(store.selectedWidgetIds);
      } else if (store.selectedWidgetId) {
        store.removeWidget(store.selectedWidgetId);
        store.selectWidget(null);
      }
      (e as any).__insightHubHandled = true;
      return;
    }

    // Escape: deselect widget
    if (e.key === 'Escape') {
      if (store.selectedWidgetId) {
        store.selectWidget(null);
        (e as any).__insightHubHandled = true;
        return;
      }
    }

    // Arrow keys: nudge selected widget(s)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isInput) {
      const ids = store.selectedWidgetIds;
      if (ids.length === 0) return;
      e.preventDefault();
      const cols = store.schema.layout.columns;
      if (ids.length > 1) {
        const moves = ids.map(id => {
          const w = store.schema.widgets.find(wg => wg.id === id);
          if (!w) return null;
          const { x, y } = w.position;
          switch (e.key) {
            case 'ArrowUp':    return { id, x, y: Math.max(0, y - 1) };
            case 'ArrowDown':  return { id, x, y: y + 1 };
            case 'ArrowLeft':  return { id, x: Math.max(0, x - 1), y };
            case 'ArrowRight': return { id, x: Math.min(cols - w.position.w, x + 1), y };
            default: return null;
          }
        }).filter((m): m is {id: string; x: number; y: number} => m !== null);
        if (moves.length > 0) store.moveWidgets(moves);
      } else {
        const widget = store.schema.widgets.find(w => w.id === ids[0]);
        if (!widget) return;
        const { x, y } = widget.position;
        switch (e.key) {
          case 'ArrowUp':    store.moveWidget(ids[0], x, Math.max(0, y - 1)); break;
          case 'ArrowDown':  store.moveWidget(ids[0], x, y + 1); break;
          case 'ArrowLeft':  store.moveWidget(ids[0], Math.max(0, x - 1), y); break;
          case 'ArrowRight': store.moveWidget(ids[0], Math.min(cols - widget.position.w, x + 1), y); break;
        }
      }
      (e as any).__insightHubHandled = true;
      return;
    }

    // Tab: cycle widget selection
    if (e.key === 'Tab' && !isInput) {
      const widgets = store.schema.widgets;
      if (widgets.length === 0) return;
      e.preventDefault();
      const currentIdx = widgets.findIndex(w => w.id === store.selectedWidgetId);
      const nextIdx = e.shiftKey
        ? (currentIdx <= 0 ? widgets.length - 1 : currentIdx - 1)
        : (currentIdx + 1) % widgets.length;
      store.selectWidget(widgets[nextIdx].id);
      (e as any).__insightHubHandled = true;
      return;
    }

    // Search: Cmd+K
    if (meta && e.key === 'k') {
      e.preventDefault();
      optionsRef.current.onSearch?.();
      return;
    }

    // Focus chat: / (only when not in an input)
    if (e.key === '/' && !isInput) {
      e.preventDefault();
      optionsRef.current.onFocusChat?.();
      return;
    }

    // Help overlay: ? (only when not in an input)
    if (e.key === '?' && !isInput) {
      e.preventDefault();
      optionsRef.current.onToggleHelp?.();
      return;
    }

    // Voice input: Cmd+Shift+M
    if (meta && e.shiftKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      optionsRef.current.onToggleMic?.();
      return;
    }

    // Presentation mode: F5
    if (e.key === 'F5') {
      e.preventDefault();
      optionsRef.current.onTogglePresentationMode?.();
      return;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
