'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp, HeadphonesIcon, PieChart, Users, Building2, Bot, ArrowRight, Play, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Tooltip } from '@/components/ui/Tooltip';

interface TemplateGalleryProps {
  onNext: () => void;
}

const DASHBOARD_TEMPLATES = [
  {
    id: 'template-exec',
    title: 'Executive Summary',
    description: 'The flagship overview — 6 KPIs, revenue trends, MRR growth, pipeline funnel, and regional deep-dives.',
    icon: BarChart3,
    color: 'from-accent-blue/20 to-accent-blue/5 border-accent-blue/20',
    iconColor: 'text-accent-blue',
    previewImage: '/images/templates/executive-preview.png',
    tags: ['Revenue', 'KPIs', 'Executive'],
    widgets: ['MRR & ARR', 'NRR & Churn', 'Revenue Trend', 'Pipeline Funnel', 'Regional Analysis'],
    prompt: 'Build me an executive summary dashboard with key KPIs for MRR, ARR, NRR, churn rate, CSAT, and pipeline value. Include a revenue trend area chart, customers by plan donut, MRR growth line chart, revenue composition stacked bar, deal pipeline funnel, churn by region, customers by region, and a support team performance table.',
  },
  {
    id: 'template-support',
    title: 'Support Operations',
    description: 'Ticket volume trends, resolution analytics, CSAT tracking, and full team performance.',
    icon: HeadphonesIcon,
    color: 'from-accent-green/20 to-accent-green/5 border-accent-green/20',
    iconColor: 'text-accent-green',
    previewImage: '/images/templates/support-preview.png',
    tags: ['Support', 'Tickets', 'CSAT'],
    widgets: ['Open Tickets', 'First Response', 'CSAT Trend', 'Team Performance', 'Category Breakdown'],
    prompt: 'Build a support operations dashboard with KPIs for open tickets, avg first response time, CSAT score, and total customers. Include ticket volume area chart, tickets by category donut, resolution times bar chart, CSAT trend line chart, team performance table, and resolved tickets by team bar chart.',
  },
  {
    id: 'template-churn',
    title: 'Churn Analysis',
    description: 'Comprehensive retention story — 6 KPIs, churn trends, plan & region segmentation, and revenue impact.',
    icon: TrendingUp,
    color: 'from-accent-purple/20 to-accent-purple/5 border-accent-purple/20',
    iconColor: 'text-accent-purple',
    previewImage: '/images/templates/churn-preview.png',
    tags: ['Churn', 'Retention', 'Analysis'],
    widgets: ['Churn & NRR', 'GRR & Active', 'Churn Trend', 'Plan Breakdown', 'Revenue Impact'],
    prompt: 'Create a churn analysis dashboard with 6 KPI cards for churn rate, NRR, GRR, active customers, MRR, and CSAT. Include churn rate trend area chart, churn by plan bar chart, churn by region bar chart, revenue impact area chart, customers by plan donut, and regional customer breakdown table.',
  },
  {
    id: 'template-sales',
    title: 'Sales Pipeline',
    description: 'Pipeline funnel, deal source mix, revenue trends, MRR growth, and deal performance tables.',
    icon: PieChart,
    color: 'from-accent-cyan/20 to-accent-cyan/5 border-accent-cyan/20',
    iconColor: 'text-accent-cyan',
    previewImage: '/images/templates/sales-preview.png',
    tags: ['Sales', 'Pipeline', 'Deals'],
    widgets: ['Pipeline Value', 'Win Rate', 'Deal Funnel', 'Revenue Trend', 'Source Analysis'],
    prompt: 'Create a sales pipeline dashboard with KPIs for pipeline value, win rate, avg deal size, and ARR. Include pipeline funnel chart, deals by source donut, revenue trend area chart, MRR growth line chart, deal source performance table, and customers by plan bar chart.',
  },
  {
    id: 'template-customer',
    title: 'Customer Health',
    description: 'Usage analytics, feature adoption, regional distribution, and churn risk indicators.',
    icon: Users,
    color: 'from-accent-amber/20 to-accent-amber/5 border-accent-amber/20',
    iconColor: 'text-accent-amber',
    previewImage: '/images/templates/customer-preview.png',
    tags: ['Customers', 'Health', 'Engagement'],
    widgets: ['Active Customers', 'Usage Trends', 'Feature Adoption', 'Plan Distribution', 'Churn Risk'],
    prompt: 'Build a customer health dashboard with KPIs for active customers, CSAT, NRR, and churn rate. Include product usage over time area chart, feature adoption donut, customers by plan bar chart, customers by region bar chart, feature usage details table, and churn risk by plan bar chart.',
  },
  {
    id: 'template-finance',
    title: 'Financial Overview',
    description: 'Revenue deep-dive, MRR/ARR tracking, retention metrics, and sales pipeline.',
    icon: Building2,
    color: 'from-accent-red/20 to-accent-red/5 border-accent-red/20',
    iconColor: 'text-accent-red',
    previewImage: '/images/templates/finance-preview.png',
    tags: ['Finance', 'Revenue', 'Metrics'],
    widgets: ['MRR & ARR', 'NRR & GRR', 'Revenue Trend', 'MRR Growth', 'Sales Pipeline'],
    prompt: 'Create a financial overview dashboard with KPIs for MRR, ARR, NRR, and GRR. Include revenue trend area chart, revenue composition stacked bar, MRR growth trend line chart, revenue by plan donut, revenue by region table, and sales pipeline funnel.',
  },
  {
    id: 'template-cs-automation',
    title: 'CS Automation',
    description: 'AI deflection rates across chat, voice, and ticket — bot performance, cost savings, and topic accuracy.',
    icon: Bot,
    color: 'from-accent-purple/20 to-accent-purple/5 border-accent-purple/20',
    iconColor: 'text-accent-purple',
    previewImage: '/images/templates/cs-automation-preview.png',
    tags: ['Automation', 'AI', 'Deflection'],
    widgets: ['Chat Deflection', 'Voice Deflection', 'Cost Savings', 'Channel Breakdown', 'Bot Topics'],
    prompt: 'Build a CS automation dashboard with KPIs for chat deflection rate, voice deflection rate, ticket deflection rate, and overall deflection. Include deflection rate trend area chart, deflection by channel bar chart, cost savings area chart, conversations by channel donut, and bot performance by topic table.',
  },
];

