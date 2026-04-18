'use client';

import { useCallback, useRef } from 'react';

interface ResizableDividerProps {
  /** Current panel width in pixels */
  width: number;
  /** Callback when width changes */
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  /** Side the panel is on — controls drag direction */
  side?: 'right' | 'left';
}

export function ResizableDivider({
  width,
  onWidthChange,
  minWidth = 280,
  maxWidth = 560,
  side = 'right',
}: ResizableDividerProps) {
  const isDragging = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const startX = e.clientX;
      const startWidth = width;

      const handleMove = (me: PointerEvent) => {
        const dx = me.clientX - startX;
        // Dragging left increases width for a right-side panel
        const newWidth = side === 'right'
          ? Math.min(maxWidth, Math.max(minWidth, startWidth - dx))
          : Math.min(maxWidth, Math.max(minWidth, startWidth + dx));
        onWidthChange(newWidth);
      };

      const handleUp = () => {
        isDragging.current = false;
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
    },
    [width, onWidthChange, minWidth, maxWidth, side],
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      className="w-1 shrink-0 cursor-col-resize relative group z-20 select-none"
      title="Drag to resize"
    >
      {/* Visible bar */}
      <div className="absolute inset-y-0 -left-px w-[3px] bg-[var(--border-color)] group-hover:bg-accent-blue/60 group-active:bg-accent-blue transition-colors" />
      {/* Wider invisible hit area */}
      <div className="absolute inset-y-0 -left-2 w-5" />
    </div>
  );
}
