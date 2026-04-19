'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search, Home, LayoutDashboard, BookOpen, Info, Plus,
  Settings, Moon, Sun, Keyboard, Users, Shield, FileText,
  ArrowRight, CornerDownLeft, ChevronUp, ChevronDown,
  Sparkles, Clock, Star, Command,
} from 'lucide-react';
import { Kbd } from '@/components/ui/Kbd';

// --- Types ---

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  category: 'navigation' | 'dashboard' | 'action' | 'admin' | 'recent';
  keywords: string[];
  shortcut?: string[];
  action: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  recent: 'Recent',
  navigation: 'Navigation',
  dashboard: 'Dashboards',
  action: 'Actions',
  admin: 'Admin',
};

const CATEGORY_ORDER = ['recent', 'navigation', 'dashboard', 'action', 'admin'];

// --- Recent items persistence ---

const RECENT_KEY = 'insighthub:command-palette:recent';
const MAX_RECENT = 5;

function getRecentIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

function pushRecent(id: string) {
  const ids = getRecentIds().filter(r => r !== id);
  ids.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
}

// --- Theme toggle helper ---

function toggleTheme() {
  const html = document.documentElement;
  const isCurrentlyLight = html.classList.contains('light');
  if (isCurrentlyLight) {
    html.classList.add('dark');
    html.classList.remove('light');
    localStorage.setItem('insighthub-theme', 'dark');
  } else {
    html.classList.add('light');
    html.classList.remove('dark');
    localStorage.setItem('insighthub-theme', 'light');
  }
}

function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');
}

