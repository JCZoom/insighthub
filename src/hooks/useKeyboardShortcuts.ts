'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';

interface KeyboardShortcutOptions {
  onSave?: () => void;
  onSearch?: () => void;
  onFocusChat?: () => void;
  onToggleHelp?: () => void;
  onToggleMic?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey;
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    const store = useDashboardStore.getState();

    // Undo: Cmd+Z
    if (meta && !e.shiftKey && e.key === 'z') {
      if (isInput) return;
      e.preventDefault();
      if (store.canUndo) store.undo();
      return;
    }

    // Redo: Cmd+Shift+Z or Cmd+Y
    if ((meta && e.shiftKey && e.key === 'z') || (meta && e.key === 'y')) {
      if (isInput) return;
      e.preventDefault();
      if (store.canRedo) store.redo();
      return;
    }

    // Save: Cmd+S
    if (meta && e.key === 's') {
      e.preventDefault();
      optionsRef.current.onSave?.();
      return;
    }

    // Duplicate: Cmd+D
    if (meta && e.key === 'd') {
      if (isInput) return;
      e.preventDefault();
      if (store.selectedWidgetId) store.duplicateWidget(store.selectedWidgetId);
      return;
    }

    // Delete: Backspace or Delete
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
      e.preventDefault();
      if (store.selectedWidgetId) {
        store.removeWidget(store.selectedWidgetId);
        store.selectWidget(null);
      }
      return;
    }

    // Escape: deselect widget
    if (e.key === 'Escape') {
      if (store.selectedWidgetId) {
        store.selectWidget(null);
        return;
      }
    }

    // Arrow keys: nudge selected widget
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isInput) {
      const wid = store.selectedWidgetId;
      if (!wid) return;
      const widget = store.schema.widgets.find(w => w.id === wid);
      if (!widget) return;
      e.preventDefault();
      const { x, y } = widget.position;
      const cols = store.schema.layout.columns;
      switch (e.key) {
        case 'ArrowUp':    store.moveWidget(wid, x, Math.max(0, y - 1)); break;
        case 'ArrowDown':  store.moveWidget(wid, x, y + 1); break;
        case 'ArrowLeft':  store.moveWidget(wid, Math.max(0, x - 1), y); break;
        case 'ArrowRight': store.moveWidget(wid, Math.min(cols - widget.position.w, x + 1), y); break;
      }
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
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
