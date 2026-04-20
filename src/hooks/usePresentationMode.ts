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
    const el = document.documentElement;
    try {
      await el.requestFullscreen();
      // Lock Escape so it routes to JS instead of exiting fullscreen
      if ('keyboard' in navigator && (navigator.keyboard as any).lock) {
        await (navigator.keyboard as any).lock(['Escape']);
      }
    } catch {
      // Fullscreen denied or Keyboard Lock unsupported — CSS-only fallback
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if ('keyboard' in navigator && (navigator.keyboard as any).unlock) {
      (navigator.keyboard as any).unlock();
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
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
      const entering = !prev;
      if (entering) {
        enterFullscreen();
      } else {
        exitFullscreen();
      }
      return entering;
    });
  }, [enterFullscreen, exitFullscreen]);

  // Sync state when fullscreen is exited via browser-native mechanisms
  // (e.g. if Keyboard Lock isn't supported and browser consumes Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isPresentationMode) {
        if ('keyboard' in navigator && (navigator.keyboard as any).unlock) {
          (navigator.keyboard as any).unlock();
        }
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
