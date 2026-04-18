'use client';

import { useEffect } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';

interface KeyboardShortcutOptions {
  onSave?: () => void;
  onSearch?: () => void;
  onFocusChat?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions = {}) {
  const { undo, redo, canUndo, canRedo } = useDashboardStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Undo: Cmd+Z
      if (meta && !e.shiftKey && e.key === 'z') {
        if (isInput) return; // Don't override native undo in inputs
        e.preventDefault();
        if (canUndo) undo();
        return;
      }

      // Redo: Cmd+Shift+Z
      if (meta && e.shiftKey && e.key === 'z') {
        if (isInput) return;
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      // Save: Cmd+S
      if (meta && e.key === 's') {
        e.preventDefault();
        options.onSave?.();
        return;
      }

      // Search: Cmd+K
      if (meta && e.key === 'k') {
        e.preventDefault();
        options.onSearch?.();
        return;
      }

      // Focus chat: / (only when not in an input)
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        options.onFocusChat?.();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, options]);
}
