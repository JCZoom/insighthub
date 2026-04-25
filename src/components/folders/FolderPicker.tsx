'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Search,
  Check,
  Home,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FolderNode } from './FolderTree';

/**
 * FolderPicker — the single, reusable picker used for:
 *   - "Move to folder…"  (mode='single', includeRoot=true)
 *   - "Add to folder…"   (mode='multi',  includeRoot=false)
 *   - "Save / Save As / New Dashboard" folder selection (mode='single', includeRoot=true)
 *
 * Rendered as a centered modal (portaled to document.body) so it always sits
 * above the host UI regardless of overflow/z-index weirdness on the page that
 * triggered it.
 */

export interface FolderPickerProps {
  /** If provided, these folders are pre-loaded; otherwise the picker fetches /api/folders itself. */
  folders?: FolderNode[];
  /** Selection mode: pick exactly one (move/save) or pick any number (add aliases). */
  mode: 'single' | 'multi';
  /** Selected folder IDs to initialize the picker with. */
  initialSelection?: (string | null)[];
  /** IDs of folders that should be rendered as disabled (e.g. the primary folder when adding aliases). */
  disabledFolderIds?: string[];
  /** Show the "All Dashboards" (root, null) option. Default: true for single mode, false for multi. */
  includeRoot?: boolean;
  /** Title displayed at the top of the modal. */
  title?: string;
  /** Description under the title. */
  description?: string;
  /** Label for the primary confirm button. */
  confirmLabel?: string;
  /** Called when the user confirms their selection. For single mode, array has one element (or null for root). */
  onConfirm: (selection: (string | null)[]) => void | Promise<void>;
  /** Called when the user dismisses the picker. */
  onClose: () => void;
}

interface FlatRow {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  path: string; // "Exec / Q1 / Finance" — used for searching and for the subtitle chip
}

function flattenTree(folders: FolderNode[], depth = 0, parentPath = ''): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const f of folders) {
    const path = parentPath ? `${parentPath} / ${f.name}` : f.name;
    rows.push({ id: f.id, name: f.name, depth, parentId: f.parentId, path });
    if (f.children && f.children.length > 0) {
      rows.push(...flattenTree(f.children, depth + 1, path));
    }
  }
  return rows;
}