export function TemplateGallery({ onNext }: TemplateGalleryProps) {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  const handleCreateFromTemplate = (template: typeof DASHBOARD_TEMPLATES[0]) => {
    const encoded = encodeURIComponent(template.prompt);
    router.push(`/dashboard/new?prompt=${encoded}&template=${template.id}`);
  };

  const handlePreviewTemplate = (templateId: string) => {
    // Navigate to the template preview (assuming these exist in the gallery)
    router.push(`/dashboard/${templateId}`);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-4">
          Choose a Starting Point
        </h1>
        <p className="text-lg text-[var(--text-secondary)] mb-6">
          Select a pre-built template to get started quickly, or continue to build your own from scratch.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {DASHBOARD_TEMPLATES.map((template) => (
          <div
            key={template.id}
            onMouseEnter={() => setHoveredTemplate(template.id)}
            onMouseLeave={() => setHoveredTemplate(null)}
            className={`group relative rounded-xl border bg-gradient-to-br ${template.color} hover:scale-[1.02] transition-all duration-200 overflow-hidden ${
              selectedTemplate === template.id
                ? 'ring-2 ring-accent-blue border-accent-blue/50'
                : ''
            }`}
          >
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-card-hover)] flex items-center justify-center`}>
                  <template.icon size={24} className={template.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                    {template.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                    {template.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-md bg-[var(--bg-card)]/50 text-xs font-medium text-[var(--text-muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-2 mb-6">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Includes:
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {template.widgets.slice(0, 3).map((widget) => (
                    <div key={widget} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                      <span className="text-xs text-[var(--text-secondary)]">{widget}</span>
                    </div>
                  ))}
                  {template.widgets.length > 3 && (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                      <span className="text-xs text-[var(--text-muted)]">
                        +{template.widgets.length - 3} more widgets
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleCreateFromTemplate(template)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 transition-colors"
                >
                  <Play size={14} />
                  Use Template
                </button>
                <Tooltip content="Preview">
                  <button
                    onClick={() => handlePreviewTemplate(template.id)}
                    className="px-3 py-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <Eye size={14} />
                  </button>
                </Tooltip>
              </div>

              {/* Hover overlay with gradient */}
              {hoveredTemplate === template.id && (
                <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[var(--border-color)]">
        <div className="text-center sm:text-left">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            Prefer to start from scratch?
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            No problem! We'll guide you through creating your first dashboard.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/dashboard/new')}
            className="px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors text-sm font-medium"
          >
            Start From Scratch
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-green text-white text-sm font-medium hover:bg-accent-green/90 transition-colors"
          >
            Continue Tour
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}