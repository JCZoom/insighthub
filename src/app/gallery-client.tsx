'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, LayoutGrid, List, FolderOpen, Star, Users, BookTemplate, Building2, ArrowUpDown, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { DashboardCard, type DashboardCardData } from '@/components/gallery/DashboardCard';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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

export function GalleryPage() {
  const [dashboards, setDashboards] = useState<DashboardCardData[]>(INITIAL_DASHBOARDS);
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [showSort, setShowSort] = useState(false);
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const { toast } = useToast();

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
        const fromDb: DashboardCardData[] = (dbDashboards || []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d: any) => ({
            id: d.id,
            title: d.title,
            description: d.description || '',
            tags: typeof d.tags === 'string' ? (d.tags ? d.tags.split(',').map((t: string) => t.trim()) : []) : (d.tags || []),
            ownerName: d.owner?.name || 'Unknown',
            updatedAt: new Date(d.updatedAt),
            widgetCount: d._count?.versions || 0,
            isTemplate: d.isTemplate || false,
            isFavorite: false,
          }),
        );
        // Merge: user-created dashboards + templates (skip dupes by id)
        const templateIds = new Set(INITIAL_DASHBOARDS.map(t => t.id));
        const userDashboards = fromDb.filter((d: DashboardCardData) => !templateIds.has(d.id) && !d.isTemplate);
        const merged = [
          ...userDashboards,
          ...INITIAL_DASHBOARDS,
        ];
        setDashboards(merged);
      } catch {
        // API unreachable (no DB running) — just show templates
      }
    }
    loadDashboards();
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setDashboards(prev =>
      prev.map(d => d.id === id ? { ...d, isFavorite: !d.isFavorite } : d)
    );
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

  const matchesSearch = (d: DashboardCardData) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.title.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.tags.some(t => t.includes(q));
  };

  const filtered = sortDashboards(dashboards.filter(d => {
    if (activeTab === 'templates' && !d.isTemplate) return false;
    if (activeTab === 'company') return matchesSearch(d);
    if (activeTab === 'my' && d.isTemplate) return false;
    if (activeTab === 'shared') return false;
    return matchesSearch(d);
  }), sortMode);

  const favorites = dashboards.filter(d => d.isFavorite && matchesSearch(d));
  const showFavorites = (activeTab === 'all' || activeTab === 'templates') && favorites.length > 0;

  return (
    <main className="flex-1 w-full px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Dashboards</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Create, discover, and share dashboards across your organization.
        </p>
      </div>

      {/* Tabs + search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1 bg-[var(--bg-card)] rounded-lg p-1 border border-[var(--border-color)]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
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

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search dashboards..."
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent-blue/50 w-56 transition-colors"
            />
          </div>
          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSort(!showSort)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
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
          <div className="flex items-center gap-0.5 border border-[var(--border-color)] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-1.5 rounded', viewMode === 'grid' ? 'bg-accent-blue/10 text-accent-blue' : 'text-[var(--text-muted)]')}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-1.5 rounded', viewMode === 'list' ? 'bg-accent-blue/10 text-accent-blue' : 'text-[var(--text-muted)]')}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

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
                <DashboardCard key={d.id} dashboard={d} viewMode={viewMode} onToggleFavorite={toggleFavorite} onDelete={handleDelete} onRename={handleRename} />
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
                'group rounded-xl border-2 border-dashed border-[var(--border-color)] hover:border-accent-blue/50 bg-[var(--bg-card)]/50 hover:bg-accent-blue/5 transition-all',
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
            {filtered.map(d => (
              <DashboardCard key={d.id} dashboard={d} viewMode={viewMode} onToggleFavorite={toggleFavorite} onDelete={handleDelete} onRename={handleRename} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
