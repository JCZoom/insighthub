'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { X, Keyboard } from 'lucide-react';

interface ShortcutItem {
  /** Use 'Mod' as a placeholder — resolved to ⌘ (Mac) or Ctrl (Win/Linux) at render time. */
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

// --- Shortcut definitions (use 'Mod' for ⌘/Ctrl, 'Shift' for ⇧/Shift) ---

const NAV_SHORTCUTS: ShortcutGroup = {
  title: 'Navigation',
  shortcuts: [
    { keys: ['Mod', '1'], description: 'Go to Home' },
    { keys: ['Mod', '2'], description: 'Go to My Dashboards' },
    { keys: ['Mod', '3'], description: 'Go to Glossary' },
    { keys: ['Mod', '4'], description: 'Go to About' },
    { keys: ['Mod', '5'], description: 'New Dashboard' },
    { keys: ['?'], description: 'Toggle this reference sheet' },
  ],
};

const HOME_SHORTCUTS: ShortcutGroup = {
  title: 'Home Page',
  shortcuts: [
    { keys: ['/'], description: 'Focus the prompt input' },
    { keys: ['Mod', 'Shift', 'M'], description: 'Toggle voice input' },
  ],
};

const DASHBOARD_SHORTCUTS: ShortcutGroup = {
  title: 'Dashboard Editor',
  shortcuts: [
    { keys: ['Mod', 'S'], description: 'Save dashboard' },
    { keys: ['Mod', 'Z'], description: 'Undo' },
    { keys: ['Mod', 'Shift', 'Z'], description: 'Redo' },
    { keys: ['/'], description: 'Focus chat input' },
    { keys: ['Mod', 'Shift', 'M'], description: 'Toggle voice input' },
    { keys: ['Tab'], description: 'Select next widget' },
    { keys: ['Shift', 'Tab'], description: 'Select previous widget' },
    { keys: ['Esc'], description: 'Deselect widget' },
    { keys: ['Delete'], description: 'Delete selected widget' },
    { keys: ['Mod', 'D'], description: 'Duplicate selected widget' },
    { keys: ['↑ ↓ ← →'], description: 'Nudge widget by 1 grid unit' },
  ],
};

const GALLERY_SHORTCUTS: ShortcutGroup = {
  title: 'Dashboards Gallery',
  shortcuts: [
    { keys: ['/'], description: 'Focus the search bar' },
    { keys: ['Alt', '←'], description: 'Previous tab' },
    { keys: ['Alt', '→'], description: 'Next tab' },
  ],
};

function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return true;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || '') ||
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform === 'macOS';
}

/** Resolve 'Mod' and 'Shift' to OS-specific symbols */
function resolveKey(key: string, mac: boolean): string {
  if (key === 'Mod') return mac ? '⌘' : 'Ctrl';
  if (key === 'Shift') return mac ? '⇧' : 'Shift';
  if (key === 'Alt') return mac ? '⌥' : 'Alt';
  if (key === 'Delete') return mac ? 'Delete' : 'Del';
  return key;
}

function resolveGroup(group: ShortcutGroup, mac: boolean): ShortcutGroup {
  return {
    ...group,
    shortcuts: group.shortcuts.map(s => ({
      ...s,
      keys: s.keys.map(k => resolveKey(k, mac)),
    })),
  };
}

function getContextualGroups(pathname: string, mac: boolean): ShortcutGroup[] {
  const groups: ShortcutGroup[] = [NAV_SHORTCUTS];

  if (pathname === '/') {
    groups.push(HOME_SHORTCUTS);
  } else if (pathname.startsWith('/dashboard/')) {
    groups.push(DASHBOARD_SHORTCUTS);
  } else if (pathname === '/dashboards') {
    groups.push(GALLERY_SHORTCUTS);
  }

  return groups.map(g => resolveGroup(g, mac));
}

interface GlobalShortcutOverlayProps {
  onClose: () => void;
}

export function GlobalShortcutOverlay({ onClose }: GlobalShortcutOverlayProps) {
  const pathname = usePathname();
  const [mac] = useState(() => isMacOS());
  const groups = getContextualGroups(pathname, mac);

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl shadow-black/20 fade-in max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
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
        <div className="p-6 space-y-5 overflow-y-auto">
          {groups.map(group => (
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
        <div className="px-6 py-3 border-t border-[var(--border-color)] text-center shrink-0">
          <p className="text-[10px] text-[var(--text-muted)]">Press <kbd className="px-1 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[9px] font-mono">?</kbd> or <kbd className="px-1 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[9px] font-mono">Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  );
}