// --- Component ---

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dashboards, setDashboards] = useState<{ id: string; title: string }[]>([]);

  // Fetch dashboards for the command index
  useEffect(() => {
    fetch('/api/dashboards?limit=20')
      .then(r => r.json())
      .then(data => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setDashboards((data.dashboards || []).map((d: any) => ({ id: d.id, title: d.title })));
      })
      .catch(() => {});
  }, []);

  // Build command list
  const allCommands: CommandItem[] = useMemo(() => {
    const nav = (path: string) => () => { onClose(); if (pathname !== path) router.push(path); };

    const commands: CommandItem[] = [
      // Navigation
      { id: 'nav:home', label: 'Go to Home', icon: Home, category: 'navigation', keywords: ['home', 'landing', 'start'], shortcut: ['mod', '1'], action: nav('/') },
      { id: 'nav:dashboards', label: 'Go to Dashboards', icon: LayoutDashboard, category: 'navigation', keywords: ['dashboards', 'gallery', 'browse', 'list'], shortcut: ['mod', '2'], action: nav('/dashboards') },
      { id: 'nav:glossary', label: 'Go to Glossary', icon: BookOpen, category: 'navigation', keywords: ['glossary', 'terms', 'definitions', 'dictionary'], shortcut: ['mod', '3'], action: nav('/glossary') },
      { id: 'nav:about', label: 'Go to About', icon: Info, category: 'navigation', keywords: ['about', 'info', 'help'], shortcut: ['mod', '4'], action: nav('/about') },

      // Dashboard actions
      { id: 'dash:new', label: 'New Dashboard', description: 'Create a blank dashboard with AI', icon: Plus, category: 'dashboard', keywords: ['new', 'create', 'blank', 'start', 'build'], shortcut: ['mod', '5'], action: nav('/dashboard/new') },

      // Individual dashboards
      ...dashboards.map(d => ({
        id: `dash:${d.id}`,
        label: `Open "${d.title}"`,
        icon: LayoutDashboard,
        category: 'dashboard' as const,
        keywords: [d.title.toLowerCase(), 'open', 'dashboard'],
        action: () => { onClose(); router.push(`/dashboard/${d.id}`); },
      })),

      // Actions
      {
        id: 'action:theme',
        label: isDarkTheme() ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        icon: isDarkTheme() ? Sun : Moon,
        category: 'action',
        keywords: ['theme', 'dark', 'light', 'mode', 'toggle', 'appearance'],
        action: () => { toggleTheme(); onClose(); },
      },
      {
        id: 'action:shortcuts',
        label: 'Keyboard Shortcuts',
        icon: Keyboard,
        category: 'action',
        keywords: ['keyboard', 'shortcuts', 'hotkeys', 'keys', 'help'],
        shortcut: ['?'],
        action: () => {
          onClose();
          // Trigger the shortcut overlay via a synthetic keypress
          setTimeout(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true })), 50);
        },
      },

      // Admin
      { id: 'admin:audit', label: 'Audit Log', icon: FileText, category: 'admin', keywords: ['audit', 'log', 'activity', 'history', 'compliance'], action: nav('/admin/audit') },
      { id: 'admin:permissions', label: 'Permission Groups', icon: Shield, category: 'admin', keywords: ['permissions', 'rbac', 'roles', 'access', 'security'], action: nav('/admin/permissions') },
      { id: 'admin:users', label: 'User Management', icon: Users, category: 'admin', keywords: ['users', 'team', 'people', 'manage', 'accounts'], action: nav('/admin/users') },
    ];

    return commands;
  }, [dashboards, onClose, pathname, router]);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) {
      // Show recent items first, then everything else
      const recentIds = getRecentIds();
      const recentItems = recentIds
        .map(id => allCommands.find(c => c.id === id))
        .filter(Boolean)
        .map(c => ({ ...c!, category: 'recent' as const }));

      const nonRecent = allCommands.filter(c => !recentIds.includes(c.id));
      return [...recentItems, ...nonRecent];
    }

    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/);

    return allCommands
      .map(cmd => {
        const searchText = [cmd.label, cmd.description || '', ...cmd.keywords].join(' ').toLowerCase();
        let score = 0;

        for (const word of words) {
          if (cmd.label.toLowerCase().includes(word)) score += 10;
          if (cmd.keywords.some(k => k.includes(word))) score += 5;
          if (searchText.includes(word)) score += 1;
        }

        // Exact label match bonus
        if (cmd.label.toLowerCase().startsWith(q)) score += 20;

        return { cmd, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.cmd);
  }, [query, allCommands]);

  // Group filtered items by category
  const grouped = useMemo(() => {
    const groups: { category: string; items: CommandItem[] }[] = [];
    const seen = new Set<string>();

    for (const cat of CATEGORY_ORDER) {
      const items = filtered.filter(c => c.category === cat && !seen.has(c.id));
      if (items.length > 0) {
        groups.push({ category: cat, items });
        items.forEach(i => seen.add(i.id));
      }
    }

    return groups;
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => grouped.flatMap(g => g.items), [grouped]);

  // Reset selected index when query changes
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(flatItems.length, 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + flatItems.length) % Math.max(flatItems.length, 1));
      return;
    }

    if (e.key === 'Enter' && flatItems.length > 0) {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) {
        pushRecent(item.id);
        item.action();
      }
      return;
    }
  }, [flatItems, selectedIndex, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const runItem = (item: CommandItem, idx: number) => {
    pushRecent(item.id);
    item.action();
  };

  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-xl mx-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl shadow-black/30 fade-in overflow-hidden flex flex-col max-h-[60vh]">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)]">
          <Search size={18} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-muted)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto py-2">
          {flatItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Sparkles size={24} className="mx-auto text-[var(--text-muted)] mb-2" />
              <p className="text-sm text-[var(--text-muted)]">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            grouped.map(group => {
              const items = group.items.map(item => {
                const idx = flatIdx++;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    data-index={idx}
                    onClick={() => runItem(item, idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      isSelected
                        ? 'bg-accent-blue/10 text-accent-blue'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <item.icon size={16} className={isSelected ? 'text-accent-blue' : 'text-[var(--text-muted)]'} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{item.label}</span>
                      {item.description && (
                        <span className="text-[11px] text-[var(--text-muted)] truncate block">{item.description}</span>
                      )}
                    </div>
                    {item.shortcut && (
                      <div className="shrink-0">
                        <Kbd keys={item.shortcut} variant="inline" />
                      </div>
                    )}
                    {isSelected && (
                      <CornerDownLeft size={12} className="text-accent-blue shrink-0" />
                    )}
                  </button>
                );
              });

              return (
                <div key={group.category}>
                  <div className="px-4 pt-2 pb-1">
                    <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      {group.category === 'recent' && <Clock size={10} className="inline mr-1 -mt-0.5" />}
                      {CATEGORY_LABELS[group.category] || group.category}
                    </span>
                  </div>
                  {items}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-[var(--border-color)] flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <ChevronUp size={10} />
            <ChevronDown size={10} />
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <CornerDownLeft size={10} />
            <span>select</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <span>esc</span>
            <span>close</span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Command size={10} />
            <span>K to toggle</span>
          </div>
        </div>
      </div>
    </div>
  );
}
