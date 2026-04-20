'use client';

import { useEffect } from 'react';

const RELOAD_KEY = 'insighthub_chunk_reload';

/**
 * Global handler for stale-chunk errors after deployments.
 *
 * When Next.js deploys a new build, chunk filenames change. Users with
 * cached pages still reference old chunks that no longer exist, causing
 * "Failed to load chunk" / ChunkLoadError at unpredictable times.
 *
 * This component listens for unhandled errors and promise rejections,
 * detects chunk load failures, and auto-reloads the page **once**
 * (uses sessionStorage to prevent reload loops).
 */
export function ChunkErrorHandler() {
  useEffect(() => {
    function isChunkError(err: unknown): boolean {
      if (err instanceof Error) {
        const msg = err.message || '';
        return (
          msg.includes('Failed to load chunk') ||
          msg.includes('Loading chunk') ||
          msg.includes('ChunkLoadError') ||
          err.name === 'ChunkLoadError'
        );
      }
      return false;
    }

    function handleChunkError() {
      // Only auto-reload once per session to avoid infinite loops
      const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);
      if (alreadyReloaded) return;

      console.warn('[ChunkErrorHandler] Stale chunk detected — reloading page.');
      sessionStorage.setItem(RELOAD_KEY, Date.now().toString());
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      if (isChunkError(event.error)) {
        event.preventDefault();
        handleChunkError();
      }
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      if (isChunkError(event.reason)) {
        event.preventDefault();
        handleChunkError();
      }
    }

    // Clear the reload flag after a successful page load (new chunks are good)
    sessionStorage.removeItem(RELOAD_KEY);

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
