'use client';

import { useMemo } from 'react';

export interface PlatformInfo {
  /** Whether the current platform is Mac/iOS */
  isMac: boolean;
  /** Whether the current platform is Windows */
  isWindows: boolean;
  /** Whether the current platform is Linux */
  isLinux: boolean;
  /** Whether the current platform supports touch */
  isTouch: boolean;
  /** The primary modifier key for this platform (⌘ on Mac, Ctrl elsewhere) */
  modKey: '⌘' | 'Ctrl';
  /** The platform-specific modifier key for meta commands */
  metaKey: 'metaKey' | 'ctrlKey';
  /** User agent string for debugging */
  userAgent: string;
}

/**
 * Hook that provides cross-platform detection and compatibility utilities.
 * Handles differences between Mac, Windows, Linux, and mobile platforms.
 *
 * @example
 * const { isMac, modKey, isTouch } = usePlatform();
 * // Use modKey in UI: `Save ${modKey}+S`
 * // Use isMac for conditional logic
 */
export function usePlatform(): PlatformInfo {
  return useMemo(() => {
    // SSR safety
    if (typeof navigator === 'undefined') {
      return {
        isMac: false,
        isWindows: false,
        isLinux: false,
        isTouch: false,
        modKey: 'Ctrl',
        metaKey: 'ctrlKey',
        userAgent: '',
      };
    }

    const userAgent = navigator.userAgent;
    const platform = navigator.platform || '';

    // Enhanced Mac detection including newer User-Agent Client Hints API
    const isMac = /Mac|iPod|iPhone|iPad/.test(platform) ||
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform === 'macOS';

    // Windows detection
    const isWindows = /Win/.test(platform) ||
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform === 'Windows';

    // Linux detection
    const isLinux = /Linux/.test(platform) && !(/Android/.test(userAgent));

    // Touch support detection
    const isTouch = (typeof window !== 'undefined' && 'ontouchstart' in window) || navigator.maxTouchPoints > 0;

    return {
      isMac,
      isWindows,
      isLinux,
      isTouch,
      modKey: isMac ? '⌘' : 'Ctrl',
      metaKey: isMac ? 'metaKey' : 'ctrlKey',
      userAgent,
    };
  }, []);
}

/**
 * Utility function to check if the current platform matches a condition.
 * Useful for conditional rendering or logic.
 *
 * @example
 * ```ts
 * if (isPlatform('mac')) {
 *   // Mac-specific code
 * }
 * if (isPlatform('desktop')) {
 *   // Desktop-only feature
 * }
 * ```
 */
export function isPlatform(condition: 'mac' | 'windows' | 'linux' | 'desktop' | 'mobile' | 'touch'): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;

  const userAgent = navigator.userAgent;
  const platform = navigator.platform || '';

  // Replicate the same platform detection logic as usePlatform
  const isMac = /Mac|iPod|iPhone|iPad/.test(platform) ||
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform === 'macOS';
  const isWindows = /Win/.test(platform) ||
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform === 'Windows';
  const isLinux = /Linux/.test(platform) && !(/Android/.test(userAgent));
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  switch (condition) {
    case 'mac':
      return isMac;
    case 'windows':
      return isWindows;
    case 'linux':
      return isLinux;
    case 'desktop':
      return !isTouch && (isMac || isWindows || isLinux);
    case 'mobile':
      return isTouch;
    case 'touch':
      return isTouch;
    default:
      return false;
  }
}