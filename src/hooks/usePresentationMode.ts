'use client';

import { useState, useCallback, useEffect } from 'react';

interface PresentationModeResult {
  /** Whether presentation mode is currently active */
  isPresentationMode: boolean;
  /** Enter presentation mode */
  enterPresentationMode: () => void;
  /** Exit presentation mode */
  exitPresentationMode: () => void;
  /** Toggle presentation mode */
  togglePresentationMode: () => void;
}

/**
 * Hook to manage presentation mode using the browser Fullscreen API +
 * Keyboard Lock API for true OS-level fullscreen with layered Escape.
 *
 * Keyboard Lock (`navigator.keyboard.lock(['Escape'])`) tells the browser
 * to pass Escape to JavaScript instead of using it to exit fullscreen.
 * This enables the layered dismiss in DashboardCanvas:
 *   1st Escape → close overlay/modal
 *   2nd Escape → exit presentation mode + fullscreen
 *
 * Falls back gracefully: if Keyboard Lock is unavailable, Escape will
 * exit fullscreen directly (browser default) and state syncs via
 * the `fullscreenchange` listener.
 */
export function usePresentationMode(): PresentationModeResult {
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      // Lock Escape so it routes to JS instead of exiting fullscreen
      if ('keyboard' in navigator && typeof (navigator as any).keyboard?.lock === 'function') {
        await (navigator as any).keyboard.lock(['Escape']);
      }
    } catch {
      // Fullscreen denied or Keyboard Lock unsupported — CSS-only fallback
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      if ('keyboard' in navigator && typeof (navigator as any).keyboard?.unlock === 'function') {
        (navigator as any).keyboard.unlock();
      }
    } catch { /* ignore */ }

    const fullscreenEl = document.fullscreenElement ?? (document as any).webkitFullscreenElement;
    if (fullscreenEl) {
      const exitFn = document.exitFullscreen ?? (document as any).webkitExitFullscreen;
      exitFn?.call(document).catch(() => {});
    }
  }, []);

  const enterPresentationMode = useCallback(() => {
    enterFullscreen();
    setIsPresentationMode(true);
  }, [enterFullscreen]);

  const exitPresentationMode = useCallback(() => {
    exitFullscreen();
    setIsPresentationMode(false);
  }, [exitFullscreen]);

  const togglePresentationMode = useCallback(() => {
    setIsPresentationMode(prev => {
      if (!prev) enterFullscreen();
      else exitFullscreen();
      return !prev;
    });
  }, [enterFullscreen, exitFullscreen]);

  // Sync state when fullscreen is exited by the browser (Escape, gesture, etc.)
  // NO dependency on isPresentationMode — avoids stale closure bugs.
  // Safe to call setIsPresentationMode(false) even when already false (no-op re-render).
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!(document.fullscreenElement ?? (document as any).webkitFullscreenElement);
      if (!isFullscreen) {
        try {
          if ('keyboard' in navigator && typeof (navigator as any).keyboard?.unlock === 'function') {
            (navigator as any).keyboard.unlock();
          }
        } catch { /* ignore */ }
        setIsPresentationMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  return {
    isPresentationMode,
    enterPresentationMode,
    exitPresentationMode,
    togglePresentationMode,
  };
}
