'use client';

import { useState, useEffect } from 'react';
import { isTouchDevice } from '@/lib/touch-utils';

export type ViewportBreakpoint = 'mobile' | 'tablet-portrait' | 'tablet-landscape' | 'desktop-narrow' | 'desktop-wide';

export type LayoutMode = 'desktop' | 'tablet' | 'mobile';

interface ViewportConfig {
  /** Current breakpoint name */
  breakpoint: ViewportBreakpoint;
  /** Simplified layout mode for major UI decisions */
  layoutMode: LayoutMode;
  /** Current viewport width */
  width: number;
  /** Current viewport height */
  height: number;
  /** Is this a touch device? */
  isTouch: boolean;
  /** Should chat be a slide-over drawer? */
  isChatDrawer: boolean;
  /** Should widget library be a modal? */
  isLibraryModal: boolean;
  /** Should toolbar show icons only? */
  isToolbarCompact: boolean;
  /** Should use mobile nav bar instead of top navbar? */
  isMobileNav: boolean;
  /** Should editor be view-only (no drag/resize)? */
  isViewOnly: boolean;
  /** Grid columns for this breakpoint */
  gridColumns: number;
}

const BREAKPOINTS = {
  mobile: 640,
  tabletPortrait: 768,
  tabletLandscape: 1024,
  desktopNarrow: 1280,
} as const;

/**
 * Hook to detect viewport size and provide responsive configuration
 * Uses ResizeObserver on the viewport for accurate breakpoint detection
 */
export function useViewport(): ViewportConfig {
  const [config, setConfig] = useState<ViewportConfig>(() => {
    // Safe defaults for SSR
    return {
      breakpoint: 'desktop-wide',
      layoutMode: 'desktop',
      width: 1200,
      height: 800,
      isTouch: false,
      isChatDrawer: false,
      isLibraryModal: false,
      isToolbarCompact: false,
      isMobileNav: false,
      isViewOnly: false,
      gridColumns: 12,
    };
  });

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    const isTouch = isTouchDevice();

    const updateConfig = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      let breakpoint: ViewportBreakpoint;
      let layoutMode: LayoutMode;
      let gridColumns: number;

      // Determine breakpoint
      if (width < BREAKPOINTS.mobile) {
        breakpoint = 'mobile';
        layoutMode = 'mobile';
        gridColumns = 1;
      } else if (width < BREAKPOINTS.tabletPortrait) {
        breakpoint = 'tablet-portrait';
        layoutMode = 'mobile';
        gridColumns = 2;
      } else if (width < BREAKPOINTS.tabletLandscape) {
        breakpoint = 'tablet-landscape';
        layoutMode = 'tablet';
        gridColumns = 6;
      } else if (width < BREAKPOINTS.desktopNarrow) {
        breakpoint = 'desktop-narrow';
        layoutMode = 'desktop';
        gridColumns = 12;
      } else {
        breakpoint = 'desktop-wide';
        layoutMode = 'desktop';
        gridColumns = 12;
      }

      // Determine responsive behaviors
      const isChatDrawer = width < BREAKPOINTS.tabletLandscape;
      const isLibraryModal = width < BREAKPOINTS.tabletLandscape;
      const isToolbarCompact = width < BREAKPOINTS.tabletPortrait;
      const isMobileNav = width < BREAKPOINTS.mobile;
      const isViewOnly = width < BREAKPOINTS.mobile;

      setConfig({
        breakpoint,
        layoutMode,
        width,
        height,
        isTouch,
        isChatDrawer,
        isLibraryModal,
        isToolbarCompact,
        isMobileNav,
        isViewOnly,
        gridColumns,
      });
    };

    // Initial call
    updateConfig();

    // Listen for viewport changes
    const handleResize = () => {
      updateConfig();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return config;
}

/**
 * Utility function to get grid columns for a given width
 * Useful for server-side rendering or when you need to calculate without the hook
 */
export function getGridColumnsForWidth(width: number): number {
  if (width < BREAKPOINTS.mobile) return 1;
  if (width < BREAKPOINTS.tabletPortrait) return 2;
  if (width < BREAKPOINTS.tabletLandscape) return 6;
  return 12;
}

/**
 * Utility function to get layout mode for a given width
 */
export function getLayoutModeForWidth(width: number): LayoutMode {
  if (width < BREAKPOINTS.tabletPortrait) return 'mobile';
  if (width < BREAKPOINTS.tabletLandscape) return 'tablet';
  return 'desktop';
}