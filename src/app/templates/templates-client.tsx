'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, LayoutGrid, List, BookTemplate, ArrowUpDown, Tag, Play, Folder } from 'lucide-react';
import { DashboardCard, type DashboardCardData } from '@/components/gallery/DashboardCard';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { TEMPLATE_SCHEMAS } from '@/lib/data/templates';
import { TEMPLATE_CATEGORIES, getCategoryForTags, type TemplateCategory } from '@/lib/data/template-categories';
import type { SessionUser } from '@/lib/auth/session';

// Fixed template data
const TEMPLATE_DASHBOARDS: DashboardCardData[] = [
  {
    id: 'template-exec',
    title: 'Executive Summary',
    description: 'The flagship overview — 6 KPIs, revenue trends, MRR growth, pipeline funnel, and regional deep-dives across 14 widgets.',
    tags: ['revenue', 'churn', 'executive', 'kpi'],
    ownerName: 'InsightHub',
    updatedAt: new Date('2026-04-19T12:00:00'),
    widgetCount: 16,
    isTemplate: true,
  },
  {
    id: 'template-support',
    title: 'Support Operations',
    description: 'Ticket volume trends, resolution analytics, CSAT tracking, category breakdown, and full team performance across 10 widgets.',
    tags: ['support', 'tickets', 'csat', 'performance'],
    ownerName: 'InsightHub',
    updatedAt: new Date('2026-04-19T12:00:00'),
    widgetCount: 12,
    isTemplate: true,
  },
  {
    id: 'template-churn',
    title: 'Churn Analysis',
    description: 'Comprehensive retention story — 6 KPI cards, churn trends, plan & region segmentation, revenue impact, and customer distribution across 12 widgets.',
    tags: ['churn', 'retention', 'analysis', 'segments'],
    ownerName: 'InsightHub',
    updatedAt: new Date('2026-04-19T12:00:00'),
    widgetCount: 14,
    isTemplate: true,
  },
  {
    id: 'template-sales',
    title: 'Sales Pipeline',
    description: 'Pipeline funnel, deal source mix, revenue trends, MRR growth, and detailed deal tables across 10 widgets.',
    tags: ['sales', 'pipeline', 'deals', 'forecasting'],
    ownerName: 'InsightHub',
    updatedAt: new Date('2026-04-19T12:00:00'),
    widgetCount: 12,
    isTemplate: true,
  },
  {
    id: 'template-customer',
    title: 'Customer Health',
    description: 'Usage analytics, feature adoption, regional distribution, satisfaction metrics, and churn risk indicators across 10 widgets.',
    tags: ['customer', 'retention', 'satisfaction', 'engagement'],
    ownerName: 'InsightHub',
    updatedAt: new Date('2026-04-19T12:00:00'),
    widgetCount: 12,
    isTemplate: true,
  },
  {
    id: 'template-finance',
    title: 'Financial Overview',
    description: 'Revenue deep-dive, MRR/ARR tracking, retention metrics, revenue composition, and customer revenue analysis across 10 widgets.',
    tags: ['finance', 'revenue', 'accounting', 'financial'],
    ownerName: 'InsightHub',
    updatedAt: new Date('2026-04-19T12:00:00'),
    widgetCount: 12,
    isTemplate: true,
  },
  {
    id: 'template-cs-automation',
    title: 'CS Automation',
    description: 'AI deflection rates across chat, voice, and ticket channels — bot performance, cost savings, and topic-level accuracy across 12 widgets.',
    tags: ['automation', 'chatbot', 'deflection', 'ai', 'support'],
    ownerName: 'InsightHub',
    updatedAt: new Date('2026-04-19T12:00:00'),
    widgetCount: 12,
    isTemplate: true,
  },
];

type SortMode = 'recent' | 'oldest' | 'az' | 'za';

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'recent', label: 'Most Recent' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'az', label: 'A → Z' },
  { id: 'za', label: 'Z → A' },
];

