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
 * Hook to manage presentation mode using the browser Fullscreen API.
 * Hides all browser chrome, OS taskbar, and editing UI — true fullscreen.
 *
 * Listens for `fullscreenchange` to keep state in sync when the user
 * exits fullscreen via Escape or other browser-native mechanisms.
 *
 * Note: In true fullscreen, the browser captures the first Escape press
 * to exit fullscreen. Layered overlay dismiss (DashboardCanvas) still
 * works when exiting via the on-screen button instead of Escape.
 */
export function usePresentationMode(): PresentationModeResult {
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const enterPresentationMode = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // Fullscreen denied (e.g. not triggered by user gesture) — fall back to CSS-only
      });
    }
    setIsPresentationMode(true);
  }, []);

  const exitPresentationMode = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsPresentationMode(false);
  }, []);

  const togglePresentationMode = useCallback(() => {
    setIsPresentationMode(prev => {
      const entering = !prev;
      if (entering) {
        const el = document.documentElement;
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return entering;
    });
  }, []);

  // Sync state when fullscreen is exited via browser-native Escape or other means
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isPresentationMode) {
        setIsPresentationMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isPresentationMode]);

  return {
    isPresentationMode,
    enterPresentationMode,
    exitPresentationMode,
    togglePresentationMode,
  };
}
