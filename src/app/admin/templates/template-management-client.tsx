'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, BookTemplate, Users, ArrowUpDown, Star, Trash2, Plus, Tag, ChevronDown, ChevronRight, Crown, User } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth/session';
import { relativeTime } from '@/lib/utils';
import { DashboardThumbnail } from '@/components/gallery/DashboardThumbnail';

interface DashboardData {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  ownerId: string;
  ownerName: string;
  updatedAt: Date;
  widgetCount: number;
  isTemplate: boolean;
  isPublic: boolean;
}

type SortMode = 'recent' | 'oldest' | 'az' | 'za';

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'recent', label: 'Most Recent' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'az', label: 'A → Z' },
  { id: 'za', label: 'Z → A' },
];

function sortDashboards(items: DashboardData[], mode: SortMode): DashboardData[] {
  return [...items].sort((a, b) => {
    switch (mode) {
      case 'recent': return b.updatedAt.getTime() - a.updatedAt.getTime();
      case 'oldest': return a.updatedAt.getTime() - b.updatedAt.getTime();
      case 'az': return a.title.localeCompare(b.title);
      case 'za': return b.title.localeCompare(a.title);
    }
  });
}

interface TemplateManagementClientProps {
  currentUser: SessionUser;
}

export default function TemplateManagementClient({ currentUser }: TemplateManagementClientProps) {
  const [dashboards, setDashboards] = useState<DashboardData[]>([]);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [showSort, setShowSort] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templatesCollapsed, setTemplatesCollapsed] = useState(false);
  const [candidatesCollapsed, setCandidatesCollapsed] = useState(false);
  const { toast } = useToast();

  // Load all dashboards
  useEffect(() => {
    async function loadDashboards() {
      try {
        const res = await fetch('/api/dashboards?limit=200');
        if (!res.ok) throw new Error('Failed to load dashboards');

        const { dashboards: dbDashboards } = await res.json();

        const dashboardData: DashboardData[] = (dbDashboards || []).map((d: any) => ({
          id: d.id,
          title: d.title,
          description: d.description || null,
          tags: typeof d.tags === 'string' ? (d.tags ? d.tags.split(',').map((t: string) => t.trim()) : []) : (d.tags || []),
          ownerId: d.owner?.id || '',
          ownerName: d.owner?.name || 'Unknown',
          updatedAt: new Date(d.updatedAt),
          widgetCount: d._count?.versions || 0,
          isTemplate: d.isTemplate || false,
          isPublic: d.isPublic || false,
        }));

        setDashboards(dashboardData);
      } catch (error) {
        console.error('Error loading dashboards:', error);
        toast({
          type: 'error',
          title: 'Load failed',
          description: 'Could not load dashboards. Please refresh the page.'
        });
      } finally {
        setLoading(false);
      }
    }

    loadDashboards();
  }, [toast]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showSort) return;
    const close = () => setShowSort(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showSort]);

  // Filter dashboards
  const filteredTemplates = useMemo(() => {
    let filtered = dashboards.filter(d => d.isTemplate);

    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(d =>
        d.title.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query) ||
        d.tags.some(tag => tag.toLowerCase().includes(query)) ||
        d.ownerName.toLowerCase().includes(query)
      );
    }

    return sortDashboards(filtered, sortMode);
  }, [dashboards, search, sortMode]);

  const filteredCandidates = useMemo(() => {
    let filtered = dashboards.filter(d => !d.isTemplate && d.isPublic);

    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(d =>
        d.title.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query) ||
        d.tags.some(tag => tag.toLowerCase().includes(query)) ||
        d.ownerName.toLowerCase().includes(query)
      );
    }

    return sortDashboards(filtered, sortMode);
  }, [dashboards, search, sortMode]);

  const promoteToTemplate = async (dashboardId: string) => {
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTemplate: true }),
      });

      if (res.ok) {
        setDashboards(prev => prev.map(d =>
          d.id === dashboardId ? { ...d, isTemplate: true } : d
        ));
        toast({
          type: 'success',
          title: 'Template promoted',
          description: 'Dashboard has been promoted to the template gallery.'
        });
      } else {
        throw new Error('Failed to promote dashboard');
      }
    } catch (error) {
      console.error('Error promoting dashboard:', error);
      toast({
        type: 'error',
        title: 'Promotion failed',
        description: 'Could not promote dashboard to template.'
      });
    }
  };

  const demoteTemplate = async (dashboardId: string) => {
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTemplate: false }),
      });

      if (res.ok) {
        setDashboards(prev => prev.map(d =>
          d.id === dashboardId ? { ...d, isTemplate: false } : d
        ));
        toast({
          type: 'success',
          title: 'Template demoted',
          description: 'Dashboard has been removed from the template gallery.'
        });
      } else {
        throw new Error('Failed to demote template');
      }
    } catch (error) {
      console.error('Error demoting template:', error);
      toast({
        type: 'error',
        title: 'Demotion failed',
        description: 'Could not remove template from gallery.'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--text-secondary)] text-sm">Loading dashboards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search dashboards and templates..."
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent-blue/50 w-full sm:w-80 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSort(!showSort)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors min-h-[40px]"
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
        </div>
      </div>

      {/* Current Templates Section */}
      <section>
        <button
          onClick={() => setTemplatesCollapsed(prev => !prev)}
          className="flex items-center gap-2 mb-4 group cursor-pointer"
        >
          {templatesCollapsed ?
            <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" /> :
            <ChevronDown size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
          }
          <BookTemplate size={16} className="text-accent-blue" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-accent-blue transition-colors">
            Current Templates ({filteredTemplates.length})
          </h2>
        </button>

        {!templatesCollapsed && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {filteredTemplates.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <BookTemplate size={32} className="mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-[var(--text-secondary)] text-sm">
                  {search ? 'No templates match your search.' : 'No templates found.'}
                </p>
              </div>
            ) : (
              filteredTemplates.map(template => (
                <div key={template.id} className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[var(--text-primary)] truncate">{template.title}</h3>
                      <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-1">
                        <User size={10} />
                        {template.ownerName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Crown size={14} className="text-amber-500" />
                      <span className="text-[10px] text-amber-600 font-medium px-1.5 py-0.5 bg-amber-100 rounded">TEMPLATE</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <DashboardThumbnail dashboardId={template.id} title={template.title} isTemplate={true} className="w-full h-24" />
                  </div>

                  {template.description && (
                    <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">{template.description}</p>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-accent-blue/10 text-accent-blue rounded">
                          {tag}
                        </span>
                      ))}
                      {template.tags.length > 2 && (
                        <span className="text-[9px] text-[var(--text-muted)]">+{template.tags.length - 2}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">{relativeTime(template.updatedAt)}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      {template.widgetCount} widget{template.widgetCount !== 1 ? 's' : ''}
                    </div>
                    <button
                      onClick={() => demoteTemplate(template.id)}
                      className="text-[10px] px-2 py-1 bg-red-100 text-red-600 hover:bg-red-200 transition-colors rounded"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* Template Candidates Section */}
      <section>
        <button
          onClick={() => setCandidatesCollapsed(prev => !prev)}
          className="flex items-center gap-2 mb-4 group cursor-pointer"
        >
          {candidatesCollapsed ?
            <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" /> :
            <ChevronDown size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
          }
          <Users size={16} className="text-green-600" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-accent-blue transition-colors">
            Template Candidates ({filteredCandidates.length})
          </h2>
        </button>

        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Public dashboards that can be promoted to the template gallery.
        </p>

        {!candidatesCollapsed && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCandidates.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <Users size={32} className="mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-[var(--text-secondary)] text-sm">
                  {search ? 'No candidate dashboards match your search.' : 'No public dashboards available for promotion.'}
                </p>
              </div>
            ) : (
              filteredCandidates.map(candidate => (
                <div key={candidate.id} className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[var(--text-primary)] truncate">{candidate.title}</h3>
                      <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-1">
                        <User size={10} />
                        {candidate.ownerName}
                      </p>
                    </div>
                    <span className="text-[10px] text-green-600 font-medium px-1.5 py-0.5 bg-green-100 rounded">PUBLIC</span>
                  </div>

                  <div className="mb-3">
                    <DashboardThumbnail dashboardId={candidate.id} title={candidate.title} isTemplate={false} className="w-full h-24" />
                  </div>

                  {candidate.description && (
                    <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">{candidate.description}</p>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-wrap gap-1">
                      {candidate.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-accent-blue/10 text-accent-blue rounded">
                          {tag}
                        </span>
                      ))}
                      {candidate.tags.length > 2 && (
                        <span className="text-[9px] text-[var(--text-muted)]">+{candidate.tags.length - 2}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">{relativeTime(candidate.updatedAt)}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      {candidate.widgetCount} widget{candidate.widgetCount !== 1 ? 's' : ''}
                    </div>
                    <button
                      onClick={() => promoteToTemplate(candidate.id)}
                      className="text-[10px] px-2 py-1 bg-accent-blue text-white hover:bg-accent-blue/80 transition-colors rounded"
                    >
                      Promote
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}