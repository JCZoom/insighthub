'use client';

import { useState } from 'react';

/**
 * Live retention-purge button for the Freshworks suite demo page.
 *
 * Calls `POST /api/admin/retention` with `target=freshworks_cache, dryRun=false`.
 * The underlying purge function flushes ALL `fw-*` prefixed keys across
 * Freshsales, Freshdesk, Freshcaller, and Freshchat in a single SCAN+DEL.
 *
 * Admin-only — parent page checks `isAdmin(user)` before rendering.
 */
export default function PurgeAllCachesButton() {
  const [status, setStatus] = useState<'idle' | 'purging' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ deleted: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function purge() {
    setStatus('purging');
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'freshworks_cache', dryRun: false }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as { freshworksCache?: { deleted: number } };
      setResult({ deleted: data.freshworksCache?.deleted ?? 0 });
      setStatus('done');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={purge}
          disabled={status === 'purging'}
          className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium text-sm"
        >
          {status === 'purging' ? 'Purging…' : 'Purge ALL Freshworks caches now'}
        </button>
        {status === 'done' && result && (
          <span className="text-sm text-emerald-700 dark:text-emerald-300">
            ✅ Deleted <strong>{result.deleted}</strong> cache key
            {result.deleted === 1 ? '' : 's'} across all 4 products. Reload the page to
            re-fetch from Freshworks.
          </span>
        )}
        {status === 'error' && error && (
          <span className="text-sm text-red-700 dark:text-red-300">❌ {error}</span>
        )}
      </div>
      {status === 'done' && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="self-start text-xs px-3 py-1 rounded border border-purple-300 text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/30"
        >
          Reload page to re-fetch
        </button>
      )}
    </div>
  );
}
