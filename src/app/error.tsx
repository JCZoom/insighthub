'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Something went wrong</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          An unexpected error occurred. This has been logged and we&apos;ll look into it.
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
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            <Home size={14} />
            Go Home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-[10px] text-[var(--text-muted)]">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
