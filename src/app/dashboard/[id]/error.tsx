'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home, Plus } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard editor error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-accent-amber/10 flex items-center justify-center mb-6">
          <AlertTriangle size={28} className="text-accent-amber" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Dashboard couldn&apos;t load</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          This dashboard may not exist or something went wrong loading it. You can try again or start fresh.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 transition-colors"
          >
            <RotateCcw size={14} />
            Try Again
          </button>
          <Link
            href="/dashboard/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            <Plus size={14} />
            New Dashboard
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            <Home size={14} />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
