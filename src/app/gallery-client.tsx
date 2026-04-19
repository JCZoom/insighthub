'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Search, LayoutGrid, List, FolderOpen, Star, Users, BookTemplate, Building2, ArrowUpDown, Plus, ChevronDown, ChevronRight, Clock, Filter, X, Folder } from 'lucide-react';
import { DashboardCard, type DashboardCardData } from '@/components/gallery/DashboardCard';
import { FolderTree, type FolderNode } from '@/components/folders/FolderTree';
import { FolderBreadcrumbs, buildBreadcrumbs } from '@/components/folders/FolderBreadcrumbs';
import { FolderManager } from '@/components/folders/FolderManager';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Use fixed dates to avoid SSR/client hydration mismatches (Date.now() differs between server and client)
const INITIAL_DASHBOARDS: DashboardCardData[] = [
  {
    id: 'template-exec',
    title: 'Executive Summary',
    description: 'Key business metrics at a glance — MRR, churn, CSAT, and pipeline overview.',
    tags: ['revenue', 'churn', 'executive'],
    ownerName: 'InsightHub',
    updatedAt: new Date('2026-04-16T12:00:00'),
    widgetCount: 8,
    isTemplate: true,
    isFavorite: true,
  },
  {
    id: 'template-support',
    title: 'Support Operations',
    description: 'Ticket volume, resolution times, CSAT scores, and team performance.',
    tags: ['support', 'tickets', 'csat'],
    ownerName: 'InsightHub',
    updatedAt: new Date('2026-04-15T12:00:00'),
    widgetCount: 6,
    isTemplate: true,
    isFavorite: true,
  },
  {
    id: 'template-churn',
    title: 'Churn Analysis',
    description: 'Deep dive into churn patterns by region, plan, and time period.',
    tags: ['churn', 'retention', 'analysis'],
    ownerName: 'InsightHub',
    updatedAt: new Date('2026-04-14T12:00:00'),
    widgetCount: 7,
    isTemplate: true,
  },
  {
    id: 'template-sales',
    title: 'Sales Pipeline',
    description: 'Pipeline stages, win rates, deal sources, and revenue forecasting.',
    tags: ['sales', 'pipeline', 'deals'],
    ownerName: 'InsightHub',
    updatedAt: new Date('2026-04-13T12:00:00'),
    widgetCount: 6,
    isTemplate: true,
  },
];

type TabId = 'all' | 'my' | 'company' | 'shared' | 'templates';
type SortMode = 'recent' | 'oldest' | 'az' | 'za';

const TABS: { id: TabId; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'my', label: 'My Dashboards', icon: FolderOpen },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'shared', label: 'Shared with Me', icon: Users },
  { id: 'templates', label: 'Templates', icon: BookTemplate },
];

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'recent', label: 'Most Recent' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'az', label: 'A → Z' },
  { id: 'za', label: 'Z → A' },
];

function sortDashboards(items: DashboardCardData[], mode: SortMode): DashboardCardData[] {
  return [...items].sort((a, b) => {
    switch (mode) {
      case 'recent': return b.updatedAt.getTime() - a.updatedAt.getTime();
      case 'oldest': return a.updatedAt.getTime() - b.updatedAt.getTime();
      case 'az': return a.title.localeCompare(b.title);
      case 'za': return b.title.localeCompare(a.title);
    }
  });
}

const FAVORITES_KEY = 'insighthub-favorites';
const RECENT_KEY = 'insighthub-recently-viewed';
const MAX_RECENT = 8;

function getRecentlyViewedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

