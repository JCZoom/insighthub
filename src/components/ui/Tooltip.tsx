'use client';

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Kbd } from '@/components/ui/Kbd';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** Delay in ms before showing tooltip. Default 200ms. */
  delay?: number;
  /** Placement relative to trigger element */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Keyboard shortcut keys to display (e.g. ['mod', 's'] or 'mod+s') */
  shortcut?: string | string[];
  className?: string;
  /** CSS classes for the outer trigger wrapper (use for layout positioning, e.g. 'absolute top-1 right-1') */
  wrapperClassName?: string;
}

export function Tooltip({ content, children, delay = 200, side = 'top', shortcut, className, wrapperClassName }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipEl = tooltipRef.current;
      const tooltipW = tooltipEl?.offsetWidth || 0;
      const tooltipH = tooltipEl?.offsetHeight || 0;

      let x = 0;
      let y = 0;

      switch (side) {
        case 'top':
          x = rect.left + rect.width / 2;
          y = rect.top - 6;
          break;
        case 'bottom':
          x = rect.left + rect.width / 2;
          y = rect.bottom + 6;
          break;
        case 'left':
          x = rect.left - 6;
          y = rect.top + rect.height / 2;
          break;
        case 'right':
          x = rect.right + 6;
          y = rect.top + rect.height / 2;
          break;
      }

      setCoords({ x, y });
      setVisible(true);
    }, delay);
  }, [delay, side]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!content) return <>{children}</>;

  const sideClasses = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  return (
    <span
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className={cn('inline-flex', wrapperClassName)}
    >
      {children}
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={cn(
            'fixed z-[9999] px-2.5 py-1.5 rounded-lg text-xs font-medium max-w-[240px] pointer-events-none',
            'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]',
            'shadow-lg shadow-black/20 backdrop-blur-md',
            'animate-fadeIn',
            sideClasses[side],
            className
          )}
          style={{
            left: coords.x,
            top: coords.y,
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span>{content}</span>
            {shortcut && <Kbd keys={shortcut} variant="inline" />}
          </span>
        </div>
      )}
    </span>
  );
}
