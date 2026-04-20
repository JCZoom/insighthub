'use client';

import { useState, useCallback } from 'react';

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
 * Hook to manage presentation mode via CSS pseudo-fullscreen.
 * Hides all editing chrome and expands the dashboard to fill the viewport.
 *
 * Uses pure state (no browser Fullscreen API) so that Escape key handling
 * can be layered: overlays close first, then a second Escape exits presentation.
 *
 * Escape handling is NOT done here — it lives in DashboardCanvas where
 * overlay state is known, enabling proper layered dismiss.
 */
export function usePresentationMode(): PresentationModeResult {
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const enterPresentationMode = useCallback(() => {
    setIsPresentationMode(true);
  }, []);

  const exitPresentationMode = useCallback(() => {
    setIsPresentationMode(false);
  }, []);

  const togglePresentationMode = useCallback(() => {
    setIsPresentationMode(prev => !prev);
  }, []);

  return {
    isPresentationMode,
    enterPresentationMode,
    exitPresentationMode,
    togglePresentationMode,
  };
}