function sortTemplates(items: DashboardCardData[], mode: SortMode): DashboardCardData[] {
  return [...items].sort((a, b) => {
    switch (mode) {
      case 'recent': return b.updatedAt.getTime() - a.updatedAt.getTime();
      case 'oldest': return a.updatedAt.getTime() - b.updatedAt.getTime();
      case 'az': return a.title.localeCompare(b.title);
      case 'za': return b.title.localeCompare(a.title);
    }
  });
}

interface TemplatesClientProps {
  currentUser: SessionUser | null;
}

export default function TemplatesClient({ currentUser }: TemplatesClientProps) {
  const [templates, setTemplates] = useState<DashboardCardData[]>(TEMPLATE_DASHBOARDS);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [showSort, setShowSort] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [showTags, setShowTags] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCategories, setShowCategories] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Load templates from API to include user-created templates
  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch('/api/dashboards?limit=100');
        if (!res.ok) return;

        const { dashboards: dbDashboards } = await res.json();

        const userTemplates: DashboardCardData[] = (dbDashboards || [])
          .filter((d: any) => d.isTemplate)
          .map((d: any) => ({
            id: d.id,
            title: d.title,
            description: d.description || '',
            tags: typeof d.tags === 'string' ? (d.tags ? d.tags.split(',').map((t: string) => t.trim()) : []) : (d.tags || []),
            ownerName: d.owner?.name || 'Unknown',
            updatedAt: new Date(d.updatedAt),
            widgetCount: d._count?.versions || 0,
            isTemplate: true,
          }));

        // Merge built-in templates with user templates
        const builtInIds = new Set(TEMPLATE_DASHBOARDS.map(t => t.id));
        const uniqueUserTemplates = userTemplates.filter(t => !builtInIds.has(t.id));
        setTemplates([...TEMPLATE_DASHBOARDS, ...uniqueUserTemplates]);
      } catch (error) {
        console.error('Failed to load templates:', error);
        // Keep showing built-in templates even if API fails
      }
    }
    loadTemplates();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showSort && !showTags && !showCategories) return;
    const close = () => {
      setShowSort(false);
      setShowTags(false);
      setShowCategories(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showSort, showTags, showCategories]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    templates.forEach(t => t.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [templates]);

  // Filter and search templates
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Filter by search
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory) {
      const categoryData = TEMPLATE_CATEGORIES[selectedCategory];
      if (categoryData) {
        filtered = filtered.filter(t => {
          const templateCategory = getCategoryForTags(t.tags);
          return templateCategory?.id === selectedCategory;
        });
      }
    }

    // Filter by tag
    if (selectedTag) {
      filtered = filtered.filter(t => t.tags.includes(selectedTag));
    }

    return sortTemplates(filtered, sortMode);
  }, [templates, search, selectedCategory, selectedTag, sortMode]);

  const handleUseTemplate = async (templateId: string) => {
    if (!currentUser) {
      toast({
        type: 'error',
        title: 'Sign in required',
        description: 'You need to sign in to create dashboards from templates.'
      });
      return;
    }

    try {
      // Check if it's a built-in template
      const templateSchema = TEMPLATE_SCHEMAS[templateId];
      if (templateSchema) {
        // Create dashboard from built-in template schema
        const response = await fetch('/api/dashboards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `${templateSchema.title} Copy`,
            description: `Created from ${templateSchema.title} template`,
            schema: templateSchema.schema,
            tags: templates.find(t => t.id === templateId)?.tags || [],
          }),
        });

        if (response.ok) {
          const { dashboard } = await response.json();
          toast({
            type: 'success',
            title: 'Dashboard created',
            description: `"${dashboard.title}" has been created from template.`
          });
          router.push(`/dashboard/${dashboard.id}`);
        } else {
          throw new Error('Failed to create dashboard');
        }
      } else {
        // For user-created templates, use the duplicate endpoint
        const response = await fetch(`/api/dashboards/${templateId}/duplicate`, {
          method: 'POST',
        });

        if (response.ok) {
          const { dashboard } = await response.json();
          toast({
            type: 'success',
            title: 'Dashboard created',
            description: `"${dashboard.title}" has been created from template.`
          });
          router.push(`/dashboard/${dashboard.id}`);
        } else {
          throw new Error('Failed to create dashboard from template');
        }
      }
    } catch (error) {
      console.error('Error creating dashboard from template:', error);
      toast({
        type: 'error',
        title: 'Creation failed',
        description: 'Could not create dashboard from template. Please try again.'
      });
    }
  };

  const handleDuplicate = handleUseTemplate; // Same functionality for templates

  return (
    <div className="space-y-6">
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="pl-8 pr-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent-blue/50 w-full sm:w-64 transition-colors"
            />
          </div>

          {/* Category filter */}
          <div className="relative">
            <button
              onClick={() => setShowCategories(!showCategories)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors min-h-[40px]',
                selectedCategory
                  ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                  : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Folder size={12} />
              {selectedCategory ? TEMPLATE_CATEGORIES[selectedCategory]?.name : 'All Categories'}
            </button>
            {showCategories && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]/95 backdrop-blur-md shadow-lg max-h-60 overflow-y-auto">
                <button
                  onClick={() => { setSelectedCategory(''); setShowCategories(false); }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs transition-colors',
                    !selectedCategory ? 'text-accent-blue bg-accent-blue/10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                  )}
                >
                  All Categories
                </button>
                {Object.values(TEMPLATE_CATEGORIES).map(category => (
                  <button
                    key={category.id}
                    onClick={() => { setSelectedCategory(category.id); setShowCategories(false); }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs transition-colors',
                      selectedCategory === category.id ? 'text-accent-blue bg-accent-blue/10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                    )}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tag filter */}
          <div className="relative">
            <button
              onClick={() => setShowTags(!showTags)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors min-h-[40px]',
                selectedTag
                  ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                  : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Tag size={12} />
              {selectedTag || 'All Tags'}
            </button>
            {showTags && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]/95 backdrop-blur-md shadow-lg max-h-60 overflow-y-auto">
                <button
                  onClick={() => { setSelectedTag(''); setShowTags(false); }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs transition-colors',
                    !selectedTag ? 'text-accent-blue bg-accent-blue/10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                  )}
                >
                  All Tags
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setSelectedTag(tag); setShowTags(false); }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs transition-colors',
                      selectedTag === tag ? 'text-accent-blue bg-accent-blue/10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
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

          {/* View mode toggle */}
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

      {/* Template count and description */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <BookTemplate size={16} className="text-accent-blue" />
        <span>{filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available</span>
        {selectedCategory && (
          <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
            {TEMPLATE_CATEGORIES[selectedCategory]?.name}
          </span>
        )}
        {selectedTag && (
          <span className="ml-1 px-2 py-0.5 bg-accent-blue/10 text-accent-blue rounded text-xs">
            {selectedTag}
          </span>
        )}
      </div>

      {/* Templates grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-16">
          <BookTemplate size={48} className="mx-auto text-[var(--text-muted)] mb-4" />
          <p className="text-[var(--text-primary)] text-sm font-medium mb-1">No templates found</p>
          <p className="text-[var(--text-muted)] text-xs">
            {search || selectedTag ? 'Try adjusting your search or filter criteria.' : 'No templates are currently available.'}
          </p>
        </div>
      ) : (
        <div className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'flex flex-col gap-3'
        )}>
          {filteredTemplates.map(template => (
            <div key={template.id} className="relative group">
              <DashboardCard
                dashboard={template}
                viewMode={viewMode}
                onDuplicate={handleDuplicate}
              />
              {/* Use Template button overlay */}
              <div className={cn(
                'absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center',
                viewMode === 'list' && 'rounded-lg'
              )}>
                <button
                  onClick={() => handleUseTemplate(template.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition-colors font-medium text-sm"
                >
                  <Play size={16} />
                  Use This Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}