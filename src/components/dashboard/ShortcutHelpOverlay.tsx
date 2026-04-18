'use client';

import { useEffect, useCallback } from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutHelpOverlayProps {
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['⌘', 'S'], description: 'Save dashboard' },
      { keys: ['⌘', 'Z'], description: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
      { keys: ['⌘', '⇧', 'M'], description: 'Toggle voice input' },
      { keys: ['?'], description: 'Toggle this help' },
      { keys: ['/'], description: 'Focus chat input' },
    ],
  },
  {
    title: 'Widget Selection',
    shortcuts: [
      { keys: ['Tab'], description: 'Select next widget' },
      { keys: ['⇧', 'Tab'], description: 'Select previous widget' },
      { keys: ['Esc'], description: 'Deselect widget' },
    ],
  },
  {
    title: 'Widget Actions',
    shortcuts: [
      { keys: ['Delete'], description: 'Delete selected widget' },
      { keys: ['⌘', 'D'], description: 'Duplicate selected widget' },
      { keys: ['↑ ↓ ← →'], description: 'Nudge widget by 1 grid unit' },
    ],
  },
];

export function ShortcutHelpOverlay({ onClose }: ShortcutHelpOverlayProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === '?') {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl shadow-black/20 fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-accent-blue" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{group.title}</h3>
              <div className="space-y-1.5">
                {group.shortcuts.map(shortcut => (
                  <div key={shortcut.description} className="flex items-center justify-between py-1">
                    <span className="text-xs text-[var(--text-secondary)]">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i}>
                          <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] font-mono font-semibold text-[var(--text-primary)] shadow-sm">
                            {key}
                          </kbd>
                          {i < shortcut.keys.length - 1 && <span className="text-[var(--text-muted)] text-[10px] mx-0.5">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-[var(--border-color)] text-center">
          <p className="text-[10px] text-[var(--text-muted)]">Press <kbd className="px-1 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[9px] font-mono">?</kbd> or <kbd className="px-1 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[9px] font-mono">Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  );
}