export function trackRecentlyViewed(id: string) {
  try {
    const ids = getRecentlyViewedIds().filter(r => r !== id);
    ids.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {}
}

function loadFavoriteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveFavoriteIds(ids: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}

function applyFavorites(items: DashboardCardData[], favIds: Set<string>): DashboardCardData[] {
  return items.map(d => ({ ...d, isFavorite: favIds.has(d.id) }));
}

export function GalleryPage() {
  const [dashboards, setDashboards] = useState<DashboardCardData[]>(() => {
    if (typeof window === 'undefined') return INITIAL_DASHBOARDS;
    return applyFavorites(INITIAL_DASHBOARDS, loadFavoriteIds());
  });
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [showSort, setShowSort] = useState(false);
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false);
  const [recentCollapsed, setRecentCollapsed] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const { toast } = useToast();

  // Folder-related state
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showFolderTree, setShowFolderTree] = useState(false);

  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(-1);
  const galleryRouter = useRouter();

  const hasActiveFilters = filterOwner || filterDepartment || filterTag || filterDateRange !== 'all';

  // Fetch folders function
  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/folders');
      if (res.ok) {
        const { folders } = await res.json();
        setFolders(buildFolderTree(folders));
      }
    } catch {
      // Silently handle folder fetch errors
    }
  }, []);

  // Initialize folder manager
  const folderManager = FolderManager({ onFoldersUpdate: fetchFolders });

  // Build folder tree from flat folder list
  function buildFolderTree(flatFolders: any[]): FolderNode[] {
    const folderMap = new Map<string, FolderNode>();
    const rootFolders: FolderNode[] = [];

    // Create folder nodes
    flatFolders.forEach(folder => {
      folderMap.set(folder.id, {
        ...folder,
        children: []
      });
    });

    // Build tree structure
    flatFolders.forEach(folder => {
      const node = folderMap.get(folder.id)!;
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(node);
        }
      } else {
        rootFolders.push(node);
      }
    });

    return rootFolders;
  }

  // Handle folder selection
  const handleFolderSelect = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSelectedCardIndex(-1); // Reset dashboard selection
    // On mobile, close folder tree after selection
    if (window.innerWidth < 768) {
      setShowFolderTree(false);
    }
  }, []);

  // Wrapper functions to match FolderTree interface
  const handleRenameFolder = useCallback((folderId: string, currentName: string) => {
    const folder = findFolderInTree(folders, folderId);
    if (folder) {
      folderManager.renameFolder(folder);
    }
  }, [folders, folderManager]);

  const handleDeleteFolder = useCallback((folderId: string) => {
    const folder = findFolderInTree(folders, folderId);
    if (folder) {
      folderManager.deleteFolder(folder);
    }
  }, [folders, folderManager]);

  // Helper function to find folder in tree
  function findFolderInTree(folders: FolderNode[], folderId: string): any | null {
    for (const folder of folders) {
      if (folder.id === folderId) {
        return {
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId,
          visibility: folder.visibility,
          _count: folder._count
        };
      }
      if (folder.children) {
        const found = findFolderInTree(folder.children, folderId);
        if (found) return found;
      }
    }
    return null;
  }

  // Gallery keyboard shortcuts: Alt+arrows for tabs, j/k to nav, Enter to open, n for new, Esc to deselect, 1-5 for tabs
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Alt+Arrow Left/Right to cycle tabs
      if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          if (isInput) return;
          e.preventDefault();
          const ids = TABS.map(t => t.id);
          setActiveTab(prev => {
            const idx = ids.indexOf(prev);
            if (e.key === 'ArrowRight') return ids[(idx + 1) % ids.length];
            return ids[(idx - 1 + ids.length) % ids.length];
          });
          setSelectedCardIndex(-1);
          return;
        }
      }

      // Skip all below if in input
      if (isInput) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      // 1-5: switch tabs
      const tabIdx = parseInt(e.key) - 1;
      if (tabIdx >= 0 && tabIdx < TABS.length) {
        e.preventDefault();
        setActiveTab(TABS[tabIdx].id);
        setSelectedCardIndex(-1);
        return;
      }

      // j / ArrowDown: next card (with cycling)
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCardIndex(prev => {
          // Total cards = 1 "Create New Dashboard" card + filtered dashboards
          const totalCards = 1 + filteredRef.current.length;
          // Ensure we have at least the "Create New Dashboard" card
          if (totalCards <= 1) {
            // Only "Create New Dashboard" card exists, always select it
            return 0;
          }
          // If no selection yet, start with "Create New Dashboard" card
          if (prev < 0) {
            return 0;
          }
          // Cycle through all cards including "Create New Dashboard"
          return (prev + 1) % totalCards;
        });
        return;
      }

      // k / ArrowUp: previous card (with cycling)
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCardIndex(prev => {
          // Total cards = 1 "Create New Dashboard" card + filtered dashboards
          const totalCards = 1 + filteredRef.current.length;
          // Ensure we have at least the "Create New Dashboard" card
          if (totalCards <= 1) {
            // Only "Create New Dashboard" card exists, always select it
            return 0;
          }
          // If no selection yet, start with last dashboard card
          if (prev < 0) {
            return Math.max(0, totalCards - 1);
          }
          // Cycle through all cards including "Create New Dashboard"
          return prev === 0 ? totalCards - 1 : prev - 1;
        });
        return;
      }

      // Enter: open selected card
      if (e.key === 'Enter' && selectedCardIndex >= 0) {
        e.preventDefault();
        if (selectedCardIndex === 0) {
          // "Create New Dashboard" card selected
          galleryRouter.push('/dashboard/new');
        } else {
          // Dashboard card selected (adjust index by -1 since "Create New Dashboard" is at index 0)
          const dashboardIndex = selectedCardIndex - 1;
          if (dashboardIndex >= 0 && dashboardIndex < filteredRef.current.length) {
            galleryRouter.push(`/dashboard/${filteredRef.current[dashboardIndex].id}`);
          }
        }
        return;
      }

      // n: new dashboard
      if (e.key === 'n') {
        e.preventDefault();
        galleryRouter.push('/dashboard/new');
        return;
      }

      // Escape: deselect
      if (e.key === 'Escape') {
        setSelectedCardIndex(-1);
        return;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedCardIndex, galleryRouter]);

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!showSort) return;
    const close = () => setShowSort(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showSort]);

  // Fetch saved dashboards from the API and merge with templates
  useEffect(() => {
    async function loadDashboards() {
      try {
        const res = await fetch('/api/dashboards?limit=50');
        if (!res.ok) return;
        const { dashboards: dbDashboards } = await res.json();
        // Detect current user from the first owned dashboard, or from API
        const userId = dbDashboards?.[0]?.owner?.id || null;
        if (userId) setCurrentUserId(userId);

        const fromDb: DashboardCardData[] = (dbDashboards || []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d: any) => ({
            id: d.id,
            title: d.title,
            description: d.description || '',
            tags: typeof d.tags === 'string' ? (d.tags ? d.tags.split(',').map((t: string) => t.trim()) : []) : (d.tags || []),
            ownerId: d.owner?.id || undefined,
            ownerName: d.owner?.name || 'Unknown',
            updatedAt: new Date(d.updatedAt),
            widgetCount: d._count?.versions || 0,
            isTemplate: d.isTemplate || false,
            isPublic: d.isPublic || false,
            isShared: d.shares && d.shares.length > 0, // Explicitly shared with the current user
            isFavorite: false,
            folderId: d.folderId,
            folder: d.folder ? { id: d.folder.id, name: d.folder.name } : null,
          }),
        );
        // Merge: user-created dashboards + templates (skip dupes by id)
        const templateIds = new Set(INITIAL_DASHBOARDS.map(t => t.id));
        const userDashboards = fromDb.filter((d: DashboardCardData) => !templateIds.has(d.id) && !d.isTemplate);
        const merged = [
          ...userDashboards,
          ...INITIAL_DASHBOARDS,
        ];
        setDashboards(applyFavorites(merged, loadFavoriteIds()));
      } catch {
        // API unreachable (no DB running) — just show templates
      }
    }
    loadDashboards();
  }, []);

  // Fetch folders
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const toggleFavorite = useCallback((id: string) => {
    setDashboards(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, isFavorite: !d.isFavorite } : d);
      const favIds = new Set(updated.filter(d => d.isFavorite).map(d => d.id));
      saveFavoriteIds(favIds);
      return updated;
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const dashboard = dashboards.find(d => d.id === id);
    if (!dashboard || dashboard.isTemplate) return;
    try {
      const res = await fetch(`/api/dashboards/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDashboards(prev => prev.filter(d => d.id !== id));
        toast({ type: 'success', title: 'Dashboard deleted' });
      } else {
        toast({ type: 'error', title: 'Delete failed', description: 'Could not delete this dashboard.' });
      }
    } catch {
      toast({ type: 'error', title: 'Delete failed', description: 'Network error.' });
    }
  }, [dashboards, toast]);

  const handleDuplicate = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/dashboards/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const { dashboard } = await res.json();
        const newCard: DashboardCardData = {
          id: dashboard.id,
          title: dashboard.title,
          description: dashboard.description || '',
          tags: typeof dashboard.tags === 'string' ? (dashboard.tags ? dashboard.tags.split(',').map((t: string) => t.trim()) : []) : (dashboard.tags || []),
          ownerName: dashboard.owner?.name || 'You',
          updatedAt: new Date(dashboard.updatedAt),
          widgetCount: dashboard.versions?.length || 1,
          isTemplate: false,
          isFavorite: false,
        };
        setDashboards(prev => [newCard, ...prev]);
        toast({ type: 'success', title: 'Dashboard duplicated', description: `"${newCard.title}" created.` });
      } else {
        toast({ type: 'error', title: 'Duplicate failed', description: 'Could not clone this dashboard.' });
      }
    } catch {
      toast({ type: 'error', title: 'Duplicate failed', description: 'Network error.' });
    }
  }, [toast]);

  const handleRename = useCallback(async (id: string, currentTitle: string) => {
    const newTitle = window.prompt('Rename dashboard:', currentTitle);
    if (!newTitle || newTitle.trim() === currentTitle) return;
    try {
      const res = await fetch(`/api/dashboards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        setDashboards(prev => prev.map(d => d.id === id ? { ...d, title: newTitle.trim() } : d));
        toast({ type: 'success', title: 'Dashboard renamed' });
      }
    } catch {
      toast({ type: 'error', title: 'Rename failed' });
    }
  }, [toast]);

  const handleTogglePublic = useCallback(async (id: string, isPublic: boolean) => {
    try {
      const res = await fetch(`/api/dashboards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic }),
      });
      if (res.ok) {
        setDashboards(prev => prev.map(d => d.id === id ? { ...d, isPublic } : d));
        toast({
          type: 'success',
          title: isPublic ? 'Published to gallery' : 'Unpublished from gallery',
          description: isPublic
            ? 'Dashboard is now visible to all authenticated users.'
            : 'Dashboard is now private to you and shared users only.',
        });
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update dashboard');
      }
    } catch (error) {
      toast({
        type: 'error',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Could not update dashboard visibility.',
      });
    }
  }, [toast]);

  // Derive unique values for filter dropdowns
  const ownerOptions = useMemo(() => [...new Set(dashboards.map(d => d.ownerName).filter(Boolean))].sort(), [dashboards]);
  const departmentOptions = useMemo(() => {
    const deps = dashboards.map(d => (d as DashboardCardData & { department?: string }).department).filter(Boolean) as string[];
    return [...new Set(deps)].sort();
  }, [dashboards]);
  const tagOptions = useMemo(() => [...new Set(dashboards.flatMap(d => d.tags))].sort(), [dashboards]);

  const matchesSearch = (d: DashboardCardData) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.title.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.tags.some(t => t.includes(q));
  };

  const matchesFilters = (d: DashboardCardData) => {
    if (filterOwner && d.ownerName !== filterOwner) return false;
    if (filterTag && !d.tags.includes(filterTag)) return false;
    if (filterDateRange !== 'all') {
      const now = Date.now();
      const ms = { '7d': 7, '30d': 30, '90d': 90 }[filterDateRange] * 86400000;
      if (now - d.updatedAt.getTime() > ms) return false;
    }
    return true;
  };

  const clearFilters = () => { setFilterOwner(''); setFilterDepartment(''); setFilterTag(''); setFilterDateRange('all'); };

  const filtered = sortDashboards(dashboards.filter(d => {
    // Folder filtering - only show dashboards in the current folder
    if (d.folderId !== currentFolderId) return false;

    if (activeTab === 'templates' && !d.isTemplate) return false;
    if (activeTab === 'company') return matchesSearch(d) && matchesFilters(d);
    if (activeTab === 'my' && (d.isTemplate || d.isShared)) return false;
    if (activeTab === 'shared') return !!d.isShared && !d.isTemplate && matchesSearch(d) && matchesFilters(d);
    if (!matchesSearch(d) || !matchesFilters(d)) return false;
    return true;
  }), sortMode);

  const favorites = dashboards.filter(d => d.isFavorite && matchesSearch(d) && matchesFilters(d));
  const showFavorites = (activeTab === 'all' || activeTab === 'templates') && favorites.length > 0;

  // Recently viewed
  const recentlyViewed = useMemo(() => {
    if (typeof window === 'undefined') return [];
    const ids = getRecentlyViewedIds();
    return ids.map(id => dashboards.find(d => d.id === id)).filter(Boolean) as DashboardCardData[];
  }, [dashboards]);
  const showRecent = activeTab === 'all' && recentlyViewed.length > 0 && !search && !hasActiveFilters;

  // Keep a ref so the keyboard handler always sees current filtered list
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  // Reset selection when filtered list changes significantly
  useEffect(() => {
    const totalCards = 1 + filtered.length;
    if (selectedCardIndex >= totalCards) {
      setSelectedCardIndex(-1);
    }
  }, [filtered.length, selectedCardIndex]);

  return (
    <main className="flex-1 w-full">
      <div className="flex h-full">
        {/* Folder Sidebar */}
        <div className={cn(
          'border-r border-[var(--border-color)] bg-[var(--bg-card)]/50 transition-all duration-300',
          showFolderTree ? 'w-64' : 'w-0 overflow-hidden'
        )}>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Folders</h3>
            <FolderTree
              folders={folders}
              selectedFolderId={currentFolderId}
              onFolderSelect={handleFolderSelect}
              onCreateFolder={folderManager.createFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              showDashboards={false}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Dashboards</h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  Create, discover, and share dashboards across your organization.
                </p>
              </div>
              <button
                onClick={() => setShowFolderTree(!showFolderTree)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                title="Toggle folder tree"
              >
                <Folder size={16} />
                <span className="hidden sm:inline">Folders</span>
              </button>
            </div>

            {/* Breadcrumbs */}
            {(currentFolderId || showFolderTree) && (
              <div className="mb-4">
                <FolderBreadcrumbs
                  breadcrumbs={buildBreadcrumbs(currentFolderId,
                    folders.flatMap(f => [f, ...(f.children || []).map(c => ({ ...c, parentId: f.id }))])
                  )}
                  onNavigate={handleFolderSelect}
                />
              </div>
            )}
          </div>

      {/* Tabs + search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="bg-[var(--bg-card)] rounded-lg p-1 border border-[var(--border-color)] overflow-hidden">
          <div className="flex items-center gap-1 overflow-x-auto sm:overflow-x-visible scrollbar-hide snap-x snap-mandatory">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap snap-start flex-shrink-0',
                  activeTab === tab.id
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search dashboards..."
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent-blue/50 w-full sm:w-56 transition-colors"
            />
          </div>
          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSort(!showSort)}
              tabIndex={-1}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors min-h-[44px]"
            >
              <ArrowUpDown size={12} />
              {SORT_OPTIONS.find(s => s.id === sortMode)?.label}
            </button>
            {showSort && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]/95 backdrop-blur-md shadow-lg">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setSortMode(opt.id); setShowSort(false); }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs transition-colors',
                      sortMode === opt.id ? 'text-accent-blue bg-accent-blue/10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors min-h-[44px]',
              hasActiveFilters
                ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <Filter size={12} />
            Filters
            {hasActiveFilters && (
              <span className="ml-0.5 w-4 h-4 rounded-full bg-accent-blue text-white text-[9px] font-bold flex items-center justify-center">
                {[filterOwner, filterDepartment, filterTag, filterDateRange !== 'all' ? '1' : ''].filter(Boolean).length}
              </span>
            )}
          </button>
          <div className="flex items-center gap-0.5 border border-[var(--border-color)] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              tabIndex={-1}
              className={cn('p-1.5 rounded', viewMode === 'grid' ? 'bg-accent-blue/10 text-accent-blue' : 'text-[var(--text-muted)]')}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              tabIndex={-1}
              className={cn('p-1.5 rounded', viewMode === 'list' ? 'bg-accent-blue/10 text-accent-blue' : 'text-[var(--text-muted)]')}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]/50">
          <select
            value={filterOwner}
            onChange={e => setFilterOwner(e.target.value)}
            className="text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] px-2.5 py-1.5 outline-none focus:border-accent-blue/50"
          >
            <option value="">All Owners</option>
            {ownerOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {departmentOptions.length > 0 && (
            <select
              value={filterDepartment}
              onChange={e => setFilterDepartment(e.target.value)}
              className="text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] px-2.5 py-1.5 outline-none focus:border-accent-blue/50"
            >
              <option value="">All Departments</option>
              {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
            className="text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] px-2.5 py-1.5 outline-none focus:border-accent-blue/50"
          >
            <option value="">All Tags</option>
            {tagOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filterDateRange}
            onChange={e => setFilterDateRange(e.target.value as 'all' | '7d' | '30d' | '90d')}
            className="text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] px-2.5 py-1.5 outline-none focus:border-accent-blue/50"
          >
            <option value="all">Any Date</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Recently Viewed section */}
      {showRecent && (
        <section className="mb-8">
          <button
            onClick={() => setRecentCollapsed(prev => !prev)}
            className="flex items-center gap-2 mb-3 group cursor-pointer"
          >
            {recentCollapsed ? <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" /> : <ChevronDown size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />}
            <Clock size={14} className="text-accent-blue" />
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider group-hover:text-[var(--text-primary)] transition-colors">Recently Viewed ({recentlyViewed.length})</h2>
          </button>
          {!recentCollapsed && (
            <div className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'flex flex-col gap-2'
            )}>
              {recentlyViewed.map(d => (
                <DashboardCard key={`recent-${d.id}`} dashboard={d} viewMode={viewMode} onToggleFavorite={toggleFavorite} onDelete={handleDelete} onRename={handleRename} onDuplicate={handleDuplicate} onTogglePublic={handleTogglePublic} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Favorites section — only visible on All/Templates tabs and when there are favorites matching search */}
      {showFavorites && (
        <section className="mb-8">
          <button
            onClick={() => setFavoritesCollapsed(prev => !prev)}
            className="flex items-center gap-2 mb-3 group cursor-pointer"
          >
            {favoritesCollapsed ? <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" /> : <ChevronDown size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />}
            <Star size={14} className="text-accent-amber fill-accent-amber" />
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider group-hover:text-[var(--text-primary)] transition-colors">Favorites ({favorites.length})</h2>
          </button>
          {!favoritesCollapsed && (
            <div className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'flex flex-col gap-2'
            )}>
              {favorites.map(d => (
                <DashboardCard key={d.id} dashboard={d} viewMode={viewMode} onToggleFavorite={toggleFavorite} onDelete={handleDelete} onRename={handleRename} onDuplicate={handleDuplicate} onTogglePublic={handleTogglePublic} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* All dashboards */}
      <section>
        <button
          onClick={() => setAllCollapsed(prev => !prev)}
          className="flex items-center gap-2 mb-3 group cursor-pointer"
        >
          {allCollapsed ? <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" /> : <ChevronDown size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />}
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider group-hover:text-[var(--text-primary)] transition-colors">
            {activeTab === 'templates' ? 'Templates' : activeTab === 'my' ? 'My Dashboards' : activeTab === 'company' ? 'Company Dashboards' : activeTab === 'shared' ? 'Shared with Me' : 'All Dashboards'} ({filtered.length})
          </h2>
        </button>
        {allCollapsed ? null : filtered.length === 0 ? (
          <div className="text-center py-16">
            {activeTab === 'my' ? (
              <>
                <p className="text-[var(--text-primary)] text-sm font-medium mb-1">No dashboards yet</p>
                <p className="text-[var(--text-muted)] text-xs">Dashboards you create will appear here. Try building one from the home page!</p>
              </>
            ) : activeTab === 'company' ? (
              <>
                <p className="text-[var(--text-primary)] text-sm font-medium mb-1">No company dashboards yet</p>
                <p className="text-[var(--text-muted)] text-xs">Dashboards published by your team will appear here.</p>
              </>
            ) : activeTab === 'shared' ? (
              <>
                <p className="text-[var(--text-primary)] text-sm font-medium mb-1">Nothing shared with you yet</p>
                <p className="text-[var(--text-muted)] text-xs">When a teammate shares a dashboard with you, it will appear here.</p>
              </>
            ) : (
              <p className="text-[var(--text-muted)] text-xs">{search ? 'No dashboards match your search.' : 'No dashboards found.'}</p>
            )}
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'flex flex-col gap-2'
          )}>
            {/* Create new dashboard card */}
            <Link
              href="/dashboard/new"
              className={cn(
                'group rounded-xl border-2 border-dashed transition-all',
                selectedCardIndex === 0
                  ? 'border-accent-blue bg-accent-blue/10 ring-2 ring-accent-blue ring-offset-2 ring-offset-[var(--bg-primary)]'
                  : 'border-[var(--border-color)] hover:border-accent-blue/50 bg-[var(--bg-card)]/50 hover:bg-accent-blue/5',
                viewMode === 'grid'
                  ? 'flex flex-col items-center justify-center gap-3 min-h-[200px]'
                  : 'flex items-center gap-3 px-4 py-3'
              )}
            >
              <div className="w-12 h-12 rounded-full bg-accent-blue/10 group-hover:bg-accent-blue/20 flex items-center justify-center transition-colors">
                <Plus size={24} className="text-accent-blue" />
              </div>
              <div className={viewMode === 'list' ? '' : 'text-center'}>
                <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-accent-blue transition-colors">Create New Dashboard</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Describe it in plain English</p>
              </div>
            </Link>
            {filtered.map((d, i) => (
              <DashboardCard key={d.id} dashboard={d} viewMode={viewMode} isSelected={i + 1 === selectedCardIndex} onToggleFavorite={toggleFavorite} onDelete={handleDelete} onRename={handleRename} onDuplicate={handleDuplicate} onTogglePublic={handleTogglePublic} />
            ))}
          </div>
        )}
      </section>
        </div>
      </div>

      {/* Folder Management Modals */}
      {folderManager.modals}
    </main>
  );
}
