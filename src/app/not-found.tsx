import Link from 'next/link';
import { Sparkles, Home, LayoutDashboard } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-accent-blue/10 flex items-center justify-center mb-6">
          <Sparkles size={28} className="text-accent-blue" />
        </div>
        <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">404</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          This page doesn&apos;t exist or may have been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 transition-colors"
          >
            <Home size={14} />
            Go Home
          </Link>
          <Link
            href="/dashboards"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            <LayoutDashboard size={14} />
            Dashboards
          </Link>
        </div>
      </div>
    </div>
  );
}
