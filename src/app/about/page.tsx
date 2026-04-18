'use client';

import Link from 'next/link';
import {
  Sparkles,
  MessageSquare,
  LayoutDashboard,
  BookOpen,
  Database,
  Code2,
  Share2,
  Shield,
  Keyboard,
  Terminal,
  Zap,
  ArrowRight,
  Mic,
  MousePointerClick,
  Layers,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  iconColor: string;
}

function FeatureCard({ icon: Icon, title, description, color, iconColor }: FeatureCardProps) {
  return (
    <div className={`group p-5 rounded-xl border bg-gradient-to-b ${color} transition-all hover:scale-[1.02]`}>
      <div className={`inline-flex p-2 rounded-lg bg-[var(--bg-primary)]/50 mb-3`}>
        <Icon size={20} className={iconColor} />
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">{title}</h3>
      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

interface ShortcutRowProps {
  keys: string[];
  description: string;
}

function ShortcutRow({ keys, description }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]/50 last:border-0">
      <span className="text-xs text-[var(--text-secondary)]">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-[var(--bg-primary)]/60 border border-[var(--border-color)] text-[var(--text-secondary)]"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

const FEATURES: FeatureCardProps[] = [
  {
    icon: MessageSquare,
    title: 'AI Chat Builder',
    description:
      'Describe what you need in plain English. Claude builds a fully interactive dashboard in seconds — KPIs, charts, tables, and more.',
    color: 'from-accent-blue/15 to-accent-blue/5 border-accent-blue/20',
    iconColor: 'text-accent-blue',
  },
  {
    icon: Mic,
    title: 'Voice Input',
    description:
      'Prefer to talk? Hit ⇧⌘M and dictate your dashboard requests. Speech-to-text feeds directly into the AI chat.',
    color: 'from-accent-red/15 to-accent-red/5 border-accent-red/20',
    iconColor: 'text-accent-red',
  },
  {
    icon: LayoutDashboard,
    title: 'Template Gallery',
    description:
      'Start from pre-built templates — Executive Summary, Churn Analysis, Support Ops, Sales Pipeline — or create from scratch.',
    color: 'from-accent-purple/15 to-accent-purple/5 border-accent-purple/20',
    iconColor: 'text-accent-purple',
  },
  {
    icon: Layers,
    title: 'Widget Library',
    description:
      'Browse a searchable library of reusable widgets. Clone any widget into your dashboard with a single click, or let AI pick the best one.',
    color: 'from-accent-cyan/15 to-accent-cyan/5 border-accent-cyan/20',
    iconColor: 'text-accent-cyan',
  },
  {
    icon: MousePointerClick,
    title: 'Drag, Drop & Resize',
    description:
      'Arrange widgets on a flexible grid. Drag to reposition, resize handles to adjust, arrow keys to nudge — full spatial control.',
    color: 'from-accent-green/15 to-accent-green/5 border-accent-green/20',
    iconColor: 'text-accent-green',
  },
  {
    icon: BookOpen,
    title: 'Business Glossary',
    description:
      'A company-wide glossary of metrics and terms (MRR, Churn Rate, CSAT, etc.) so everyone speaks the same data language.',
    color: 'from-accent-amber/15 to-accent-amber/5 border-accent-amber/20',
    iconColor: 'text-accent-amber',
  },
  {
    icon: Share2,
    title: 'Share & Collaborate',
    description:
      'Share dashboards with teammates via link. Version history lets you rewind to any previous state with full undo/redo support.',
    color: 'from-accent-blue/15 to-accent-blue/5 border-accent-blue/20',
    iconColor: 'text-accent-blue',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    description:
      'Granular data-level permissions control who sees what. Permission groups ensure sensitive data stays locked down.',
    color: 'from-accent-red/15 to-accent-red/5 border-accent-red/20',
    iconColor: 'text-accent-red',
  },
];

const POWER_USER_FEATURES = [
  {
    icon: Database,
    title: 'SQL Query Playground',
    description:
      'Write raw SQL queries against your data sources. A built-in Monaco editor with autocomplete, syntax highlighting, and query history.',
  },
  {
    icon: Code2,
    title: 'Visual Query Builder',
    description:
      'Sigma-style drag-and-drop query building with spreadsheet formulas (Sum, CountIf, etc.). No SQL required — but you can always toggle "View SQL" to see what\'s generated.',
  },
  {
    icon: Terminal,
    title: 'Programmatic API Access',
    description:
      'Access dashboards, data, and widgets via RESTful API endpoints. Build automations, embed dashboards, or integrate InsightHub into your existing toolchain.',
  },
  {
    icon: Zap,
    title: 'Custom Calculated Fields',
    description:
      'Create derived metrics using Sigma-style formulas or raw SQL expressions. Chain calculations, reference other fields, and build complex analytics.',
  },
];

const SHORTCUTS = [
  { keys: ['⌘', '1'], description: 'Go to Home' },
  { keys: ['⌘', '2'], description: 'Go to My Dashboards' },
  { keys: ['⌘', '3'], description: 'Go to Glossary' },
  { keys: ['⌘', '4'], description: 'Go to About' },
  { keys: ['⌘', '5'], description: 'New Dashboard' },
  { keys: ['⌘', 'S'], description: 'Save dashboard' },
  { keys: ['⌘', '⇧', 'S'], description: 'Save as (duplicate)' },
  { keys: ['⌘', 'Z'], description: 'Undo' },
  { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
  { keys: ['/'], description: 'Focus search or chat input' },
  { keys: ['?'], description: 'Toggle keyboard shortcut sheet' },
  { keys: ['⌘', '⇧', 'M'], description: 'Toggle voice input' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs font-medium mb-4">
              <Sparkles size={12} />
              AI-Powered Dashboard Builder
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-3">
              Welcome to InsightHub
            </h1>
            <p className="text-[var(--text-secondary)] text-base max-w-xl mx-auto leading-relaxed">
              InsightHub turns natural language into live, interactive dashboards.
              Describe what you want to see, and AI builds it in seconds — no code required.
            </p>
          </div>

          {/* Getting Started */}
          <section className="mb-16">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Getting Started</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-2xl">
              The fastest way to get going is to describe what you need on the{' '}
              <Link href="/" className="text-accent-blue hover:underline">
                Home page
              </Link>
              . Type something like{' '}
              <span className="italic text-[var(--text-primary)]">
                &quot;Show me monthly revenue by region for the past year&quot;
              </span>{' '}
              and hit Enter. AI will generate a full dashboard with charts, KPIs, and tables. From there you can:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                <div className="text-accent-blue font-bold text-lg mb-1">1</div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Refine with follow-up messages — &quot;add a churn rate KPI&quot; or &quot;switch the bar chart to a line chart&quot;
                </p>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                <div className="text-accent-purple font-bold text-lg mb-1">2</div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Drag, resize, and rearrange widgets on the canvas. Use the right-click context menu for quick actions.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                <div className="text-accent-green font-bold text-lg mb-1">3</div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Save your dashboard, share it with your team, and browse it anytime from the Gallery.
                </p>
              </div>
            </div>
          </section>

          {/* Core Features */}
          <section className="mb-16">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Core Features</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Everything you need to go from question to dashboard in seconds.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEATURES.map(f => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </section>

          {/* Power User */}
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">For Power Users</h2>
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-accent-purple/10 border border-accent-purple/20 text-accent-purple">
                Advanced
              </span>
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-accent-amber/10 border border-accent-amber/20 text-accent-amber">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-2xl">
              Data engineers and senior analysts can go deeper — write raw SQL, build visual queries, or access everything via API.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {POWER_USER_FEATURES.map(f => (
                <div
                  key={f.title}
                  className="p-5 rounded-xl border border-accent-purple/15 bg-gradient-to-b from-accent-purple/10 to-transparent opacity-60"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="inline-flex p-2 rounded-lg bg-[var(--bg-primary)]/50">
                      <f.icon size={20} className="text-accent-purple" />
                    </div>
                    <span className="px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-accent-amber/10 border border-accent-amber/20 text-accent-amber">
                      Coming Soon
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">{f.title}</h3>
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{f.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-2">
              <Keyboard size={16} className="text-[var(--text-muted)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--bg-card)] border border-[var(--border-color)]">?</kbd>{' '}
              anywhere to see the full list. Here are the essentials:
            </p>
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 max-w-md">
              {SHORTCUTS.map((s, i) => (
                <ShortcutRow key={i} {...s} />
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center pb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Ready to build?</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Jump in and create your first dashboard — it takes less than 30 seconds.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/dashboard/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 transition-colors"
              >
                <Sparkles size={15} />
                New Dashboard
              </Link>
              <Link
                href="/dashboards"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-accent-blue/30 transition-all"
              >
                Browse Dashboards
                <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