export function FolderPicker({
  folders: foldersProp,
  mode,
  initialSelection = [],
  disabledFolderIds = [],
  includeRoot,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: FolderPickerProps) {
  const [folders, setFolders] = useState<FolderNode[]>(foldersProp || []);
  const [loading, setLoading] = useState(!foldersProp);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Expand any folder whose id (or ancestor) is in the initial selection
    return new Set();
  });
  const [selection, setSelection] = useState<Set<string | null>>(() => new Set(initialSelection));
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const shouldIncludeRoot = includeRoot ?? mode === 'single';
  const disabledSet = useMemo(() => new Set(disabledFolderIds), [disabledFolderIds]);

  // Portal mount + focus search on open
  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => searchInputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Fetch folders if not provided
  useEffect(() => {
    if (foldersProp) {
      setFolders(foldersProp);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/folders');
        if (!res.ok) throw new Error('Failed to load folders');
        const { folders: flat } = await res.json();
        if (cancelled) return;
        setFolders(buildTree(flat));
      } catch {
        if (!cancelled) setFolders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [foldersProp]);

  // Auto-expand ancestors of any initially-selected folder
  useEffect(() => {
    if (!folders.length) return;
    const flat = flattenTree(folders);
    const byId = new Map(flat.map((r) => [r.id, r]));
    const next = new Set<string>();
    for (const sel of initialSelection) {
      if (!sel) continue;
      let cur = byId.get(sel)?.parentId ?? null;
      while (cur) {
        next.add(cur);
        cur = byId.get(cur)?.parentId ?? null;
      }
    }
    if (next.size > 0) setExpanded((prev) => new Set([...prev, ...next]));
  }, [folders, initialSelection]);

  const flatRows = useMemo(() => flattenTree(folders), [folders]);

  // When searching, show every matching folder flat (with breadcrumb path). Otherwise, tree view.
  const searching = search.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!searching) return [];
    const q = search.trim().toLowerCase();
    return flatRows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)
    );
  }, [flatRows, search, searching]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelect = useCallback(
    (id: string | null, disabled?: boolean) => {
      if (disabled) return;
      setSelection((prev) => {
        const next = new Set(prev);
        if (mode === 'single') {
          next.clear();
          next.add(id);
        } else {
          // null (root) is never a valid alias target in multi mode
          if (id === null) return prev;
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        return next;
      });
    },
    [mode]
  );

  const handleConfirm = useCallback(async () => {
    if (submitting) return;
    if (mode === 'single' && selection.size === 0) return;
    if (mode === 'multi' && selection.size === 0) return;
    setSubmitting(true);
    try {
      await onConfirm([...selection]);
    } finally {
      setSubmitting(false);
    }
  }, [mode, selection, onConfirm, submitting]);

  const confirmText =
    confirmLabel ?? (mode === 'single' ? 'Move here' : `Add to ${selection.size} folder${selection.size === 1 ? '' : 's'}`);

  const selectionCount = selection.size;
  const canConfirm = !submitting && selectionCount > 0;

  // Folder row renderer (shared between tree and search modes)
  const renderFolderRow = (
    row: { id: string | null; name: string; depth: number; subtitle?: string },
    opts: { disabled?: boolean; hasChildren?: boolean; isExpanded?: boolean } = {}
  ) => {
    const { id, name, depth, subtitle } = row;
    const { disabled, hasChildren, isExpanded } = opts;
    const selected = selection.has(id);
    return (
      <div
        key={id ?? '__root__'}
        className={cn(
          'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
          disabled && 'opacity-40 cursor-not-allowed',
          !disabled && selected && 'bg-accent-blue/15',
          !disabled && !selected && 'hover:bg-[var(--bg-card-hover)]'
        )}
        style={{ paddingLeft: `${8 + depth * 18}px` }}
        onClick={() => toggleSelect(id, disabled)}
        role="option"
        aria-selected={selected}
        aria-disabled={disabled}
      >
        {/* Expand chevron (tree mode only) */}
        {hasChildren !== undefined ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (id) toggleExpand(id);
            }}
            className={cn(
              'p-0.5 rounded hover:bg-[var(--bg-card)] shrink-0',
              !hasChildren && 'invisible'
            )}
          >
            {isExpanded ? (
              <ChevronDown size={12} className="text-[var(--text-muted)]" />
            ) : (
              <ChevronRight size={12} className="text-[var(--text-muted)]" />
            )}
          </button>
        ) : (
          <div className="w-[18px] shrink-0" />
        )}

        {/* Folder / home icon */}
        {id === null ? (
          <Home
            size={14}
            className={cn('shrink-0', selected ? 'text-accent-blue' : 'text-[var(--text-muted)]')}
          />
        ) : isExpanded ? (
          <FolderOpen size={14} className="text-accent-blue shrink-0" />
        ) : (
          <Folder
            size={14}
            className={cn('shrink-0', selected ? 'text-accent-blue' : 'text-[var(--text-muted)]')}
          />
        )}

        {/* Name + optional breadcrumb subtitle */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-sm truncate',
              selected ? 'text-accent-blue font-medium' : 'text-[var(--text-primary)]'
            )}
          >
            {name}
          </div>
          {subtitle && (
            <div className="text-[10px] text-[var(--text-muted)] truncate">{subtitle}</div>
          )}
        </div>

        {/* Selection indicator */}
        <div
          className={cn(
            'w-4 h-4 rounded flex items-center justify-center shrink-0',
            mode === 'multi' && 'border',
            mode === 'multi' && (selected ? 'bg-accent-blue border-accent-blue' : 'border-[var(--border-color)]'),
            mode === 'single' && (selected ? 'text-accent-blue' : 'text-transparent')
          )}
        >
          {selected && <Check size={mode === 'multi' ? 11 : 14} className={mode === 'multi' ? 'text-white' : ''} />}
        </div>
      </div>
    );
  };

  const renderTree = (nodes: FolderNode[], depth = 0) => {
    return nodes.map((n) => {
      const hasChildren = !!n.children && n.children.length > 0;
      const isExpanded = expanded.has(n.id);
      const disabled = disabledSet.has(n.id);
      return (
        <div key={n.id}>
          {renderFolderRow(
            { id: n.id, name: n.name, depth },
            { disabled, hasChildren, isExpanded }
          )}
          {isExpanded && hasChildren && renderTree(n.children!, depth + 1)}
        </div>
      );
    });
  };

  if (!mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[80vh] flex flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                <FolderPlus size={14} className="text-accent-blue" />
              </div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {title ?? (mode === 'single' ? 'Move to folder' : 'Add to folders')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          {description && (
            <p className="text-xs text-[var(--text-secondary)] pl-9">{description}</p>
          )}

          {/* Search */}
          <div className="relative mt-3">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search folders…"
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent-blue/50"
            />
          </div>
        </div>

        {/* Tree / results */}
        <div className="flex-1 overflow-y-auto px-2 py-2 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
              <Loader2 size={16} className="animate-spin mr-2" />
              <span className="text-xs">Loading folders…</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Folder size={28} className="text-[var(--text-muted)] opacity-40 mb-2" />
              <p className="text-xs text-[var(--text-muted)]">No folders yet</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                Create one from the dashboard gallery sidebar.
              </p>
            </div>
          ) : searching ? (
            <div role="listbox">
              {searchResults.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                  No folders match &quot;{search}&quot;
                </div>
              ) : (
                searchResults.map((r) =>
                  renderFolderRow(
                    {
                      id: r.id,
                      name: r.name,
                      depth: 0,
                      subtitle: r.depth > 0 ? r.path.slice(0, r.path.lastIndexOf(' / ')) : undefined,
                    },
                    { disabled: disabledSet.has(r.id) }
                  )
                )
              )}
            </div>
          ) : (
            <div role="listbox">
              {shouldIncludeRoot &&
                renderFolderRow({ id: null, name: 'All Dashboards (root)', depth: 0 }, {
                  hasChildren: false,
                })}
              {renderTree(folders)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border-color)] flex items-center justify-between gap-2 bg-[var(--bg-card)]/40">
          <div className="text-[11px] text-[var(--text-muted)]">
            {mode === 'multi' && selectionCount > 0 && (
              <>
                {selectionCount} folder{selectionCount === 1 ? '' : 's'} selected
              </>
            )}
            {mode === 'single' && selectionCount === 0 && 'Select a destination'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5',
                canConfirm
                  ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] cursor-not-allowed'
              )}
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// Local tree-builder mirrors the one in gallery-client so the picker can load
// folders on its own when no parent component has them cached.
function buildTree(flat: Array<Omit<FolderNode, 'children'> & { children?: FolderNode[] }>): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  for (const f of flat) byId.set(f.id, { ...f, children: [] });
  const roots: FolderNode[] = [];
  for (const f of flat) {
    const node = byId.get(f.id)!;
    if (f.parentId) {
      const parent = byId.get(f.parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }
  return roots;
}
