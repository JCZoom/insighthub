'use client';

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

  const [effectiveSide, setEffectiveSide] = useState(side);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const GAP = 6;

      // Estimate tooltip dimensions for viewport-flip check
      // Use a generous estimate; actual size is handled by CSS transforms
      const estH = 32; // typical single-line tooltip height
      const estW = 120;

      // Determine if the preferred side has enough viewport room; flip if not
      let resolvedSide = side;
      if (side === 'top' && rect.top - GAP - estH < 0) {
        resolvedSide = 'bottom';
      } else if (side === 'bottom' && rect.bottom + GAP + estH > window.innerHeight) {
        resolvedSide = 'top';
      } else if (side === 'left' && rect.left - GAP - estW < 0) {
        resolvedSide = 'right';
      } else if (side === 'right' && rect.right + GAP + estW > window.innerWidth) {
        resolvedSide = 'left';
      }

      let x = 0;
      let y = 0;

      switch (resolvedSide) {
        case 'top':
          x = rect.left + rect.width / 2;
          y = rect.top - GAP;
          break;
        case 'bottom':
          x = rect.left + rect.width / 2;
          y = rect.bottom + GAP;
          break;
        case 'left':
          x = rect.left - GAP;
          y = rect.top + rect.height / 2;
          break;
        case 'right':
          x = rect.right + GAP;
          y = rect.top + rect.height / 2;
          break;
      }

      setEffectiveSide(resolvedSide);
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
      {visible && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          className={cn(
            'fixed z-[9999] px-2.5 py-1.5 rounded-lg text-xs font-medium max-w-[240px] pointer-events-none',
            'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]',
            'shadow-lg shadow-black/20 backdrop-blur-md',
            'animate-fadeIn whitespace-nowrap',
            sideClasses[effectiveSide],
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
        </div>,
        document.body
      )}
    </span>
  );
}
