'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/hooks/usePlatform';

interface KbdProps {
  /** Keyboard keys, using 'mod' as placeholder for platform-specific modifier */
  keys: string | string[];
  /** Optional CSS classes */
  className?: string;
  /** Style variant */
  variant?: 'default' | 'inline' | 'large';
  /** Join keys with this separator */
  separator?: string;
}

/** Resolve platform-specific key labels */
function resolveKey(key: string, isMac: boolean): string {
  const normalized = key.toLowerCase();

  switch (normalized) {
    case 'mod':
    case 'cmd':
      return isMac ? '⌘' : 'Ctrl';
    case 'shift':
      return isMac ? '⇧' : 'Shift';
    case 'alt':
    case 'option':
      return isMac ? '⌥' : 'Alt';
    case 'ctrl':
    case 'control':
      return isMac ? '^' : 'Ctrl';
    case 'meta':
      return isMac ? '⌘' : 'Win';
    case 'delete':
    case 'del':
      return isMac ? 'Delete' : 'Del';
    case 'backspace':
      return isMac ? '⌫' : 'Backspace';
    case 'enter':
    case 'return':
      return isMac ? '↩' : 'Enter';
    case 'escape':
    case 'esc':
      return 'Esc';
    case 'space':
      return 'Space';
    case 'tab':
      return isMac ? '⇥' : 'Tab';
    case 'arrowup':
    case 'up':
      return '↑';
    case 'arrowdown':
    case 'down':
      return '↓';
    case 'arrowleft':
    case 'left':
      return '←';
    case 'arrowright':
    case 'right':
      return '→';
    default:
      return key;
  }
}

const variantStyles = {
  default: 'inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-muted)]',
  inline: 'inline-flex items-center justify-center min-w-[18px] h-4 px-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[9px] font-mono text-[var(--text-muted)]',
  large: 'inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] font-mono font-semibold text-[var(--text-primary)] shadow-sm',
};

/**
 * Platform-aware keyboard shortcut display component.
 *
 * @example
 * <Kbd keys="mod+s" /> // Shows "⌘S" on Mac, "Ctrl+S" on Windows
 * <Kbd keys={['mod', 'shift', 'z']} separator="+" />
 * <Kbd keys="?" variant="inline" />
 */
export function Kbd({ keys, className, variant = 'default', separator = '+' }: KbdProps) {
  const { isMac } = usePlatform();

  const keyArray = useMemo(() => {
    const rawKeys = typeof keys === 'string' ? keys.split(/[\s+]/) : keys;
    return rawKeys.map(key => resolveKey(key.trim(), isMac)).filter(Boolean);
  }, [keys, isMac]);

  if (keyArray.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5">
      {keyArray.map((key, i) => (
        <span key={i}>
          <kbd className={cn(variantStyles[variant], className)}>
            {key}
          </kbd>
          {i < keyArray.length - 1 && (
            <span className="text-[var(--text-muted)] text-[10px] mx-0.5">{separator}</span>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * Helper to format keyboard shortcuts for tooltips.
 *
 * @example
 * title={`Save dashboard ${formatShortcut(['mod', 's'])}`}
 * // Results in: "Save dashboard (⌘S)" on Mac, "Save dashboard (Ctrl+S)" on Windows
 */
export function formatShortcut(keys: string | string[], separator = '+'): string {
  if (typeof navigator === 'undefined') return ''; // SSR safety

  // Use the same platform detection logic as usePlatform but inline for performance
  const platform = navigator.platform || '';
  const isMac = /Mac|iPod|iPhone|iPad/.test(platform) ||
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform === 'macOS';

  const keyArray = typeof keys === 'string' ? keys.split(/[\s+]/) : keys;
  const resolved = keyArray.map(key => resolveKey(key.trim(), isMac)).filter(Boolean);

  return resolved.length > 0 ? `(${resolved.join(separator)})` : '';
}